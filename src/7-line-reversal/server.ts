import dgram from "node:dgram";
import { BindOptions } from "../util/types";
import {
    AckMessage,
    CloseMessage,
    ConnectMessage,
    DataMessage,
} from "./message";

export type Session = {
    id: number;
    address: string;
    port: number;
    bytesSent: number;
    dataReceived: string;
    payload: string;
};

const parseMessageInt = (s: string): number => {
    const i = parseInt(s);
    if (i < 0 || i > 2147483648) {
        throw new Error("Numeric value less than zero or too large");
    }
    return i;
};

const parseMessage = (bytes: Buffer) => {
    if (bytes.byteLength > 1000) {
        throw new Error("Message is larger than 1000 bytes");
    }
    const message = bytes.toString("utf8");
    if (!message.startsWith("/") || !message.endsWith("/")) {
        throw new Error(
            "Message does not start in a slash, or does not end in a slash"
        );
    }

    // TODO slash/backslash unescaping for data message payloads
    const fields = message.split("/").slice(1, -1);
    const numberOfFields = fields.length - 1;
    const type = fields[0];
    switch (type) {
        case "connect": {
            if (numberOfFields != 1) {
                throw new Error(
                    "Connect message has an invalid number of fields."
                );
            }
            const sessionId = parseMessageInt(fields[1]);
            return new ConnectMessage(sessionId);
        }
        case "data": {
            if (numberOfFields != 3) {
                throw new Error(
                    "Data message has an invalid number of fields."
                );
            }
            const sessionId = parseMessageInt(fields[1]);
            const pos = parseMessageInt(fields[2]);
            // Due to slashes in the payload, there may be more fields here
            const data = fields[3];
            return new DataMessage(sessionId, pos, data);
        }
        case "ack": {
            if (numberOfFields != 2) {
                throw new Error("Ack message has an invalid number of fields.");
            }
            const sessionId = parseMessageInt(fields[1]);
            const length = parseMessageInt(fields[2]);
            return new AckMessage(sessionId, length);
        }
        case "close": {
            if (numberOfFields != 1) {
                throw new Error(
                    "Close message has an invalid number of fields."
                );
            }
            const sessionId = parseMessageInt(fields[1]);
            return new CloseMessage(sessionId);
        }
        default:
            throw new Error(`Unknown message type: ${type}`);
    }
};

export class LrcpServer {
    private readonly socket = dgram.createSocket("udp4");

    private readonly sessions = new Map<number, Session>();

    constructor(private readonly options: BindOptions) {
        this.socket.on(
            "message",
            (rawMessage: Buffer, rinfo: dgram.RemoteInfo) => {
                try {
                    console.log(
                        `${rinfo.address}:${
                            rinfo.port
                        }: <-- ${rawMessage.toString("utf8")}`
                    );
                    const message = parseMessage(rawMessage);
                    if (message instanceof ConnectMessage) {
                        let session = this.sessions.get(message.sessionId);
                        if (session == null) {
                            session = {
                                id: message.sessionId,
                                address: rinfo.address,
                                port: rinfo.port,
                                bytesSent: 0,
                                dataReceived: "",
                                payload: "",
                            };
                            this.sessions.set(message.sessionId, session);
                        }
                        this.sendAckMessage(session, session.bytesSent);
                    } else if (message instanceof DataMessage) {
                        const session = this.sessions.get(message.sessionId);
                        if (session == null) {
                            this.sendStatelessCloseMessage(
                                message.sessionId,
                                rinfo.port,
                                rinfo.address
                            );
                            return;
                        }
                        if (session.dataReceived.length > message.pos) {
                            const nrNewBytes =
                                session.dataReceived.length - message.pos;
                            const newData = message.data.slice(
                                message.data.length - nrNewBytes
                            );
                            session.dataReceived.concat(newData);
                            this.sendAckMessage(
                                session,
                                session.dataReceived.length
                            );
                            const payload = this.generatePayload(session);
                            if (payload) {
                                session.payload =
                                    session.payload.concat(payload);
                                this.sendDataMessage(
                                    session,
                                    session.bytesSent + 1,
                                    session.bytesSent + payload.length + 1
                                );
                                session.bytesSent =
                                    session.bytesSent + payload.length;
                            }
                        } else {
                            this.sendAckMessage(
                                session,
                                session.dataReceived.length
                            );
                        }
                    } else if (message instanceof AckMessage) {
                        const session = this.sessions.get(message.sessionId);
                        if (
                            session == null ||
                            message.length > session.bytesSent
                        ) {
                            this.sendStatelessCloseMessage(
                                message.sessionId,
                                rinfo.port,
                                rinfo.address
                            );
                            return;
                        }
                        if (message.length < session.bytesSent) {
                            this.sendDataMessage(
                                session,
                                message.length,
                                session.bytesSent
                            );
                        }
                    } else if (message instanceof CloseMessage) {
                        const session = this.sessions.get(message.sessionId);
                        if (session == null) {
                            // This should not happen, ignore.
                            return;
                        }
                        this.sendCloseMessage(session);
                        this.sessions.delete(message.sessionId);
                    }
                } catch (error) {
                    // Invalid messages are ignored.
                    console.log("Received invalid LRCP message:");
                    console.log(rawMessage.toString("utf8"));
                    console.log(error);
                    return;
                }
            }
        );
    }

    generatePayload(session: Session) {
        const unprocessedData = session.dataReceived.slice(session.bytesSent);
        // The last element did not end in a newline, so we ignore it.
        const lines = unprocessedData.split("\n").slice(0, -1);
        return lines
            .map((s) => s.split("").reverse().join("").concat("\n"))
            .join("");
    }

    // TODO retransmission timeout
    // TODO session expiry timeout
    sendDataMessage(session: Session, start: number, end: number) {
        // TODO: Escape characters
        // TODO: Split if above byte limit
        const payload = session.payload.slice(start, end);
        const message = `/data/${session.id}/${start}/${payload}/`;
        console.log(`${session.address}:${session.port}: --> ${message}`);
        this.socket.send(message, session.port, session.address);
    }

    sendAckMessage(session: Session, length: number) {
        const message = `/ack/${session.id}/${length}/`;
        console.log(`${session.address}:${session.port}: --> ${message}`);
        this.socket.send(message, session.port, session.address);
    }

    sendCloseMessage(session: Session) {
        const message = `/close/${session.id}/`;
        console.log(`${session.address}:${session.port}: --> ${message}`);
        this.socket.send(message, session.port, session.address);
    }

    sendStatelessCloseMessage(
        sessionId: number,
        port: number,
        address: string
    ) {
        const message = `/close/${sessionId}/`;
        console.log(`${address}:${port}: --> ${message}`);
        this.socket.send(message, port, address);
    }

    bind() {
        this.socket.bind(this.options.port, this.options.host);
    }
}
