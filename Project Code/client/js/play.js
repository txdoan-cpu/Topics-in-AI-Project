(function startPlayPage() {
  const boardElement = document.getElementById("board");
  if (!boardElement) return;
  const ACTIVE_GAME_STORAGE_KEY_PREFIX = "chessActiveGame";
  const SAVED_GAME_STORAGE_KEY_PREFIX = "chessSavedActiveGame";

  const statusText = document.getElementById("statusText");
  const moveList = document.getElementById("moveList");
  const startGameButton = document.getElementById("startGameButton");
  const loadGameButton = document.getElementById("loadGameButton");
  const retreatGameButton = document.getElementById("retreatGameButton");
  const saveButton = document.getElementById("saveButton");
  const gameMode = document.getElementById("gameMode");
  const savedHint = document.getElementById("savedHint");
  const logoutButton = document.getElementById("logoutButton");
  const difficultyValue = document.getElementById("difficultyValue");
  const timeValue = document.getElementById("timeValue");
  const whiteTimerCard = document.getElementById("whiteTimerCard");
  const blackTimerCard = document.getElementById("blackTimerCard");
  const whiteTimerValue = document.getElementById("whiteTimerValue");
  const blackTimerValue = document.getElementById("blackTimerValue");
  const { BrowserChessGame, ChessBoard, api, ui, storage } = window.ChessApp;
  const AI_PRESETS = {
    easy: { label: "Easy", algorithm: "greedy", algorithmLabel: "Greedy evaluation", depth: 1 },
    medium: { label: "Medium", algorithm: "minimax", algorithmLabel: "Minimax", depth: 2 },
    hard: { label: "Hard", algorithm: "alphabeta", algorithmLabel: "Alpha-beta pruning", depth: 3 }
  };
  const searchParams = new URLSearchParams(window.location.search);
  const sounds = {
    move: new Audio("/assets/audio/move.wav"),
    capture: new Audio("/assets/audio/capture.wav"),
    check: new Audio("/assets/audio/check.wav")
  };

  let game = new BrowserChessGame();
  let selectedSquare = null;
  let board = null;
  let currentAiSetup = null;
  let hasStarted = false;
  let timerState = null;
  let timerIntervalId = null;
  let currentUser = null;

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

  function saveActiveGame() {
    if (!hasStarted) {
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

    localStorage.setItem(getSavedGameStorageKey(), JSON.stringify({
      userId: currentUser?.user?.id || null,
      username: currentUser?.user?.username || null,
      mode: gameMode.value,
      gameState: game.serialize(),
      moveHistory: game.moveHistory,
      aiSetup: currentAiSetup,
      timerState: timerState ? { ...timerState } : null,
      savedAt: new Date().toISOString()
    }));
  }

  function clearActiveGame() {
    localStorage.removeItem(getActiveGameStorageKey());
  }

  function hasSavedGame() {
    return Boolean(readSavedGame());
  }

  function updateActionState() {
    startGameButton?.classList.toggle("is-hidden", hasStarted);
    loadGameButton?.classList.toggle("is-hidden", hasStarted);
    saveButton?.classList.toggle("is-hidden", !hasStarted);
    retreatGameButton?.classList.toggle("is-hidden", !hasStarted);
    if (gameMode) {
      gameMode.disabled = hasStarted;
    }
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

    const effectiveStatus = game.getStatus();
    if (effectiveStatus.over) {
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
    if (!hasStarted || !currentAiSetup?.sound) {
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
    if (!difficultyValue || !timeValue) {
      return;
    }

    if (gameMode.value !== "ai" || !currentAiSetup) {
      difficultyValue.textContent = "Local play";
      timeValue.textContent = "Not set";
      return;
    }

    difficultyValue.textContent = currentAiSetup.label;
    timeValue.textContent = `${currentAiSetup.time} minutes`;
  }

  function getBoardPiece(square) {
    return game.board[8 - Number(square[1])][square.charCodeAt(0) - 97];
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
    if (effectiveStatus.over) {
      stopTimerLoop();
      statusText.textContent = `${effectiveStatus.message}. Result: ${effectiveStatus.result}`;
    } else {
      const side = game.turn === "w" ? "White" : "Black";
      statusText.textContent = `${side} to move.${effectiveStatus.message === "Check" ? " Check." : ""}`;
    }
    ui.updateMoveList(moveList, game.moveHistory);
    updateTimerDisplay();
    updateActionState();
  }

  async function maybeMakeAiMove() {
    if (gameMode.value !== "ai" || !currentAiSetup || game.turn !== "b" || getEffectiveStatus().over) return;
    statusText.textContent = "AI is thinking...";
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
    render();
    playSound(game.getStatus().message === "Check" ? "check" : isCapture ? "capture" : "move");
  }

  async function handleSquareClick(square) {
    if (!hasStarted || getEffectiveStatus().over) {
      return;
    }

    const legalMoves = game.generateLegalMoves();
    const piece = getBoardPiece(square);

    if (!selectedSquare) {
      if (piece && piece.color === game.turn) {
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
        whitePlayer: "White",
        blackPlayer: gameMode.value === "ai" ? "AI" : "Black",
        result: status.result,
        mode: gameMode.value,
        settings: currentAiSetup ? {
          difficulty: currentAiSetup.label,
          timeControl: `${currentAiSetup.time} minutes`,
          boardTheme: currentAiSetup.theme || "classic",
          pieceModel: currentAiSetup.pieceModel || "standard",
          sound: currentAiSetup.sound ? "On" : "Off"
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

    statusText.textContent = "Game progress saved.";
    if (savedHint) {
      savedHint.textContent = "Saved progress is available through Load Game.";
    }
    updateActionState();
  }

  function resetGame(options = {}) {
    const { preserveStarted = false } = options;
    game = new BrowserChessGame();
    selectedSquare = null;
    hasStarted = preserveStarted;
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
      statusText.textContent = "Select a mode and press Start Game.";
      if (hasSavedGame() && savedHint) {
        savedHint.textContent = "Saved game found. Use Load Game to continue.";
      }
    }
  }

  function startGame() {
    if (gameMode.value === "ai") {
      window.location.assign("/ai-setup");
      return;
    }

    currentAiSetup = null;
    hasStarted = true;
    clearActiveGame();
    timerState = null;
    resetGame({ preserveStarted: true });
  }

  function loadGame() {
    const savedGame = readSavedGame();
    if (!savedGame?.gameState) {
      updateActionState();
      window.alert("Save game is not found!");
      return;
    }

    if (!window.confirm("Load the previously saved game? Any current unsaved progress will be replaced.")) {
      return;
    }

    game = new BrowserChessGame(savedGame.gameState);
    game.moveHistory = Array.isArray(savedGame.moveHistory) ? savedGame.moveHistory : [];
    gameMode.value = savedGame.mode === "ai" ? "ai" : "local";
    currentAiSetup = savedGame.aiSetup || null;
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

  function retreatGame() {
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
    gameMode.value = "ai";
    hasStarted = true;
    initializeTimer(currentAiSetup.time);
  }

  board = new ChessBoard(boardElement, { onSquareClick: handleSquareClick });

  if (currentAiSetup) {
    clearActiveGame();
    resetGame({ preserveStarted: true });
  }

  updateSettingsDisplay();
  updateTimerDisplay();
  if (!hasStarted) {
    statusText.textContent = "Select a mode and press Start Game.";
    if (hasSavedGame() && savedHint) {
      savedHint.textContent = "Saved game found. Use Load Game to continue.";
    }
  }
  render();

  startGameButton.addEventListener("click", startGame);
  loadGameButton?.addEventListener("click", loadGame);
  retreatGameButton?.addEventListener("click", retreatGame);
  saveButton.addEventListener("click", saveGame);
  gameMode.addEventListener("change", () => {
    if (gameMode.value !== "ai") {
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
    window.ChessApp.auth?.clearSession?.();
    window.location.replace("/");
  });
})();
