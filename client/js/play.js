(function startPlayPage() {
  const boardElement = document.getElementById("board");
  if (!boardElement) return;

  const statusText = document.getElementById("statusText");
  const moveList = document.getElementById("moveList");
  const resetButton = document.getElementById("resetButton");
  const saveButton = document.getElementById("saveButton");
  const gameMode = document.getElementById("gameMode");
  const savedHint = document.getElementById("savedHint");
  const { BrowserChessGame, ChessBoard, api, ui, storage } = window.ChessApp;

  let game = new BrowserChessGame();
  let selectedSquare = null;
  let board = null;

  function getBoardPiece(square) {
    return game.board[8 - Number(square[1])][square.charCodeAt(0) - 97];
  }

  function render() {
    const legalMoves = game.generateLegalMoves();
    const legalTargets = selectedSquare
      ? legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to)
      : [];
    board.setSelection(selectedSquare, legalTargets);
    board.render(game.board);
    ui.updateStatus(statusText, game);
    ui.updateMoveList(moveList, game.moveHistory);
  }

  async function maybeMakeAiMove() {
    if (gameMode.value !== "ai" || game.turn !== "b" || game.getStatus().over) return;
    statusText.textContent = "AI is thinking...";
    const { move } = await api.request("/api/ai/move", {
      method: "POST",
      body: JSON.stringify({ state: game.serialize(), depth: 2 })
    });
    game.applyMove(move);
    selectedSquare = null;
    render();
  }

  async function handleSquareClick(square) {
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

    game.applyMove(move);
    selectedSquare = null;
    render();

    try {
      await maybeMakeAiMove();
    } catch (error) {
      statusText.textContent = error.message;
    }
  }

  function saveGame() {
    const status = game.getStatus();
    if (!status.over) {
      statusText.textContent = "Finish the game before saving.";
      return;
    }

    const savedGame = storage.saveGame({
      whitePlayer: "White",
      blackPlayer: gameMode.value === "ai" ? "AI" : "Black",
      result: status.result,
      mode: gameMode.value,
      moves: game.moveHistory,
      finalFen: game.toFen()
    });

    statusText.textContent = "Game saved to browser history.";
    if (savedHint) {
      savedHint.innerHTML = `Last save ready in <a href="/replay?id=${savedGame.id}">replay viewer</a>.`;
    }
  }

  function resetGame() {
    game = new BrowserChessGame();
    selectedSquare = null;
    if (savedHint) {
      savedHint.textContent = "Completed games can be saved locally and replayed later.";
    }
    render();
  }

  board = new ChessBoard(boardElement, { onSquareClick: handleSquareClick });
  render();

  resetButton.addEventListener("click", resetGame);
  saveButton.addEventListener("click", saveGame);
  gameMode.addEventListener("change", resetGame);
})();
