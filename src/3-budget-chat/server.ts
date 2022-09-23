import * as net from "net";
import { v4 } from "uuid";
import { BindOptions, DropEvent } from "../util/types";

type User = {
  id: string;
  name: string;
  conn: net.Socket;
};

export class ChatServer {
  private readonly server = net.createServer();

  private readonly joinedUsers = new Map<string, User>();

  constructor(private readonly options: BindOptions) {
    this.server.on("connection", (conn: net.Socket) => {
      const clientId = v4();
      console.log(`${clientId} connected.`);

      let strBuffer = "";

      conn.write("Welcome to phoenixchat! Please choose a name:\n");

      conn.on("data", (data: Buffer | string) => {
        if (data instanceof Buffer) {
          data = data.toString("utf8");
        }

        data = strBuffer + data;
        const messages = data.split("\n");

        for (const message of messages.slice(0, -1)) {
          const messageSanitized = message.endsWith("\r")
            ? message.substring(0, message.length - 1)
            : message;

          this.processMessage(clientId, messageSanitized, conn);
        }

        strBuffer = messages.at(-1) || "";
      });

      conn.on("end", () => {
        console.log(`${clientId} disconnected.`);
        const user = this.joinedUsers.get(clientId);
        if (user) {
          this.sendMessage(user, `* ${user.name} has left the chat.`);
          this.joinedUsers.delete(user.id);
        }
      });
    });

    this.server.on("close", () => {
      console.log("TCP server closed.");
    });

    this.server.on("drop", (data: DropEvent) => {
      console.warn(
        `Dropping new connection from ${data.remoteAddress}:${data.remotePort}: 
          Too many open connections (max. ${this.server.maxConnections}).`
      );
    });

    this.server.on("error", (err) => {
      throw err;
    });
  }

  private processMessage(clientId: string, message: string, conn: net.Socket) {
    const user = this.joinedUsers.get(clientId);
    if (!user) {
      this.setUsername(clientId, message, conn);
    } else {
      this.sendMessage(user, `[${user.name}] ${message}`);
    }
  }

  private sendMessage(sender: User, message: string) {
    console.log(message);

    const users = Array.from(this.joinedUsers.values());
    users
      .filter((u) => u.id !== sender.id)
      .forEach((user) => user.conn.write(message + "\n"));
  }

  private setUsername(clientId: string, name: string, conn: net.Socket) {
    // Message is a username, check for legality
    if (
      !name ||
      name.length > 16 ||
      !this.isAlphaNumeric(name) ||
      this.doesUserExist(name)
    ) {
      console.log(
        `${clientId} chose an invalid or duplicate username (${name}), disconnecting.`
      );
      conn.write("Sorry, that username is not valid or already taken.\n");
      conn.destroy();
    } else {
      console.log(`${clientId} has joined the chat as: ${name}`);
      const users = Array.from(this.joinedUsers.values());

      conn.write(
        `* In the chat: ${users.map((user) => user.name).join(", ")}\n`
      );
      const joinedUser = {
        id: clientId,
        name,
        conn,
      };
      this.joinedUsers.set(clientId, joinedUser);
      this.sendMessage(joinedUser, `* ${name} has joined the chat.`);
    }
  }

  private doesUserExist(username: string) {
    const users = Array.from(this.joinedUsers.values());

    return users.filter((user) => user.name === username).length > 0;
  }

  private isAlphaNumeric(s: string) {
    for (let i = 0, len = s.length; i < len; i++) {
      const code = s.charCodeAt(i);
      if (
        !(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123) // lower alpha (a-z)
      ) {
        return false;
      }
    }
    return true;
  }

  listen() {
    this.server.listen(this.options.port, this.options.host);
  }
}
