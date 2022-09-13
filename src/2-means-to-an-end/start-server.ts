import { GlobalConfig } from "../config";
import { TcpBinaryServer } from "./server";

type InsertRequest = {
  type: 0x49;
  clientId: string;
  timestamp: number;
  price: number;
};

type QueryRequest = {
  type: 0x51;
  clientId: string;
  mintime: number;
  maxtime: number;
};

type TimestampedPrice = {
  timestamp: number;
  price: number;
};

const pricesByClient = new Map<string, TimestampedPrice[]>();

const handleInsertRequest = (request: InsertRequest) => {
  const { clientId, timestamp, price } = request;
  const storedPrices = pricesByClient.get(clientId) || [];

  storedPrices.push({ timestamp, price });

  pricesByClient.set(clientId, storedPrices);
};

const handleQueryRequest = (request: QueryRequest) => {
  const { clientId, mintime, maxtime } = request;
  const storedPrices = pricesByClient.get(clientId) || [];

  const responseBuffer = Buffer.alloc(4);
  const pricesInTimespan = storedPrices.filter(
    (x) => mintime <= x.timestamp && x.timestamp <= maxtime
  );
  if (pricesInTimespan.length > 0) {
    const mean = pricesInTimespan
      .map((x) => x.price)
      .reduce((average, value) => average + value / pricesInTimespan.length, 0);
    responseBuffer.writeInt32BE(mean);
  }
  return responseBuffer;
};

const handleRequest = (clientId: string, request: Buffer) => {
  if (request.byteLength != 9) {
    throw new Error(
      `Received invalid request (expected 9 bytes, received ${request.byteLength})`
    );
  }

  const requestType = request[0];
  const firstNumber = request.readInt32BE(1);
  const secondNumber = request.readInt32BE(5);
  switch (requestType) {
    case 0x49: // "I"
      handleInsertRequest({
        type: requestType,
        clientId,
        timestamp: firstNumber,
        price: secondNumber,
      });
      return undefined;
    case 0x51: // "Q"
      return handleQueryRequest({
        type: requestType,
        clientId,
        mintime: firstNumber,
        maxtime: secondNumber,
      });
    default:
      return undefined;
  }
};

const server = new TcpBinaryServer(
  {
    host: GlobalConfig.BIND_ADDRESS,
    port: GlobalConfig.PORT,
  },
  handleRequest
);

console.log(
  `Listening for connections on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
server.listen();
