import * as net from "net";
import { BindOptions } from "../util/types";

export class TestClient {
    private connection: net.Socket | undefined;

    isConnected = false;

    constructor(private readonly options: BindOptions) {}

    connect() {
        if (this.connection) {
            return;
        }

        this.connection = net.createConnection(this.options, () => {
            console.log(
                `Connected to ${this.options.host}:${this.options.port}.`
            );
        });
        this.isConnected = true;

        this.connection.setTimeout(10000);
        this.connection.on("timeout", () => {
            throw new Error(`Connection timed out.`);
        });

        this.connection.on("data", (data) => {
            console.log(`Received data from server:`);
            console.log(data.toString("hex"));
        });

        this.connection.on("end", () => {
            this.isConnected = false;
            console.log(`Server closed the connection.`);
        });

        this.connection.on("error", (err) => {
            this.isConnected = false;
            throw err;
        });
    }

    disconnect() {
        if (!this.connection) {
            return;
        }

        this.connection.end();
        this.connection = undefined;
    }

    write(data: Buffer | string) {
        if (!this.connection) {
            this.connect();
        }
        console.log(`Sending data to server:`);
        console.log(data);
        this.connection?.write(data);
    }
}
