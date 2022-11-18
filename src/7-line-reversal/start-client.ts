import dgram from "node:dgram";
import readline from "readline";

const socket = dgram.createSocket("udp4");

socket.on("message", (msg) =>
    console.log(msg.toString("utf8").replace(/\n/g, "\\n"))
);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

rl.on("line", (line: string) => {
    socket.send(line.replace(/\\n/g, "\n"), 33221, "127.0.0.1");
});
