import { GlobalConfig } from "../config";
import { TestClient } from "./client";

let time = 0;
const sendRequest = (s: string) => {
    setTimeout(() => client.write(s + "\n"), ++time * 1000);
};
const disconnect = () => {
    setTimeout(() => client.disconnect, ++time * 1000);
};

const client = new TestClient({
    host: GlobalConfig.BIND_ADDRESS,
    port: GlobalConfig.PORT,
});
client.connect();

sendRequest(
    '{"request":"put","queue":"queue1","job":{"title":"example-job"},"pri":123}'
);
sendRequest('{"request":"get","queues":["queue1"]}');
sendRequest('{"request":"abort","id":1}');
sendRequest('{"request":"get","queues":["queue1"]}');
sendRequest('{"request":"delete","id":1}');
sendRequest('{"request":"get","queues":["queue1"]}');
sendRequest('{"request":"get","queues":["queue1"],"wait":true}');
disconnect();
