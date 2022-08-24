import { LoremIpsum } from "lorem-ipsum";
import * as net from "net";
import { delay } from "../util/delay";
import { between } from "../util/random";
import { BindOptions } from "../util/types";

export class LoremIpsumPool {
  private readonly loremIpsum = new LoremIpsum();

  constructor(
    private readonly clientCount: number,
    private readonly delayMs: number,
    private readonly options: BindOptions
  ) {}

  async start() {
    console.log(`Creating a pool of ${this.clientCount} clients...`);
    const clients: Array<LoremIpsumClient> = [];
    for (let i = 0; i < this.clientCount; i++) {
      const client = new LoremIpsumClient(i, this.options);
      client.connect();
      clients.push(client);
    }

    console.log(`Sending lorem ipsum...`);
    while (clients.find((client) => client.isConnected)) {
      const randomClient = clients[between(0, this.clientCount)];
      randomClient.write(this.loremIpsum.generateParagraphs(1));
      await delay(this.delayMs);
    }
    console.log("All pool connections are closed. Exiting.");
  }
}

class LoremIpsumClient {
  connection: net.Socket | undefined;

  isConnected = false;

  constructor(
    private readonly clientId: number,
    private readonly options: BindOptions
  ) {}

  connect() {
    if (this.connection) {
      return;
    }

    this.connection = net.createConnection(this.options, () => {
      console.log(
        `[${this.clientId}] Connected to ${this.options.host}:${this.options.port}.`
      );
    });
    this.isConnected = true;

    this.connection.setTimeout(10000);
    this.connection.on("timeout", () => {
      throw new Error(`[${this.clientId}] Connection timed out.`);
    });

    this.connection.on("data", (data) => {
      console.log(`[${this.clientId}] Received data from server:`);
      console.log(data.toString());
    });

    this.connection.on("end", () => {
      this.isConnected = false;
      console.log(`[${this.clientId}] Server closed the connection.`);
    });

    this.connection.on("error", (err) => {
      this.isConnected = false;
      throw err;
    });
  }

  write(data: Buffer | string) {
    console.log(`[${this.clientId}] Sending data to server:`);
    console.log(data);
    this.connection?.write(data);
  }
}
