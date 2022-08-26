import * as net from "net";
import { BindOptions, DropEvent } from "../util/types";

export class TcpJsonServer<Req, Res> {
  private readonly server = net.createServer();

  constructor(
    private readonly options: BindOptions,
    private readonly requestHandler: (req: Req) => Res,
    private readonly requestValidator?: (req: Req) => boolean
  ) {
    this.server.on("connection", (conn: net.Socket) => {
      console.log(`${conn.remoteAddress}:${conn.remotePort} connected.`);

      let strBuffer = "";

      conn.on("data", (data: Buffer | string) => {
        if (data instanceof Buffer) {
          data = data.toString("utf8");
        }

        console.log(
          `Received data from ${conn.remoteAddress}:${conn.remotePort}:`
        );

        const isCompleteRequest = data.endsWith("\n");

        const requestsRaw = (strBuffer + data).split("\n").filter((s) => s);

        if (isCompleteRequest) {
          for (const requestRaw of requestsRaw) {
            this.handleRawRequest(conn, requestRaw);
          }
          strBuffer = "";
        } else {
          for (const requestRaw of requestsRaw.slice(0, -1)) {
            this.handleRawRequest(conn, requestRaw);
          }
          strBuffer = strBuffer + requestsRaw[requestsRaw.length - 1];
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

  private closeClientConnection(conn: net.Socket, message: string) {
    console.warn(message);
    console.warn("Received malformed request. Closing client connection.");
    conn.write(`${message}\n`);
    conn.destroy();
  }

  private handleRawRequest(conn: net.Socket, requestRaw: string) {
    console.log(
      `Handling request from ${conn.remoteAddress}:${conn.remotePort}:`
    );
    console.log(requestRaw);

    let request: any;
    try {
      request = JSON.parse(requestRaw);
    } catch (err) {
      this.closeClientConnection(conn, "Malformed request (is not a JSON)");
      return;
    }

    if (this.requestValidator && !this.requestValidator(request as Req)) {
      this.closeClientConnection(conn, "Malformed request (request validator)");
      return;
    }

    const response = this.requestHandler(request as Req);
    const responseJson = JSON.stringify(response);
    console.log(
      `Sending response to ${conn.remoteAddress}:${conn.remotePort}:`
    );
    console.log(responseJson);
    conn.write(`${responseJson}\n`);
  }

  listen() {
    this.server.listen(this.options.port, this.options.host);
  }
}
