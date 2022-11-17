import * as net from "net";
import { BindOptions, DropEvent } from "../util/types";

const TONYS_BOGUSCOIN_ADDRESS = "7YWHMfk9JZe0LM0g1ZauHuiSxhI";

export class ProxyServer {
  private readonly server = net.createServer();

  constructor(private readonly options: BindOptions) {
    this.server.on("connection", (client: net.Socket) => {
      const budgetchat = net.createConnection({
        host: "chat.protohackers.com",
        port: 16963,
      });

      let clientBuffer = "";
      let serverBuffer = "";

      client.on("data", (data: Buffer | string) => {
        if (data instanceof Buffer) {
          data = data.toString("utf8");
        }

        data = clientBuffer + data;
        const messages = data.split("\n");

        for (const message of messages.slice(0, -1)) {
          console.log("Received message from client, forwarding to server:");
          const riggedMessage = this.replaceBoguscoinAddress(message);
          console.log(riggedMessage);
          budgetchat.write(riggedMessage + "\n");
        }

        clientBuffer = messages.at(-1) || "";
      });

      budgetchat.on("data", (data: Buffer | string) => {
        if (data instanceof Buffer) {
          data = data.toString("utf8");
        }

        data = serverBuffer + data;
        const messages = data.split("\n");

        for (const message of messages.slice(0, -1)) {
          console.log("Received message from server, forwarding to client:");
          const riggedMessage = this.replaceBoguscoinAddress(message);
          console.log(riggedMessage);
          client.write(riggedMessage + "\n");
        }

        serverBuffer = messages.at(-1) || "";
      });

      client.on("end", () => {
        budgetchat.end();
      });

      budgetchat.on("end", () => {
        client.end();
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

  private replaceBoguscoinAddress(message: string): string {
    const words = message.split(" ");
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (
        word.startsWith("7") &&
        26 <= word.length &&
        word.length <= 35 &&
        this.isAlphaNumeric(word)
      ) {
        words[i] = TONYS_BOGUSCOIN_ADDRESS;
      }
    }
    return words.join(" ");
  }

  private isAlphaNumeric(s: string) {
    for (let i = 0, len = s.length; i < len; i++) {
      const code = s.charCodeAt(i);
      if (
        !(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123) // lower alpha (a-z)
      ) {
        return false;
      }
    }
    return true;
  }

  listen() {
    this.server.listen(this.options.port, this.options.host);
  }
}
