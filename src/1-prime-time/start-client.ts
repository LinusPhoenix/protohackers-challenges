import { GlobalConfig } from "../config";
import { delay } from "../util/delay";
import { TestClient } from "./client";

const client = new TestClient({
  host: GlobalConfig.BIND_ADDRESS,
  port: GlobalConfig.PORT,
});
client.connect();

client.sendIsPrimeRequest(93137);

client.disconnect();
