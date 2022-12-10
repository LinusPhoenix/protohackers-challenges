import * as net from "net";
import { mod } from "../util/mod";
import { BindOptions, DropEvent } from "../util/types";
const cipherCanary = "Ciphering this message should definitely change it!\n";

const reverseBits = (byte: number) => {
    byte = ((byte & 0xf0) >> 4) | ((byte & 0x0f) << 4);
    byte = ((byte & 0xcc) >> 2) | ((byte & 0x33) << 2);
    byte = ((byte & 0xaa) >> 1) | ((byte & 0x55) << 1);
    return byte;
};
const xorN = (byte: number, n: number) => byte ^ n;
const xorPos = (byte: number, pos: number) => byte ^ mod(pos, 256);
const addN = (byte: number, n: number) => mod(byte + n, 256);
const subN = (byte: number, n: number) => mod(byte - n, 256);
const addPos = (byte: number, pos: number) => mod(byte + pos, 256);
const subPos = (byte: number, pos: number) => mod(byte - pos, 256);

const readCipherSpec = (data: Buffer) => {
    const cipherSpec = [] as ((byte: number, pos: number) => number)[];
    const inverseCipherSpec = [] as ((byte: number, pos: number) => number)[];
    while (data.length > 0) {
        const cipher = data[0];
        const n = data[1];
        switch (cipher) {
            case 0x00:
                return {
                    cipherSpec,
                    inverseCipherSpec: inverseCipherSpec.reverse(),
                    data: data.subarray(1),
                };
            case 0x01:
                inverseCipherSpec.push(reverseBits);
                cipherSpec.push(reverseBits);
                data = data.subarray(1);
                break;
            case 0x02:
                inverseCipherSpec.push((byte) => xorN(byte, n));
                cipherSpec.push((byte) => xorN(byte, n));
                data = data.subarray(2);
                break;
            case 0x03:
                inverseCipherSpec.push(xorPos);
                cipherSpec.push(xorPos);
                data = data.subarray(1);
                break;
            case 0x04:
                inverseCipherSpec.push((byte) => subN(byte, n));
                cipherSpec.push((byte) => addN(byte, n));
                data = data.subarray(2);
                break;
            case 0x05:
                inverseCipherSpec.push(subPos);
                cipherSpec.push(addPos);
                data = data.subarray(1);
                break;
        }
    }
    throw new Error("Infinite loop!");
};

const decipherInput = (
    data: Buffer,
    initialPos: number,
    inverseCipherSpec: ((byte: number, pos: number) => number)[]
) => {
    const deciphered = data.map((byte, index) => {
        return inverseCipherSpec.reduce(
            (byte, func) => func(byte, initialPos + index),
            byte
        );
    });
    return String.fromCharCode(...deciphered);
};

const cipherOutput = (
    data: string,
    initialPos: number,
    cipherSpec: ((byte: number, pos: number) => number)[]
) => {
    return Buffer.from(data, "utf8").map((byte, index) => {
        return cipherSpec.reduce(
            (byte, func) => func(byte, initialPos + index),
            byte
        );
    });
};

export class SocketServer {
    private readonly server = net.createServer();

    constructor(private readonly options: BindOptions) {
        let globalSessionId = 0;

        this.server.on("connection", (conn: net.Socket) => {
            const sessionId = globalSessionId++;
            let buffer = "";
            let inStreamPosition = 0;
            let outStreamPosition = 0;
            let isCipherSpecComplete = false;
            const cipherSpec = [] as ((byte: number, pos: number) => number)[];
            const inverseCipherSpec = [] as ((
                byte: number,
                pos: number
            ) => number)[];
            conn.on("data", (data: Buffer) => {
                let stringData = "";
                console.log(`(${sessionId}): <-- ${data.toString("hex")}`);
                if (!isCipherSpecComplete) {
                    const parsedInput = readCipherSpec(data);
                    cipherSpec.push(...parsedInput.cipherSpec);
                    inverseCipherSpec.push(...parsedInput.inverseCipherSpec);
                    const cipheredCanary = cipherOutput(
                        cipherCanary,
                        0,
                        cipherSpec
                    );
                    if (
                        cipherCanary === String.fromCharCode(...cipheredCanary)
                    ) {
                        conn.destroy();
                    }
                    const decipheredInput = decipherInput(
                        parsedInput.data,
                        inStreamPosition,
                        inverseCipherSpec
                    );
                    console.log(`(${sessionId}): <-- ${decipheredInput}`);
                    stringData = buffer.concat(decipheredInput);
                    inStreamPosition += decipheredInput.length;
                    isCipherSpecComplete = true;
                } else {
                    const decipheredInput = decipherInput(
                        data,
                        inStreamPosition,
                        inverseCipherSpec
                    );
                    console.log(`(${sessionId}): <-- ${decipheredInput}`);
                    stringData = buffer.concat(decipheredInput);
                    inStreamPosition += decipheredInput.length;
                }

                const messages = stringData.split("\n");
                for (const message of messages.slice(0, -1)) {
                    const items = message.split(",");
                    const parsedItems = items.map((item) => {
                        const xIndex = item.indexOf("x");
                        const quantity = parseInt(item.slice(0, xIndex));
                        return {
                            item,
                            quantity,
                        };
                    });
                    const response =
                        parsedItems.sort((a, b) => b.quantity - a.quantity)[0]
                            .item + "\n";
                    console.log(`(${sessionId}): --> ${response}`);
                    const cipher = cipherOutput(
                        response,
                        outStreamPosition,
                        cipherSpec
                    );
                    console.log(
                        `(${sessionId}): --> ${Buffer.from(cipher).toString(
                            "hex"
                        )}`
                    );
                    outStreamPosition += cipher.length;
                    conn.write(cipher);
                }

                buffer = messages.at(-1) || "";
            });
        });

        this.server.on("close", () => {
            console.log("TCP server closed.");
        });

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

    listen() {
        this.server.listen(this.options.port, this.options.host);
    }
}
