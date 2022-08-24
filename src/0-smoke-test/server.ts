import * as net from "net";
import { GlobalConfig } from "../config";
import { DropEvent } from "../util/events";

console.log("Creating TCP echo server...");
const echoServer = net.createServer();

echoServer.on("connection", (conn: net.Socket) => {
  console.log(`${conn.remoteAddress}:${conn.remotePort} connected.`);

  conn.on("data", (data: Buffer | string) => {
    if (typeof data === "string") {
      console.log(
        `Received message from ${conn.remoteAddress}:${conn.remotePort}:`
      );
      console.log(data);
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

echoServer.on("close", () => {
  console.log("TCP server echo closed.");
});

echoServer.on("drop", (data: DropEvent) => {
  console.warn(
    `Dropping new connection from ${data.remoteAddress}:${data.remotePort}: 
    Too many open connections (max. ${echoServer.maxConnections}).`
  );
});

echoServer.on("error", (err) => {
  throw err;
});

console.log(
  `Listening for connections on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
echoServer.listen(GlobalConfig.PORT, GlobalConfig.BIND_ADDRESS);
