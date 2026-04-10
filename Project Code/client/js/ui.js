(function attachUiModule() {
  function updateMoveList(element, moves) {
    if (!element) return;
    element.innerHTML = "";
    element.classList.add("move-list-table");

    const header = document.createElement("li");
    header.className = "move-list-row move-list-header";

    const turnHeader = document.createElement("span");
    turnHeader.className = "move-list-turn";
    turnHeader.textContent = "#";

    const whiteHeader = document.createElement("span");
    whiteHeader.className = "move-list-white";
    whiteHeader.textContent = "White";

    const blackHeader = document.createElement("span");
    blackHeader.className = "move-list-black";
    blackHeader.textContent = "Black";

    header.append(turnHeader, whiteHeader, blackHeader);
    element.appendChild(header);

    for (let index = 0; index < moves.length; index += 2) {
      const row = document.createElement("li");
      row.className = "move-list-row";

      const turn = document.createElement("span");
      turn.className = "move-list-turn";
      turn.textContent = `${Math.floor(index / 2) + 1}.`;

      const whiteMove = document.createElement("span");
      whiteMove.className = "move-list-white";
      whiteMove.textContent = moves[index]?.san || `${moves[index]?.from}-${moves[index]?.to}` || "";

      const blackMove = document.createElement("span");
      blackMove.className = "move-list-black";
      blackMove.textContent = moves[index + 1]?.san || (moves[index + 1] ? `${moves[index + 1].from}-${moves[index + 1].to}` : "");

      row.append(turn, whiteMove, blackMove);
      element.appendChild(row);
    }
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
