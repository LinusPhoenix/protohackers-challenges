import { GlobalConfig } from "../config";
import { TestClient } from "./client";

const sendRequest = (
  client: TestClient,
  type: number,
  first: number,
  second: number
) => {
  const buffer = Buffer.alloc(9);
  buffer[0] = type;
  buffer.writeInt32BE(first, 1);
  buffer.writeInt32BE(second, 5);
  client.write(buffer);
};

const sendInsertRequest = (
  client: TestClient,
  timestamp: number,
  price: number
) => {
  sendRequest(client, 0x49, timestamp, price);
};

const sendQueryRequest = (
  client: TestClient,
  mintime: number,
  maxtime: number
) => {
  sendRequest(client, 0x51, mintime, maxtime);
};

const client = new TestClient({
  host: GlobalConfig.BIND_ADDRESS,
  port: GlobalConfig.PORT,
});
client.connect();

sendInsertRequest(client, 42, 324);

sendInsertRequest(client, 69, 5910);

sendQueryRequest(client, 10, 15);

sendQueryRequest(client, 42, 69);

sendQueryRequest(client, 10, 50);

client.disconnect();
