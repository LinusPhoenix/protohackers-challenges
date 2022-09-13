import * as net from "net";
import { v4 } from "uuid";
import { BindOptions, DropEvent } from "../util/types";

export class TcpBinaryServer {
  private readonly server = net.createServer();

  constructor(
    private readonly options: BindOptions,
    private readonly requestHandler: (
      clientId: string,
      bytes: Buffer
    ) => Buffer | undefined
  ) {
    this.server.on("connection", (conn: net.Socket) => {
      console.log(`${conn.remoteAddress}:${conn.remotePort} connected.`);

      let connBuffer = Buffer.alloc(0);
      const clientId = v4();

      conn.on("data", (data: Buffer | string) => {
        if (typeof data === "string") {
          data = Buffer.from(data, "utf8");
        }
        console.log(
          `Received data from ${conn.remoteAddress}:${conn.remotePort}:`
        );
        console.log(data);

        if (connBuffer.byteLength > 0) {
          console.log(
            `Prefixing leftover data from ${conn.remoteAddress}:${conn.remotePort}:`
          );
          console.log(connBuffer);
          data = Buffer.concat([connBuffer, data]);
        }

        while (data.byteLength >= 9) {
          const request = data.subarray(0, 9);
          data = data.subarray(9, data.byteLength);

          console.log(
            `Handling request from ${conn.remoteAddress}:${conn.remotePort}:`
          );
          console.log(request);
          const response = this.requestHandler(clientId, request);
          if (response) {
            console.log(
              `Sending response to ${conn.remoteAddress}:${conn.remotePort}:`
            );
            console.log(response);
            conn.write(response);
          }
        }

        if (data.byteLength > 0) {
          console.log(
            `Saving leftover data from ${conn.remoteAddress}:${conn.remotePort}:`
          );
          console.log(data);
          connBuffer = data;
        }
      });

      conn.on("end", () => {
        console.log(`${conn.remoteAddress}:${conn.remotePort} disconnected.`);
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
