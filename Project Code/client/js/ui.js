(function attachUiModule() {
  function updateMoveList(element, moves) {
    if (!element) return;
    element.innerHTML = "";
    moves.forEach((move, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${move.san || `${move.from}-${move.to}`}`;
      element.appendChild(item);
    });
  }

  function updateStatus(element, gameState) {
    if (!element) return;
    const status = gameState.getStatus();
    if (status.over) {
      element.textContent = `${status.message}. Result: ${status.result}`;
      return;
    }
    const side = gameState.turn === "w" ? "White" : "Black";
    element.textContent = `${side} to move. ${status.message === "Check" ? "Check." : ""}`.trim();
  }

  window.ChessApp.ui = { updateMoveList, updateStatus };
})();

