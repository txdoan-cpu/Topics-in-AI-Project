(function startReplayPage() {
  const replayBoardElement = document.getElementById("replayBoard");
  if (!replayBoardElement) return;

  const replayTitle = document.getElementById("replayTitle");
  const replayMoves = document.getElementById("replayMoves");
  const prevMove = document.getElementById("prevMove");
  const nextMove = document.getElementById("nextMove");
  const { BrowserChessGame, ChessBoard, storage } = window.ChessApp;
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("id");

  let savedGame = null;
  let currentIndex = 0;
  let board = null;

  function buildReplayState(index) {
    const game = new BrowserChessGame();
    for (let i = 0; i < index; i += 1) {
      game.applyMove(savedGame.moves[i]);
    }
    return game;
  }

  function render() {
    const game = buildReplayState(currentIndex);
    board.setSelection(null, []);
    board.render(game.board);
    replayMoves.innerHTML = "";
    savedGame.moves.forEach((move, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${move.san}`;
      if (index === currentIndex - 1) item.style.fontWeight = "700";
      replayMoves.appendChild(item);
    });
    replayTitle.textContent = `${savedGame.whitePlayer} vs ${savedGame.blackPlayer} | ${savedGame.result}`;
    prevMove.disabled = currentIndex === 0;
    nextMove.disabled = currentIndex === savedGame.moves.length;
  }

  function loadGame() {
    if (!gameId) {
      replayTitle.textContent = "Missing game id.";
      return;
    }

    savedGame = storage.getGame(gameId);
    if (!savedGame) {
      replayTitle.textContent = "Saved game not found in browser storage.";
      return;
    }

    render();
  }

  board = new ChessBoard(replayBoardElement);
  prevMove.addEventListener("click", () => {
    currentIndex = Math.max(0, currentIndex - 1);
    if (savedGame) render();
  });
  nextMove.addEventListener("click", () => {
    if (!savedGame) return;
    currentIndex = Math.min(savedGame.moves.length, currentIndex + 1);
    render();
  });

  loadGame();
})();
