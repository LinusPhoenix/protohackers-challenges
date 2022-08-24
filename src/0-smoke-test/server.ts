import * as net from "net";
import { GlobalConfig } from "../config";
import { BindOptions, DropEvent } from "../util/types";

export class TcpEchoServer {
  private readonly server = net.createServer();

  constructor(private readonly options: BindOptions) {
    this.server.on("connection", (conn: net.Socket) => {
      console.log(`${conn.remoteAddress}:${conn.remotePort} connected.`);

      conn.on("data", (data: Buffer | string) => {
        if (typeof data === "string") {
          console.log(
            `Received ${data.length} characters from ${conn.remoteAddress}:${conn.remotePort}.`
          );
        } else {
          console.log(
            `Received ${data.byteLength} bytes from ${conn.remoteAddress}:${conn.remotePort}.`
          );
        }
        conn.write(data);
      });

      conn.on("end", () => {
        console.log(`${conn.remoteAddress}:${conn.remotePort} disconnected.`);
      });
    });

    this.server.on("close", () => {
      console.log("TCP server echo closed.");
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
    this.server.listen(GlobalConfig.PORT, GlobalConfig.BIND_ADDRESS);
  }
}
