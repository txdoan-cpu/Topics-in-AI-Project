(function startPlayPage() {
  const boardElement = document.getElementById("board");
  if (!boardElement) return;

  const ACTIVE_GAME_STORAGE_KEY_PREFIX = "chessActiveGame";
  const SAVED_GAME_STORAGE_KEY_PREFIX = "chessSavedActiveGame";
  const AI_PRESETS = {
    easy: { label: "Easy", algorithm: "greedy", depth: 1 },
    medium: { label: "Medium", algorithm: "minimax", depth: 2 },
    hard: { label: "Hard", algorithm: "alphabeta", depth: 3 }
  };

  const statusText = document.getElementById("statusText");
  const moveList = document.getElementById("moveList");
  const startGameButton = document.getElementById("startGameButton");
  const loadGameButton = document.getElementById("loadGameButton");
  const undoButton = document.getElementById("undoButton");
  const retreatGameButton = document.getElementById("retreatGameButton");
  const saveButton = document.getElementById("saveButton");
  const gameMode = document.getElementById("gameMode");
  const savedHint = document.getElementById("savedHint");
  const logoutButton = document.getElementById("logoutButton");
  const gameSettingsSection = document.querySelector(".game-settings");
  const difficultyValue = document.getElementById("difficultyValue");
  const timeValue = document.getElementById("timeValue");
  const whiteTimerCard = document.getElementById("whiteTimerCard");
  const blackTimerCard = document.getElementById("blackTimerCard");
  const whiteTimerValue = document.getElementById("whiteTimerValue");
  const blackTimerValue = document.getElementById("blackTimerValue");
  const onlinePanel = document.getElementById("onlinePanel");
  const roomList = document.getElementById("roomList");
  const createMatchButton = document.getElementById("createMatchButton");
  const joinMatchButton = document.getElementById("joinMatchButton");
  const connectionStatus = document.getElementById("connectionStatus");
  const playerColorValue = document.getElementById("playerColorValue");
  const onlineHint = document.getElementById("onlineHint");
  const whiteCaptured = document.getElementById("whiteCaptured");
  const blackCaptured = document.getElementById("blackCaptured");
  const { BrowserChessGame, ChessBoard, api, ui, storage, multiplayer } = window.ChessApp;
  const searchParams = new URLSearchParams(window.location.search);
  const sounds = {
    move: new Audio("/assets/audio/move.wav"),
    capture: new Audio("/assets/audio/capture.wav"),
    check: new Audio("/assets/audio/check.wav")
  };

  let game = new BrowserChessGame();
  let board = null;
  let selectedSquare = null;
  let currentAiSetup = null;
  let hasStarted = false;
  let timerState = null;
  let timerIntervalId = null;
  let currentUser = null;
  let suppressModeChange = false;
  let suppressOnlineDisconnectReset = false;
  let aiThinking = false;
  let undoStack = [];
  let lastGameAlertKey = null;

  const onlineState = {
    client: null,
    roomId: null,
    playerColor: null,
    connected: false,
    ready: false,
    rooms: []
  };

  function getLegacyActiveGameStorageKey() {
    return ACTIVE_GAME_STORAGE_KEY_PREFIX;
  }

  function getActiveGameStorageKey() {
    const userId = currentUser?.user?.id || currentUser?.user?.username;
    return userId ? `${ACTIVE_GAME_STORAGE_KEY_PREFIX}:${userId}` : getLegacyActiveGameStorageKey();
  }

  function getSavedGameStorageKey() {
    const userId = currentUser?.user?.id || currentUser?.user?.username;
    return userId ? `${SAVED_GAME_STORAGE_KEY_PREFIX}:${userId}` : SAVED_GAME_STORAGE_KEY_PREFIX;
  }

  function isOnlineMode() {
    return gameMode.value === "online";
  }

  function isAiMode() {
    return gameMode.value === "ai";
  }

  function getAiSetupFromQuery() {
    const difficultyKey = searchParams.get("difficulty");
    const time = searchParams.get("time");
    if (searchParams.get("mode") !== "ai" || !difficultyKey || !time || !AI_PRESETS[difficultyKey]) {
      return null;
    }

    return {
      difficulty: difficultyKey,
      time,
      theme: searchParams.get("theme") || "classic",
      pieceModel: searchParams.get("pieceModel") || "standard",
      sound: searchParams.get("sound") !== "off",
      ...AI_PRESETS[difficultyKey]
    };
  }

  function getOnlineRoomFromQuery() {
    const roomId = (searchParams.get("room") || "").trim().toUpperCase();
    return searchParams.get("mode") === "online" && roomId ? roomId : null;
  }

  function getOnlineCreateSetupFromQuery() {
    const roomName = String(searchParams.get("roomName") || "").trim();
    if (searchParams.get("mode") !== "online" || searchParams.get("create") !== "1" || !roomName) {
      return null;
    }

    return {
      roomName,
      time: String(searchParams.get("time") || "10"),
      theme: String(searchParams.get("theme") || "classic"),
      pieceModel: String(searchParams.get("pieceModel") || "standard"),
      sound: searchParams.get("sound") !== "off"
    };
  }

  function readActiveGame() {
    try {
      const scopedRaw = localStorage.getItem(getActiveGameStorageKey());
      if (scopedRaw) {
        return JSON.parse(scopedRaw);
      }

      const legacyRaw = localStorage.getItem(getLegacyActiveGameStorageKey());
      if (!legacyRaw) {
        return null;
      }

      const legacyGame = JSON.parse(legacyRaw);
      if (legacyGame?.userId && currentUser?.user?.id && legacyGame.userId !== currentUser.user.id) {
        return null;
      }
      return legacyGame;
    } catch (error) {
      return null;
    }
  }

  function readSavedGame() {
    try {
      const raw = localStorage.getItem(getSavedGameStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function hasSavedGame() {
    return Boolean(readSavedGame());
  }

  function captureUndoSnapshot() {
    return {
      gameState: game.serialize(),
      moveHistory: game.moveHistory.map((move) => ({ ...move })),
      timerState: timerState ? { ...timerState, lastTickAt: null } : null,
      aiSetup: currentAiSetup ? { ...currentAiSetup } : null
    };
  }

  function restoreUndoSnapshot(snapshot) {
    if (!snapshot?.gameState) {
      return;
    }

    game = new BrowserChessGame(snapshot.gameState);
    game.moveHistory = Array.isArray(snapshot.moveHistory) ? snapshot.moveHistory : [];
    currentAiSetup = snapshot.aiSetup ? { ...snapshot.aiSetup } : currentAiSetup;
    timerState = snapshot.timerState ? { ...snapshot.timerState, lastTickAt: null } : null;
    selectedSquare = null;
    aiThinking = false;
    lastGameAlertKey = null;
    stopTimerLoop();
    if (timerState) {
      startTimerLoop();
    } else {
      updateTimerDisplay();
    }
    saveActiveGame();
    render();
  }

  function saveActiveGame() {
    if (!hasStarted || isOnlineMode()) {
      return;
    }

    localStorage.setItem(getActiveGameStorageKey(), JSON.stringify({
      userId: currentUser?.user?.id || null,
      username: currentUser?.user?.username || null,
      mode: gameMode.value,
      gameState: game.serialize(),
      moveHistory: game.moveHistory,
      aiSetup: currentAiSetup,
      timerState: timerState ? { ...timerState } : null
    }));
  }

  function saveSavedGame() {
    if (!hasStarted) {
      return;
    }

    const payload = isOnlineMode()
      ? {
          userId: currentUser?.user?.id || null,
          username: currentUser?.user?.username || null,
          mode: "online",
          roomId: onlineState.roomId,
          playerColor: onlineState.playerColor,
          gameState: game.serialize(),
          moveHistory: game.moveHistory,
          savedAt: new Date().toISOString()
        }
      : {
          userId: currentUser?.user?.id || null,
          username: currentUser?.user?.username || null,
          mode: gameMode.value,
          gameState: game.serialize(),
          moveHistory: game.moveHistory,
          aiSetup: currentAiSetup,
          timerState: timerState ? { ...timerState } : null,
          savedAt: new Date().toISOString()
        };

    localStorage.setItem(getSavedGameStorageKey(), JSON.stringify(payload));
  }

  function clearActiveGame() {
    localStorage.removeItem(getActiveGameStorageKey());
  }

  function formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function updateTimerDisplay() {
    if (!whiteTimerValue || !blackTimerValue || !whiteTimerCard || !blackTimerCard) {
      return;
    }

    if (!timerState) {
      whiteTimerValue.textContent = "--:--";
      blackTimerValue.textContent = "--:--";
      whiteTimerCard.classList.remove("is-active", "is-expired");
      blackTimerCard.classList.remove("is-active", "is-expired");
      return;
    }

    whiteTimerValue.textContent = formatTime(timerState.whiteMs);
    blackTimerValue.textContent = formatTime(timerState.blackMs);
    whiteTimerCard.classList.toggle("is-active", hasStarted && game.turn === "w" && !timerState.expiredColor);
    blackTimerCard.classList.toggle("is-active", hasStarted && game.turn === "b" && !timerState.expiredColor);
    whiteTimerCard.classList.toggle("is-expired", timerState.expiredColor === "w");
    blackTimerCard.classList.toggle("is-expired", timerState.expiredColor === "b");
  }

  function stopTimerLoop() {
    if (timerIntervalId) {
      window.clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    if (timerState) {
      timerState.lastTickAt = null;
    }
  }

  function getEffectiveStatus() {
    if (timerState?.expiredColor) {
      return {
        over: true,
        result: timerState.expiredColor === "w" ? "0-1" : "1-0",
        message: `${timerState.expiredColor === "w" ? "White" : "Black"} ran out of time`
      };
    }

    return game.getStatus();
  }

  function getOutcomeLabel(status) {
    if (!status?.over) {
      return null;
    }

    if (status.result === "1/2-1/2") {
      return "Draw";
    }

    if (!isOnlineMode() && isAiMode()) {
      return status.result === "1-0" ? "Win" : "Loss";
    }

    if (isOnlineMode() && onlineState.playerColor) {
      const playerWon =
        (onlineState.playerColor === "w" && status.result === "1-0") ||
        (onlineState.playerColor === "b" && status.result === "0-1");
      return playerWon ? "Win" : "Loss";
    }

    return status.message === "Checkmate" ? `Checkmate. ${status.result === "1-0" ? "White" : "Black"} wins` : status.message;
  }

  function notifyGameState(status) {
    if (!hasStarted) {
      return;
    }

    const alertKey = `${game.toFen()}|${status.message}|${status.result || ""}`;
    if (alertKey === lastGameAlertKey) {
      return;
    }

    let message = "";
    if (status.over) {
      const outcome = getOutcomeLabel(status);
      message = outcome === "Draw" ? "Draw" : outcome;
    } else if (status.message === "Check") {
      message = "Check";
    }

    if (!message) {
      return;
    }

    lastGameAlertKey = alertKey;
    window.alert(message);
  }

  function syncTimerTurn() {
    if (!timerState || timerState.expiredColor || !hasStarted) {
      return;
    }
    timerState.lastTickAt = Date.now();
    updateTimerDisplay();
  }

  function handleTimeout(expiredColor) {
    if (!timerState || timerState.expiredColor) {
      return;
    }

    timerState.expiredColor = expiredColor;
    timerState.lastTickAt = null;
    stopTimerLoop();
    selectedSquare = null;
    updateTimerDisplay();
    render();
  }

  function tickTimer() {
    if (!timerState || timerState.expiredColor || !hasStarted) {
      return;
    }

    if (game.getStatus().over) {
      stopTimerLoop();
      updateTimerDisplay();
      return;
    }

    const now = Date.now();
    const elapsed = now - (timerState.lastTickAt || now);
    timerState.lastTickAt = now;

    if (game.turn === "w") {
      timerState.whiteMs = Math.max(0, timerState.whiteMs - elapsed);
      if (timerState.whiteMs === 0) {
        handleTimeout("w");
        return;
      }
    } else {
      timerState.blackMs = Math.max(0, timerState.blackMs - elapsed);
      if (timerState.blackMs === 0) {
        handleTimeout("b");
        return;
      }
    }

    updateTimerDisplay();
  }

  function startTimerLoop() {
    if (!timerState || timerState.expiredColor || !hasStarted) {
      updateTimerDisplay();
      return;
    }

    syncTimerTurn();
    if (timerIntervalId) {
      return;
    }

    timerIntervalId = window.setInterval(tickTimer, 250);
  }

  function initializeTimer(minutes) {
    if (!minutes) {
      timerState = null;
      stopTimerLoop();
      updateTimerDisplay();
      return;
    }

    const milliseconds = Number(minutes) * 60 * 1000;
    timerState = {
      whiteMs: milliseconds,
      blackMs: milliseconds,
      lastTickAt: null,
      expiredColor: null
    };
    startTimerLoop();
  }

  function playSound(name) {
    if (!hasStarted || !currentAiSetup?.sound || isOnlineMode()) {
      return;
    }

    const sound = sounds[name];
    if (!sound) {
      return;
    }

    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function applyBoardAppearance() {
    const theme = currentAiSetup?.theme || "classic";
    const pieceModel = currentAiSetup?.pieceModel || "standard";

    boardElement.classList.remove("board-theme-classic", "board-theme-dark", "board-theme-light");
    boardElement.classList.add(`board-theme-${theme}`);
    board?.setPieceModel(pieceModel);
  }

  function updateSettingsDisplay() {
    gameSettingsSection?.classList.toggle("is-hidden", isOnlineMode());

    if (!difficultyValue || !timeValue) {
      return;
    }

    if (isOnlineMode()) {
      difficultyValue.textContent = "Realtime match";
      timeValue.textContent = currentAiSetup?.time ? `${currentAiSetup.time} minutes` : (onlineState.roomId || "Join a room");
      return;
    }

    if (!isAiMode() || !currentAiSetup) {
      difficultyValue.textContent = "Local play";
      timeValue.textContent = "Not set";
      return;
    }

    difficultyValue.textContent = currentAiSetup.label;
    timeValue.textContent = `${currentAiSetup.time} minutes`;
  }

  function updateOnlineControls() {
    const onlineMode = isOnlineMode();
    onlinePanel?.classList.toggle("is-hidden", !onlineMode);
    createMatchButton?.classList.toggle("is-hidden", !onlineMode || onlineState.connected);
    joinMatchButton?.classList.add("is-hidden");

    if (connectionStatus) {
      connectionStatus.textContent = onlineState.connected ? "Connected" : "Offline";
      connectionStatus.classList.toggle("is-live", onlineState.connected);
      connectionStatus.classList.toggle("is-offline", !onlineState.connected);
    }

    if (playerColorValue) {
      playerColorValue.textContent = onlineState.playerColor
        ? (onlineState.playerColor === "w" ? "White" : "Black")
        : "No color";
    }

    if (onlineHint && onlineMode && !hasStarted) {
      onlineHint.textContent = onlineState.roomId
        ? `Room ${onlineState.roomId} is ready. Share it with another player or join it from another tab.`
        : "Create a room or join an existing room to play live.";
    }

    retreatGameButton.textContent = onlineMode ? "Resign Match" : "Retreat Game";
    renderRoomList();
  }

  function renderRoomList() {
    if (!roomList) {
      return;
    }

    roomList.innerHTML = "";

    if (!onlineState.rooms.length) {
      const empty = document.createElement("div");
      empty.className = "room-list-empty";
      empty.textContent = "No rooms available.";
      roomList.appendChild(empty);
      return;
    }

    onlineState.rooms.forEach((room) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "room-list-item";
      if (room.connectedPlayers >= room.capacity) {
        button.classList.add("is-full");
      }
      button.disabled = isOnlineMode() && onlineState.connected;

      const details = document.createElement("span");
      const name = document.createElement("span");
      name.className = "room-list-name";
      name.textContent = room.roomName || room.roomId;
      const meta = document.createElement("span");
      meta.className = "room-list-meta";
      meta.textContent = room.roomId;
      details.append(name, meta);

      const count = document.createElement("span");
      count.className = "room-list-count";
      count.textContent = `${room.connectedPlayers}/${room.capacity}`;

      button.append(details, count);
      button.addEventListener("click", async () => {
        if (room.connectedPlayers >= room.capacity) {
          window.alert("Room is already full.");
          statusText.textContent = "Room is already full.";
          return;
        }

        try {
          await joinOnlineMatch(room.roomId);
        } catch (error) {
          statusText.textContent = error.message;
        }
      });
      roomList.appendChild(button);
    });
  }

  function updateActionState() {
    if (isOnlineMode()) {
      startGameButton?.classList.add("is-hidden");
      loadGameButton?.classList.add("is-hidden");
      undoButton?.classList.add("is-hidden");
      saveButton?.classList.add("is-hidden");
      retreatGameButton?.classList.toggle("is-hidden", !onlineState.connected);
      retreatGameButton.disabled = !onlineState.connected;
      if (gameMode) {
        gameMode.disabled = hasStarted;
      }
      updateOnlineControls();
      return;
    }

    startGameButton?.classList.toggle("is-hidden", hasStarted);
    loadGameButton?.classList.toggle("is-hidden", hasStarted);
    undoButton?.classList.toggle("is-hidden", !isAiMode() || !hasStarted);
    if (undoButton) {
      undoButton.disabled = !isAiMode() || !hasStarted || undoStack.length === 0 || aiThinking;
    }
    saveButton?.classList.toggle("is-hidden", !hasStarted);
    retreatGameButton?.classList.toggle("is-hidden", !hasStarted);
    retreatGameButton.disabled = !hasStarted;
    if (gameMode) {
      gameMode.disabled = hasStarted;
    }
    updateOnlineControls();
  }

  function getBoardPiece(square) {
    return game.board[8 - Number(square[1])][square.charCodeAt(0) - 97];
  }

  function getCapturedPieces() {
    return game.moveHistory.reduce((captured, move, index) => {
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

  function renderCapturedPieces() {
    const captured = getCapturedPieces();
    const pieceSet = window.ChessApp.pieceSets.classic;

    function renderList(element, pieces, color) {
      if (!element) {
        return;
      }

      element.innerHTML = "";
      pieces.forEach((piece) => {
        const chip = document.createElement("span");
        chip.className = "capture-piece";
        chip.textContent = pieceSet[`${color}${piece}`];
        element.appendChild(chip);
      });
    }

    renderList(whiteCaptured, captured.white, "b");
    renderList(blackCaptured, captured.black, "w");
  }

  function buildStatusText() {
    const effectiveStatus = getEffectiveStatus();
    if (effectiveStatus.over) {
      return `${effectiveStatus.message}. Result: ${effectiveStatus.result}`;
    }

    if (isOnlineMode()) {
      if (!onlineState.playerColor) {
        return "Join a room to receive a color assignment.";
      }

      if (!onlineState.ready) {
        return "Waiting for the second player to join the room.";
      }

      const side = game.turn === "w" ? "White" : "Black";
      const suffix = effectiveStatus.message === "Check" ? " Check." : "";
      return `${side} to move.${suffix} ${onlineState.playerColor === game.turn ? "Your move." : "Waiting for your opponent."}`.trim();
    }

    const side = game.turn === "w" ? "White" : "Black";
    return `${side} to move.${effectiveStatus.message === "Check" ? " Check." : ""}`;
  }

  function render() {
    if (!board) {
      applyBoardAppearance();
      updateActionState();
      return;
    }

    applyBoardAppearance();
    const legalMoves = game.generateLegalMoves();
    const legalTargets = selectedSquare
      ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to)
      : [];

    board.setSelection(selectedSquare, legalTargets);
    board.render(game.board);
    const effectiveStatus = getEffectiveStatus();
    statusText.textContent = buildStatusText();
    ui.updateMoveList(moveList, game.moveHistory);
    renderCapturedPieces();
    updateTimerDisplay();
    updateSettingsDisplay();
    updateActionState();
    notifyGameState(effectiveStatus);
  }

  async function maybeMakeAiMove() {
    if (!isAiMode() || !currentAiSetup || game.turn !== "b" || getEffectiveStatus().over) {
      return;
    }

    aiThinking = true;
    render();
    statusText.textContent = "AI is thinking...";
    try {
      const { move } = await api.request("/api/ai/move", {
        method: "POST",
        body: JSON.stringify({
          state: game.serialize(),
          depth: currentAiSetup.depth,
          algorithm: currentAiSetup.algorithm
        })
      });

      const isCapture = Boolean(move.captured);
      game.applyMove(move);
      syncTimerTurn();
      selectedSquare = null;
      playSound(game.getStatus().message === "Check" ? "check" : isCapture ? "capture" : "move");
    } finally {
      aiThinking = false;
      render();
    }
  }

  async function handleOnlineMove(move) {
    if (!onlineState.client || !onlineState.roomId) {
      statusText.textContent = "Join a room before moving.";
      return;
    }

    await onlineState.client.sendMove(onlineState.roomId, move);
    selectedSquare = null;
    render();
  }

  async function handleSquareClick(square) {
    if (!hasStarted || getEffectiveStatus().over) {
      return;
    }

    if (isOnlineMode()) {
      if (!onlineState.playerColor) {
        statusText.textContent = "This match needs a player assignment.";
        return;
      }

      if (onlineState.playerColor !== game.turn) {
        statusText.textContent = "It is not your turn.";
        return;
      }
    }

    const legalMoves = game.generateLegalMoves();
    const piece = getBoardPiece(square);

    if (!selectedSquare) {
      if (piece && piece.color === game.turn && (!isOnlineMode() || piece.color === onlineState.playerColor)) {
        selectedSquare = square;
        render();
      }
      return;
    }

    const move = legalMoves.find((candidate) => candidate.from === selectedSquare && candidate.to === square);
    if (!move) {
      selectedSquare = piece && piece.color === game.turn ? square : null;
      render();
      return;
    }

    if (isOnlineMode()) {
      try {
        await handleOnlineMove(move);
      } catch (error) {
        statusText.textContent = error.message;
      }
      return;
    }

    if (isAiMode()) {
      undoStack.push(captureUndoSnapshot());
    }

    const isCapture = Boolean(move.captured);
    game.applyMove(move);
    syncTimerTurn();
    selectedSquare = null;
    render();
    playSound(game.getStatus().message === "Check" ? "check" : isCapture ? "capture" : "move");

    try {
      await maybeMakeAiMove();
      saveActiveGame();
    } catch (error) {
      aiThinking = false;
      statusText.textContent = error.message;
      render();
    }
  }

  function setOnlineRoute(roomId) {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "online");
    url.searchParams.set("room", roomId);
    window.history.replaceState({}, "", url);
  }

  function clearOnlineRoute() {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url);
  }

  function setModeValue(mode) {
    suppressModeChange = true;
    gameMode.value = mode;
    suppressModeChange = false;
  }

  function disconnectOnlineClient() {
    onlineState.client?.disconnect();
    onlineState.client = null;
    onlineState.connected = false;
    updateOnlineControls();
  }

  function resetOnlineMatchState(options = {}) {
    const { keepRoomId = true, statusMessage = "Create or join a room to start a real-time match." } = options;

    selectedSquare = null;
    hasStarted = false;
    stopTimerLoop();
    timerState = null;
    game = new BrowserChessGame();
    currentAiSetup = null;
    onlineState.connected = false;
    onlineState.playerColor = null;
    onlineState.ready = false;

    if (!keepRoomId) {
      onlineState.roomId = null;
      clearOnlineRoute();
    }

    if (savedHint) {
      savedHint.textContent = "Completed games can be saved locally and replayed later.";
    }

    if (onlineHint) {
      onlineHint.textContent = onlineState.roomId
        ? `Room ${onlineState.roomId} is available. Join to continue the live match.`
        : "Create a room or join an existing room to play live.";
    }

    statusText.textContent = statusMessage;
    updateSettingsDisplay();
    render();
  }

  function handleOnlineMatchEnded(payload) {
    const resignedColor = payload?.resignedColor || null;
    const wasCurrentPlayer = Boolean(onlineState.playerColor) && onlineState.playerColor === resignedColor;

    suppressOnlineDisconnectReset = true;
    disconnectOnlineClient();
    resetOnlineMatchState({
      keepRoomId: false,
      statusMessage: wasCurrentPlayer
        ? "You resigned from the online match."
        : "Your opponent resigned from the online match."
    });

    if (wasCurrentPlayer) {
      window.alert("You have resigned the match.");
    } else {
      window.alert("Your opponent has resigned the match.");
    }

    ensureOnlineClient().listRooms().catch(() => {});
  }

  function handleOnlineMatchResigned(payload) {
    if (!payload?.snapshot) {
      return;
    }

    applyOnlineSnapshot(payload.snapshot, { replaceUrl: true });
    statusText.textContent = "Your opponent resigned. Waiting for a new player to join.";
    window.alert("Your opponent has resigned the match.");
    ensureOnlineClient().listRooms().catch(() => {});
  }

  function applyOnlineSnapshot(snapshot, options = {}) {
    game = new BrowserChessGame(snapshot.gameState);
    game.moveHistory = Array.isArray(snapshot.moveHistory) ? snapshot.moveHistory : game.moveHistory;
    currentAiSetup = snapshot.settings ? {
      time: String(snapshot.settings.timeControl),
      theme: snapshot.settings.boardTheme,
      pieceModel: snapshot.settings.pieceModel,
      sound: snapshot.settings.sound !== false
    } : null;
    selectedSquare = null;
    hasStarted = Boolean(snapshot.matchStarted);
    timerState = snapshot.timerState ? { ...snapshot.timerState } : null;
    stopTimerLoop();
    setModeValue("online");
    onlineState.roomId = snapshot.roomId;
    onlineState.ready = Boolean(snapshot.ready);

    if (savedHint) {
      const whiteName = snapshot.players.white?.username || "White";
      const blackName = snapshot.players.black?.username || "Black";
      savedHint.textContent = `${whiteName} vs ${blackName} in room ${snapshot.roomId}.`;
    }

    if (onlineHint) {
      onlineHint.textContent = snapshot.ready
        ? `Room ${snapshot.roomName || snapshot.roomId} is live.`
        : `Room ${snapshot.roomName || snapshot.roomId} is waiting for the second player.`;
    }

    if (options.replaceUrl !== false) {
      setOnlineRoute(snapshot.roomId);
    }

    if (hasStarted && timerState) {
      startTimerLoop();
    } else {
      updateTimerDisplay();
    }
    updateSettingsDisplay();
    render();
  }

  function ensureOnlineClient() {
    if (onlineState.client) {
      return onlineState.client;
    }

    onlineState.client = multiplayer.createClient({
      token: currentUser.token,
      onSnapshot(snapshot) {
        applyOnlineSnapshot(snapshot);
      },
      onStatusChange({ connected }) {
        onlineState.connected = connected;
        if (!connected && suppressOnlineDisconnectReset) {
          suppressOnlineDisconnectReset = false;
          updateOnlineControls();
          return;
        }
        if (!connected && isOnlineMode()) {
          resetOnlineMatchState({
            keepRoomId: true,
            statusMessage: "You are disconnected from the online match."
          });
          return;
        }
        updateOnlineControls();
      },
      onError(message) {
        statusText.textContent = message;
      },
      onMatchEnded(payload) {
        handleOnlineMatchEnded(payload);
      },
      onMatchResigned(payload) {
        handleOnlineMatchResigned(payload);
      },
      onRoomList(rooms) {
        onlineState.rooms = rooms;
        updateOnlineControls();
      }
    });

    return onlineState.client;
  }

  async function createOnlineMatch(setup) {
    try {
      const client = ensureOnlineClient();
      const result = await client.createMatch(setup?.roomName || "", {
        timeControl: Number(setup?.time || 10),
        boardTheme: setup?.theme || "classic",
        pieceModel: setup?.pieceModel || "standard",
        sound: setup?.sound !== false
      });
      onlineState.roomId = result.roomId;
      onlineState.playerColor = result.playerColor;
      currentAiSetup = {
        time: String(setup?.time || "10"),
        theme: setup?.theme || "classic",
        pieceModel: setup?.pieceModel || "standard",
        sound: setup?.sound !== false
      };
      applyOnlineSnapshot(result.snapshot);
    } catch (error) {
      statusText.textContent = error.message;
    }
  }

  async function joinOnlineMatch(roomId) {
    const targetRoomId = String(roomId || "").trim().toUpperCase();
    if (!targetRoomId) {
      statusText.textContent = "Select a room to join.";
      return;
    }

    try {
      const client = ensureOnlineClient();
      const result = await client.joinMatch(targetRoomId);
      onlineState.roomId = result.roomId;
      onlineState.playerColor = result.playerColor;
      applyOnlineSnapshot(result.snapshot);
    } catch (error) {
      statusText.textContent = error.message;
    }
  }

  function saveGame() {
    if (!hasStarted) {
      statusText.textContent = "Start a game before saving.";
      return;
    }

    saveSavedGame();
    const status = getEffectiveStatus();

    if (status.over) {
      const savedGame = storage.saveGame({
        whitePlayer: isOnlineMode() ? (onlineState.roomId ? `${onlineState.roomId} White` : "White") : "White",
        blackPlayer: isOnlineMode()
          ? (onlineState.roomId ? `${onlineState.roomId} Black` : "Black")
          : (isAiMode() ? "AI" : "Black"),
        result: status.result,
        mode: gameMode.value,
        settings: currentAiSetup ? {
          difficulty: currentAiSetup.label,
          timeControl: `${currentAiSetup.time} minutes`
        } : null,
        moves: game.moveHistory,
        finalFen: game.toFen()
      });

      statusText.textContent = "Game saved.";
      if (savedHint) {
        savedHint.innerHTML = `Game saved. Replay available in <a href="/replay?id=${savedGame.id}">viewer</a>.`;
      }
      return;
    }

    statusText.textContent = isOnlineMode() ? "Match bookmark saved." : "Game progress saved.";
    if (savedHint) {
      savedHint.textContent = isOnlineMode()
        ? "Saved match can be restored with Load Game."
        : "Saved progress is available through Load Game.";
    }
    updateActionState();
  }

  function resetGame(options = {}) {
    const { preserveStarted = false } = options;
    game = new BrowserChessGame();
    selectedSquare = null;
    hasStarted = preserveStarted;
    undoStack = [];
    aiThinking = false;
    lastGameAlertKey = null;
    stopTimerLoop();

    if (preserveStarted && currentAiSetup?.time) {
      initializeTimer(currentAiSetup.time);
    } else {
      timerState = null;
      updateTimerDisplay();
    }

    if (savedHint) {
      savedHint.textContent = "Completed games can be saved locally and replayed later.";
    }

    updateSettingsDisplay();
    render();

    if (!hasStarted) {
      statusText.textContent = isOnlineMode()
        ? "Create or join a room to start a real-time match."
        : "Select a mode and press Start Game.";

      if (hasSavedGame() && savedHint) {
        savedHint.textContent = "Saved game found. Use Load Game to continue.";
      }
    }
  }

  function startGame() {
    if (isAiMode()) {
      window.location.assign("/ai-setup");
      return;
    }

    currentAiSetup = null;
    hasStarted = true;
    clearActiveGame();
    timerState = null;
    resetGame({ preserveStarted: true });
  }

  function undoLastAiTurn() {
    if (!isAiMode() || !hasStarted || aiThinking || undoStack.length === 0) {
      return;
    }

    const snapshot = undoStack.pop();
    restoreUndoSnapshot(snapshot);
    statusText.textContent = "Last move undone.";
  }

  async function loadGame() {
    const savedGame = readSavedGame();
    if (!savedGame) {
      updateActionState();
      window.alert("Save game is not found!");
      return;
    }

    if (!window.confirm("Load the previously saved game? Any current unsaved progress will be replaced.")) {
      return;
    }

    if (savedGame.mode === "online" && savedGame.roomId) {
      setModeValue("online");
      await joinOnlineMatch(savedGame.roomId);
      return;
    }

    game = new BrowserChessGame(savedGame.gameState);
    game.moveHistory = Array.isArray(savedGame.moveHistory) ? savedGame.moveHistory : [];
    setModeValue(savedGame.mode === "ai" ? "ai" : "local");
    currentAiSetup = savedGame.aiSetup || null;
    undoStack = [];
    aiThinking = false;
    lastGameAlertKey = null;
    timerState = savedGame.timerState
      ? { ...savedGame.timerState, lastTickAt: null }
      : (currentAiSetup?.time ? {
          whiteMs: Number(currentAiSetup.time) * 60 * 1000,
          blackMs: Number(currentAiSetup.time) * 60 * 1000,
          lastTickAt: null,
          expiredColor: null
        } : null);
    selectedSquare = null;
    hasStarted = true;
    if (savedHint) {
      savedHint.textContent = `Saved game loaded${savedGame.username ? ` for ${savedGame.username}` : ""}.`;
    }
    saveActiveGame();
    updateSettingsDisplay();
    startTimerLoop();
    render();
  }

  async function retreatGame() {
    if (isOnlineMode()) {
      if (!window.confirm("Confirm Resignation\n\nAre you sure you want to resign this match?")) {
        return;
      }

      try {
        await onlineState.client?.resign(onlineState.roomId);
        suppressOnlineDisconnectReset = true;
        disconnectOnlineClient();
        resetOnlineMatchState({
          keepRoomId: false,
          statusMessage: "You resigned from the online match."
        });
        window.alert("You have resigned the match.");
        ensureOnlineClient().listRooms().catch(() => {});
      } catch (error) {
        statusText.textContent = error.message;
      }
      return;
    }

    if (!window.confirm("Retreat the current game and return to the not-started state?")) {
      return;
    }

    clearActiveGame();
    currentAiSetup = null;
    resetGame({ preserveStarted: false });
  }

  const existingSession = window.ChessApp.auth?.readSession?.();
  if (!existingSession?.token) {
    window.location.replace("/?auth=required");
    return;
  }

  currentUser = existingSession;
  currentAiSetup = getAiSetupFromQuery();

  if (currentAiSetup) {
    setModeValue("ai");
    hasStarted = true;
    initializeTimer(currentAiSetup.time);
  } else if (getOnlineRoomFromQuery()) {
    setModeValue("online");
  }

  board = new ChessBoard(boardElement, { onSquareClick: handleSquareClick });

  if (currentAiSetup) {
    clearActiveGame();
    resetGame({ preserveStarted: true });
  } else {
    const activeGame = readActiveGame();
    if (activeGame?.gameState && !getOnlineRoomFromQuery()) {
      game = new BrowserChessGame(activeGame.gameState);
      game.moveHistory = Array.isArray(activeGame.moveHistory) ? activeGame.moveHistory : [];
      setModeValue(activeGame.mode === "ai" ? "ai" : "local");
      currentAiSetup = activeGame.aiSetup || null;
      timerState = activeGame.timerState ? { ...activeGame.timerState, lastTickAt: null } : null;
      hasStarted = true;
      startTimerLoop();
    }
  }

  updateSettingsDisplay();
  updateTimerDisplay();
  if (!hasStarted) {
    statusText.textContent = isOnlineMode()
      ? "Create or join a room to start a real-time match."
      : "Select a mode and press Start Game.";
    if (hasSavedGame() && savedHint) {
      savedHint.textContent = "Saved game found. Use Load Game to continue.";
    }
  }
  render();

  startGameButton.addEventListener("click", startGame);
  loadGameButton?.addEventListener("click", () => { loadGame(); });
  undoButton?.addEventListener("click", undoLastAiTurn);
  retreatGameButton?.addEventListener("click", () => { retreatGame(); });
  saveButton.addEventListener("click", saveGame);
  createMatchButton?.addEventListener("click", () => {
    window.location.assign("/online-setup");
  });
  joinMatchButton?.addEventListener("click", () => { joinOnlineMatch(); });

  gameMode.addEventListener("change", () => {
    if (suppressModeChange) {
      return;
    }

    selectedSquare = null;

    if (isOnlineMode()) {
      currentAiSetup = null;
      hasStarted = false;
      timerState = null;
      clearActiveGame();
      resetGame({ preserveStarted: false });
      ensureOnlineClient().listRooms().catch(() => {});
      return;
    }

    disconnectOnlineClient();
    clearOnlineRoute();

    if (!isAiMode()) {
      currentAiSetup = null;
    }

    updateSettingsDisplay();
    if (!hasStarted) {
      render();
    }
  });

  logoutButton?.addEventListener("click", async () => {
    try {
      await api.request("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // Clear local state even if the cookie was already invalid.
    }

    disconnectOnlineClient();
    window.ChessApp.auth?.clearSession?.();
    window.location.replace("/");
  });

  const createSetupFromQuery = getOnlineCreateSetupFromQuery();
  const roomFromQuery = getOnlineRoomFromQuery();
  if (createSetupFromQuery) {
    setModeValue("online");
    createOnlineMatch(createSetupFromQuery);
  } else if (roomFromQuery) {
    joinOnlineMatch(roomFromQuery);
  } else if (isOnlineMode()) {
    ensureOnlineClient().listRooms().catch(() => {});
  }
})();
