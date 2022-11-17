import { GlobalConfig } from "../config";
import { ProxyServer } from "./server";

const server = new ProxyServer({
  host: GlobalConfig.BIND_ADDRESS,
  port: GlobalConfig.PORT,
});

console.log(
  `Listening for connections on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
server.listen();
