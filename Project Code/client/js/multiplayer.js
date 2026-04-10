(function attachMultiplayerModule() {
  const PLAYER_KEY_STORAGE_KEY = "chessOnlinePlayerKey";

  function getPlayerKey() {
    let playerKey = window.sessionStorage.getItem(PLAYER_KEY_STORAGE_KEY);
    if (!playerKey) {
      playerKey = window.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem(PLAYER_KEY_STORAGE_KEY, playerKey);
    }
    return playerKey;
  }

  function createClient({ token, onSnapshot, onStatusChange, onError, onMatchEnded, onMatchResigned, onRoomList }) {
    const socket = window.io({
      autoConnect: false,
      auth: {
        token,
        playerKey: getPlayerKey()
      }
    });

    let currentRoomId = null;

    function emitWithAck(event, payload = {}) {
      return new Promise((resolve, reject) => {
        if (!socket.connected) {
          socket.connect();
        }

        socket.timeout(7000).emit(event, payload, (error, response) => {
          if (error) {
            reject(new Error("Connection timed out."));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error || "Request failed."));
            return;
          }

          resolve(response);
        });
      });
    }

    socket.on("connect", () => {
      if (currentRoomId) {
        socket.timeout(7000).emit("match:join", { roomId: currentRoomId }, (error, response) => {
          if (error) {
            onStatusChange?.({ connected: false });
            onError?.("Connection timed out.");
            return;
          }

          if (!response?.ok) {
            onStatusChange?.({ connected: false });
            onError?.(response?.error || "Unable to rejoin the match.");
            return;
          }

          onStatusChange?.({ connected: true });
          onSnapshot?.(response.snapshot);
        });
      }
    });

    socket.on("disconnect", () => {
      onStatusChange?.({ connected: false });
    });

    socket.on("connect_error", (error) => {
      onStatusChange?.({ connected: false });
      onError?.(error.message || "Unable to connect.");
    });

    socket.on("match:snapshot", (snapshot) => {
      onSnapshot?.(snapshot);
    });

    socket.on("match:ended", (payload) => {
      onMatchEnded?.(payload);
    });

    socket.on("match:resigned", (payload) => {
      onMatchResigned?.(payload);
    });

    socket.on("room:list", (payload) => {
      onRoomList?.(Array.isArray(payload?.rooms) ? payload.rooms : []);
    });

    return {
      async createMatch(roomName, settings) {
        const response = await emitWithAck("match:create", { roomName, settings });
        currentRoomId = response.roomId;
        onStatusChange?.({ connected: true });
        return response;
      },
      async joinMatch(roomId) {
        const response = await emitWithAck("match:join", { roomId });
        currentRoomId = response.roomId;
        onStatusChange?.({ connected: true });
        return response;
      },
      async getMatch(roomId) {
        const response = await emitWithAck("match:get", { roomId });
        currentRoomId = roomId;
        onStatusChange?.({ connected: true });
        return response;
      },
      async listRooms() {
        const response = await emitWithAck("room:list");
        onRoomList?.(Array.isArray(response?.rooms) ? response.rooms : []);
        return response.rooms || [];
      },
      async sendMove(roomId, move) {
        return emitWithAck("match:move", { roomId, move });
      },
      async resign(roomId) {
        return emitWithAck("match:resign", { roomId });
      },
      disconnect() {
        currentRoomId = null;
        socket.disconnect();
      }
    };
  }

  window.ChessApp.multiplayer = {
    createClient,
    getPlayerKey
  };
})();
