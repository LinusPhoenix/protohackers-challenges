import dgram from "node:dgram";
import { BindOptions } from "../util/types";

export class UdpServer {
  private readonly socket = dgram.createSocket("udp4");

  private readonly keyValues = new Map<string, string>();

  constructor(private readonly options: BindOptions) {
    this.socket.on("message", (rawMessage: Buffer, rinfo: dgram.RemoteInfo) => {
      const message = rawMessage.toString("utf8");

      if (message.includes("=")) {
        console.log(`Receiving insert request: ${message}`);
        const splitMessage = message.split("=");
        const key = splitMessage.shift() || "";
        const value = splitMessage.join("=");

        this.keyValues.set(key, value);
      } else {
        console.log(`Receiving retrieve request: ${message}`);
        const key = message;
        const value =
          key === "version"
            ? "phoenix key value store 0.1"
            : this.keyValues.get(key) || "";
        const response = `${key}=${value}`;
        console.log(`Sending retrieve response: ${response}`);
        this.socket.send(response, rinfo.port, rinfo.address);
      }
    });
  }

  bind() {
    this.socket.bind(this.options.port, this.options.host);
  }
}
