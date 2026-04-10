const ChessGame = require("../chess/ChessGame");

const matches = new Map();

function normalizeRoomId(roomId = "") {
  return String(roomId || "").trim().toUpperCase();
}

function normalizeRoomName(roomName = "") {
  return String(roomName || "").trim().replace(/\s+/g, " ");
}

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createSeat(player) {
  return {
    playerKey: player.playerKey,
    userId: player.userId,
    username: player.username,
    connected: true
  };
}

function createSettings(settings = {}) {
  const time = Number(settings.timeControl || settings.time || 10);
  return {
    timeControl: [5, 10, 15, 20].includes(time) ? time : 10,
    boardTheme: ["classic", "dark", "light"].includes(settings.boardTheme) ? settings.boardTheme : "classic",
    pieceModel: ["standard", "modern", "minimal"].includes(settings.pieceModel) ? settings.pieceModel : "standard",
    sound: settings.sound !== false
  };
}

function createTimerState(minutes) {
  const milliseconds = Number(minutes) * 60 * 1000;
  return {
    whiteMs: milliseconds,
    blackMs: milliseconds,
    lastTickAt: null,
    expiredColor: null,
    active: false
  };
}

function getOrThrowMatch(roomId) {
  const room = normalizeRoomId(roomId);
  const match = matches.get(room);
  if (!match) {
    throw new Error("Match not found.");
  }
  return match;
}

function getSeatColor(match, playerKey) {
  if (match.players.w?.playerKey === playerKey) return "w";
  if (match.players.b?.playerKey === playerKey) return "b";
  return null;
}

function getSeatLabel(color) {
  return color === "w" ? "White" : "Black";
}

function touchMatch(match) {
  match.updatedAt = new Date().toISOString();
}

function getMatchStatus(match) {
  return match.resultOverride ? { ...match.resultOverride } : match.game.getStatus();
}

function deriveCapturedPieces(moveHistory) {
  return moveHistory.reduce((captured, move, index) => {
    if (!move.captured) {
      return captured;
    }

    if (index % 2 === 0) {
      captured.white.push(move.captured);
    } else {
      captured.black.push(move.captured);
    }

    return captured;
  }, { white: [], black: [] });
}

function syncTimer(match) {
  if (!match.timerState || !match.timerState.active || match.timerState.expiredColor || !match.timerState.lastTickAt) {
    return;
  }

  const now = Date.now();
  const elapsed = now - match.timerState.lastTickAt;
  match.timerState.lastTickAt = now;

  if (match.game.turn === "w") {
    match.timerState.whiteMs = Math.max(0, match.timerState.whiteMs - elapsed);
    if (match.timerState.whiteMs === 0) {
      match.timerState.expiredColor = "w";
      match.timerState.active = false;
      match.resultOverride = { over: true, result: "0-1", message: "White ran out of time" };
    }
  } else {
    match.timerState.blackMs = Math.max(0, match.timerState.blackMs - elapsed);
    if (match.timerState.blackMs === 0) {
      match.timerState.expiredColor = "b";
      match.timerState.active = false;
      match.resultOverride = { over: true, result: "1-0", message: "Black ran out of time" };
    }
  }
}

function startMatch(match) {
  if (match.matchStarted || !match.players.w || !match.players.b) {
    return;
  }

  match.matchStarted = true;
  if (match.timerState && !match.resultOverride) {
    match.timerState.active = true;
    match.timerState.lastTickAt = Date.now();
  }
  touchMatch(match);
}

function finalizeMoveTimerState(match) {
  const status = getMatchStatus(match);
  if (status.over) {
    if (match.timerState) {
      match.timerState.active = false;
      match.timerState.lastTickAt = null;
    }
    return;
  }

  if (match.timerState) {
    match.timerState.active = true;
    match.timerState.lastTickAt = Date.now();
  }
}

function buildSnapshot(match) {
  syncTimer(match);
  touchMatch(match);

  return {
    roomId: match.roomId,
    roomName: match.roomName,
    gameState: match.game.serialize(),
    moveHistory: match.game.moveHistory.map((move) => ({ ...move })),
    turn: match.game.turn,
    status: getMatchStatus(match),
    capturedPieces: deriveCapturedPieces(match.game.moveHistory),
    ready: Boolean(match.players.w && match.players.b),
    matchStarted: match.matchStarted,
    settings: { ...match.settings },
    timerState: match.timerState ? { ...match.timerState } : null,
    players: {
      white: match.players.w ? {
        username: match.players.w.username,
        connected: match.players.w.connected
      } : null,
      black: match.players.b ? {
        username: match.players.b.username,
        connected: match.players.b.connected
      } : null
    },
    updatedAt: match.updatedAt
  };
}

function claimSeat(match, player) {
  const existingColor = getSeatColor(match, player.playerKey);
  if (existingColor) {
    match.players[existingColor].connected = true;
    match.players[existingColor].username = player.username;
    touchMatch(match);
    return existingColor;
  }

  if (!match.players.w) {
    match.players.w = createSeat(player);
    touchMatch(match);
    return "w";
  }

  if (!match.players.b) {
    match.players.b = createSeat(player);
    touchMatch(match);
    return "b";
  }

  throw new Error("This match already has two players.");
}

function createMatch({ roomName, settings, player }) {
  const normalizedName = normalizeRoomName(roomName);
  if (!normalizedName) {
    throw new Error("Room Name is required.");
  }

  const roomId = normalizeRoomId(normalizedName) || createRoomId();
  if (matches.has(roomId)) {
    throw new Error("Room name already exists.");
  }

  const nextSettings = createSettings(settings);
  const match = {
    roomId,
    roomName: normalizedName,
    game: new ChessGame(),
    players: { w: createSeat(player), b: null },
    resultOverride: null,
    settings: nextSettings,
    timerState: createTimerState(nextSettings.timeControl),
    matchStarted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  matches.set(roomId, match);
  return { roomId: match.roomId, playerColor: "w", snapshot: buildSnapshot(match) };
}

function joinMatch({ roomId, player }) {
  const match = getOrThrowMatch(roomId);
  const playerColor = claimSeat(match, player);
  if (match.players.w && match.players.b) {
    startMatch(match);
  }
  return { roomId: match.roomId, playerColor, snapshot: buildSnapshot(match) };
}

function getMatchSnapshot(roomId) {
  try {
    return buildSnapshot(getOrThrowMatch(roomId));
  } catch (error) {
    return null;
  }
}

function applyMove({ roomId, player, move }) {
  const match = getOrThrowMatch(roomId);
  const playerColor = getSeatColor(match, player.playerKey);
  if (!playerColor) throw new Error("You are not a player in this match.");
  if (!match.players.w || !match.players.b || !match.matchStarted) throw new Error("Waiting for both players to join.");

  syncTimer(match);
  const status = getMatchStatus(match);
  if (status.over) throw new Error("This match is already over.");
  if (match.game.turn !== playerColor) throw new Error(`It is ${getSeatLabel(match.game.turn)}'s turn.`);

  const appliedMove = match.game.applyMove(move);
  finalizeMoveTimerState(match);
  touchMatch(match);
  return { roomId: match.roomId, playerColor, move: appliedMove, snapshot: buildSnapshot(match) };
}

function resignMatch({ roomId, player }) {
  const match = getOrThrowMatch(roomId);
  const playerColor = getSeatColor(match, player.playerKey);
  if (!playerColor) throw new Error("You are not a player in this match.");
  if (getMatchStatus(match).over) throw new Error("This match is already over.");

  match.players[playerColor] = null;
  match.game = new ChessGame();
  match.resultOverride = null;
  match.matchStarted = false;
  match.timerState = createTimerState(match.settings.timeControl);
  touchMatch(match);

  const roomDeleted = !match.players.w && !match.players.b;
  return {
    roomId: match.roomId,
    playerColor,
    roomDeleted,
    snapshot: roomDeleted ? null : buildSnapshot(match)
  };
}

function markDisconnected(playerKey) {
  const updatedRooms = [];

  for (const match of matches.values()) {
    let changed = false;

    if (match.players.w?.playerKey === playerKey && match.players.w.connected) {
      match.players.w.connected = false;
      changed = true;
    }

    if (match.players.b?.playerKey === playerKey && match.players.b.connected) {
      match.players.b.connected = false;
      changed = true;
    }

    if (changed) {
      touchMatch(match);
      updatedRooms.push(match.roomId);
    }
  }

  return updatedRooms;
}

function removeMatch(roomId) {
  matches.delete(normalizeRoomId(roomId));
}

function listMatches() {
  return Array.from(matches.values()).map((match) => ({
    roomId: match.roomId,
    roomName: match.roomName,
    connectedPlayers:
      (match.players.w?.connected ? 1 : 0) +
      (match.players.b?.connected ? 1 : 0),
    totalPlayers:
      (match.players.w ? 1 : 0) +
      (match.players.b ? 1 : 0),
    capacity: 2,
    matchStarted: Boolean(match.matchStarted)
  }));
}

module.exports = {
  createMatch,
  joinMatch,
  getMatchSnapshot,
  applyMove,
  resignMatch,
  markDisconnected,
  removeMatch,
  listMatches
};
