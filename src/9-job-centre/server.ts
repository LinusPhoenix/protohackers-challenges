import * as net from "net";
import { on } from "events";
import { BindOptions, DropEvent } from "../util/types";
import { JobCentreRequestSchema } from "./request.types";
import { JobCentre, JobCentreResult } from "./job-centre";

const getRequest = (
    input: Buffer
): { request: string; length: number } | undefined => {
    const stringInput = input.toString("utf8");
    const newlineIndex = stringInput.indexOf("\n");
    if (newlineIndex === -1) {
        return undefined;
    }

    const request = stringInput.slice(0, newlineIndex);
    return {
        request: request,
        length: request.length + 1,
    };
};

async function* receive(conn: net.Socket): AsyncGenerator<string> {
    let input = Buffer.alloc(0);

    for await (const [buf] of on(conn, "data")) {
        input = Buffer.concat([input, buf], input.length + buf.length);

        while (input.length !== 0) {
            const result = getRequest(input);
            if (result == null) break;
            const { request, length } = result;
            input = input.subarray(length);
            yield request;
        }
    }
}

export class JobCentreServer {
    private readonly server = net.createServer();
    private readonly clients = new Map<number, net.Socket>();

    private globalConnId = 0;
    constructor(
        private readonly options: BindOptions,
        private readonly jobCentre: JobCentre
    ) {
        this.server.on("connection", async (conn: net.Socket) => {
            const id = ++this.globalConnId;
            this.clients.set(id, conn);
            console.log(`Client ${id} connected.`);

            conn.on("end", () => {
                console.log(`Client ${id} disconnected.`);
                this.clients.delete(id);
                const result = this.jobCentre.processClientDisconnect(id);
                this.sendResponses(result);
            });

            for await (const requestRaw of receive(conn)) {
                let result: JobCentreResult;
                console.log(`<--(${id}) ${requestRaw}`);
                try {
                    const request = JobCentreRequestSchema.parse(
                        JSON.parse(requestRaw)
                    );
                    result = this.jobCentre.processRequest(id, request);
                } catch (error) {
                    result = [
                        {
                            recipient: id,
                            response: {
                                status: "error",
                            },
                        },
                    ];
                }
                this.sendResponses(result);
            }
        });
        this.server.on("close", () => console.log("TCP server closed."));
        this.server.on("drop", (data: DropEvent) => {
            console.warn(
                `Dropping new connection from ${data.remoteAddress}:${data.remotePort}: 
            Too many open connections (max. ${this.server.maxConnections}).`
            );
        });

        this.server.on("error", (err) => {
            throw err;
        });
    }

    private sendResponses(result: JobCentreResult) {
        for (const { recipient, response } of result) {
            console.log(`-->(${recipient}) ${JSON.stringify(response)}`);
            const conn = this.clients.get(recipient);
            if (conn != null) {
                conn.write(JSON.stringify(response) + "\n");
            }
        }
    }

    listen() {
        this.server.listen(this.options.port, this.options.host);
    }
}
