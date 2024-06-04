import express, { Application } from "express";
import { Server, Socket } from "socket.io";
import http from "http";

import ioHandler from "./ioHandler";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", ioHandler);

server.listen(3000, () => {
  console.log("listening on *:3000");
});
