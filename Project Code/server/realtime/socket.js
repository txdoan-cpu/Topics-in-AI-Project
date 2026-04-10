const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const {
  createMatch,
  joinMatch,
  getMatchSnapshot,
  applyMove,
  resignMatch,
  markDisconnected,
  removeMatch,
  listMatches
} = require("./matchStore");

function emitSnapshot(io, roomId) {
  const snapshot = getMatchSnapshot(roomId);
  if (snapshot) {
    io.to(roomId).emit("match:snapshot", snapshot);
  }
}

function sendAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

function emitRoomList(io) {
  io.emit("room:list", { rooms: listMatches() });
}

function attachRealtime(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const playerKey = socket.handshake.auth?.playerKey;

    if (!token || !playerKey) {
      next(new Error("Authentication required."));
      return;
    }

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.player = {
        playerKey,
        userId: user.sub,
        username: user.username || user.email || "Player"
      };
      next();
    } catch (error) {
      next(new Error("Invalid token."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("match:create", (payload = {}, ack) => {
      try {
        const result = createMatch({
          roomName: payload.roomName,
          settings: payload.settings,
          player: socket.data.player
        });
        socket.join(result.roomId);
        socket.data.roomId = result.roomId;
        sendAck(ack, {
          ok: true,
          roomId: result.roomId,
          playerColor: result.playerColor,
          snapshot: result.snapshot
        });
        emitSnapshot(io, result.roomId);
        emitRoomList(io);
      } catch (error) {
        sendAck(ack, { ok: false, error: error.message });
      }
    });

    socket.on("match:join", (payload = {}, ack) => {
      try {
        const result = joinMatch({ roomId: payload.roomId, player: socket.data.player });
        socket.join(result.roomId);
        socket.data.roomId = result.roomId;
        sendAck(ack, {
          ok: true,
          roomId: result.roomId,
          playerColor: result.playerColor,
          snapshot: result.snapshot
        });
        emitSnapshot(io, result.roomId);
        emitRoomList(io);
      } catch (error) {
        sendAck(ack, { ok: false, error: error.message });
      }
    });

    socket.on("room:list", (_payload = {}, ack) => {
      sendAck(ack, { ok: true, rooms: listMatches() });
    });

    socket.on("match:get", (payload = {}, ack) => {
      const snapshot = getMatchSnapshot(payload.roomId);
      if (!snapshot) {
        sendAck(ack, { ok: false, error: "Match not found." });
        return;
      }

      socket.join(snapshot.roomId);
      socket.data.roomId = snapshot.roomId;
      sendAck(ack, { ok: true, snapshot });
    });

    socket.on("match:move", (payload = {}, ack) => {
      try {
        const result = applyMove({
          roomId: payload.roomId,
          player: socket.data.player,
          move: payload.move
        });

        sendAck(ack, { ok: true, move: result.move, snapshot: result.snapshot });
        emitSnapshot(io, result.roomId);
      } catch (error) {
        sendAck(ack, { ok: false, error: error.message });
      }
    });

    socket.on("match:resign", (payload = {}, ack) => {
      try {
        const result = resignMatch({ roomId: payload.roomId, player: socket.data.player });
        socket.leave(result.roomId);
        socket.data.roomId = null;
        sendAck(ack, {
          ok: true,
          roomId: result.roomId,
          resignedColor: result.playerColor,
          roomDeleted: result.roomDeleted,
          snapshot: result.snapshot
        });

        if (result.roomDeleted) {
          removeMatch(result.roomId);
        } else {
          io.to(result.roomId).emit("match:resigned", {
            roomId: result.roomId,
            resignedColor: result.playerColor,
            snapshot: result.snapshot
          });
          emitSnapshot(io, result.roomId);
        }

        emitRoomList(io);
      } catch (error) {
        sendAck(ack, { ok: false, error: error.message });
      }
    });

    socket.on("disconnect", () => {
      const updatedRooms = markDisconnected(socket.data.player.playerKey);
      updatedRooms.forEach((roomId) => emitSnapshot(io, roomId));
      if (updatedRooms.length) {
        emitRoomList(io);
      }
    });
  });

  return io;
}

module.exports = attachRealtime;
