import * as jsonschema from "jsonschema";
import { GlobalConfig } from "../config";
import { isPrime } from "../util/is-prime";
import { TcpJsonServer } from "./server";

type Request = {
  method: "isPrime";
  number: number;
};

type Response = {
  method: "isPrime";
  prime: boolean;
};

const requestSchema = {
  type: "object",
  required: ["method", "number"],
  properties: {
    method: {
      type: "string",
      enum: ["isPrime"],
    },
    number: {
      type: "integer",
    },
  },
};

const validator = new jsonschema.Validator();
const echoServer = new TcpJsonServer<Request, Response>(
  {
    host: GlobalConfig.BIND_ADDRESS,
    port: GlobalConfig.PORT,
  },
  (json: Request) => {
    const request = json as Request;

    return {
      method: "isPrime",
      prime: isPrime(request.number),
    };
  },
  (json: Request) => {
    return validator.validate(json, requestSchema).valid;
  }
);

console.log(
  `Listening for connections on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
echoServer.listen();
