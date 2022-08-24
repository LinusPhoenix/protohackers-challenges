import { GlobalConfig } from "../config";
import { LoremIpsumPool } from "./client";

const pool = new LoremIpsumPool(
  GlobalConfig.CLIENT_COUNT,
  GlobalConfig.LOREM_IPSUM_DELAY_MS,
  {
    host: GlobalConfig.BIND_ADDRESS,
    port: GlobalConfig.PORT,
  }
);
console.log(
  `Sending lorem ipsum to ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
pool.start();
