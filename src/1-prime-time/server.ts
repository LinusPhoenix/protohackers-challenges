import * as net from "net";
import { BindOptions, DropEvent } from "../util/types";

export class TcpJsonServer<Req, Res> {
  private readonly server = net.createServer();

  constructor(
    private readonly options: BindOptions,
    requestHandler: (req: Req) => Res,
    requestValidator?: (req: Req) => boolean
  ) {
    this.server.on("connection", (conn: net.Socket) => {
      console.log(`${conn.remoteAddress}:${conn.remotePort} connected.`);

      conn.on("data", (data: Buffer | string) => {
        if (data instanceof Buffer) {
          data = data.toString("utf8");
        }

        console.log(
          `Received request from ${conn.remoteAddress}:${conn.remotePort}:`
        );
        console.log(data);

        if (data.endsWith("\r\n")) {
          data = data.substring(0, data.length - 2);
        } else if (data.endsWith("\n")) {
          data = data.substring(0, data.length - 1);
        } else {
          this.closeClientConnection(
            conn,
            'Malformed request (does not end in "\\r\\n" or "\\n")'
          );
          return;
        }

        let request: any;
        try {
          request = JSON.parse(data);
        } catch (err) {
          this.closeClientConnection(conn, "Malformed request (is not a JSON)");
          return;
        }

        if (requestValidator && !requestValidator(request as Req)) {
          this.closeClientConnection(
            conn,
            "Malformed request (request validator)"
          );
          return;
        }

        const response = requestHandler(request as Req);
        const responseJson = JSON.stringify(response);
        console.log(
          `Sending response to ${conn.remoteAddress}:${conn.remotePort}:`
        );
        console.log(responseJson);
        conn.write(`${responseJson}\n`);
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
    console.warn("Received malformed request. Closing client connection.");
    conn.write(`${message}\n`);
    conn.destroy();
  }

  listen() {
    this.server.listen(this.options.port, this.options.host);
  }
}
