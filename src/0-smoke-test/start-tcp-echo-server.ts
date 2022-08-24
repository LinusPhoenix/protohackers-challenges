import { GlobalConfig } from "../config";
import { TcpEchoServer } from "./server";

const echoServer = new TcpEchoServer({
  host: GlobalConfig.BIND_ADDRESS,
  port: GlobalConfig.PORT,
});

console.log(
  `Listening for connections on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
echoServer.listen();
