import { GlobalConfig } from "../config";
import { UdpServer } from "./server";

const server = new UdpServer({
  host: GlobalConfig.BIND_ADDRESS,
  port: GlobalConfig.PORT,
});

console.log(
  `Listening for packets on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
server.bind();
