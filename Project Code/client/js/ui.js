(function attachUiModule() {
  let dialogElements = null;

  function ensureDialog() {
    if (dialogElements) {
      return dialogElements;
    }

    const overlay = document.createElement("div");
    overlay.className = "app-dialog-overlay is-hidden";
    overlay.innerHTML = `
      <div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle" aria-describedby="appDialogMessage">
        <div class="app-dialog-header">
          <h2 id="appDialogTitle" class="app-dialog-title">Chess Game</h2>
        </div>
        <div class="app-dialog-body">
          <p id="appDialogMessage" class="app-dialog-message"></p>
        </div>
        <div class="app-dialog-actions">
          <button type="button" class="button secondary app-dialog-cancel is-hidden">Cancel</button>
          <button type="button" class="button primary app-dialog-confirm">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    dialogElements = {
      overlay,
      title: overlay.querySelector(".app-dialog-title"),
      message: overlay.querySelector(".app-dialog-message"),
      cancel: overlay.querySelector(".app-dialog-cancel"),
      confirm: overlay.querySelector(".app-dialog-confirm")
    };

    return dialogElements;
  }

  function setDialogMessage(message) {
    const lines = String(message || "").split("\n");
    const content = lines.map((line) => line.trim()).filter(Boolean).join("\n\n") || " ";
    return content;
  }

  function openDialog({ title = "Chess Game", message = "", confirmLabel = "OK", cancelLabel = "Cancel", showCancel = false }) {
    const dialog = ensureDialog();

    dialog.title.textContent = title;
    dialog.message.textContent = setDialogMessage(message);
    dialog.confirm.textContent = confirmLabel;
    dialog.cancel.textContent = cancelLabel;
    dialog.cancel.classList.toggle("is-hidden", !showCancel);
    dialog.overlay.classList.remove("is-hidden");

    return new Promise((resolve) => {
      let settled = false;

      function finish(result) {
        if (settled) {
          return;
        }
        settled = true;
        dialog.overlay.classList.add("is-hidden");
        dialog.confirm.removeEventListener("click", handleConfirm);
        dialog.cancel.removeEventListener("click", handleCancel);
        dialog.overlay.removeEventListener("click", handleOverlayClick);
        document.removeEventListener("keydown", handleKeyDown);
        resolve(result);
      }

      function handleConfirm() {
        finish(true);
      }

      function handleCancel() {
        finish(false);
      }

      function handleOverlayClick(event) {
        if (event.target === dialog.overlay && showCancel) {
          finish(false);
        }
      }

      function handleKeyDown(event) {
        if (event.key === "Escape" && showCancel) {
          event.preventDefault();
          finish(false);
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
      }

      dialog.confirm.addEventListener("click", handleConfirm);
      dialog.cancel.addEventListener("click", handleCancel);
      dialog.overlay.addEventListener("click", handleOverlayClick);
      document.addEventListener("keydown", handleKeyDown);
      (showCancel ? dialog.cancel : dialog.confirm).focus();
    });
  }

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

  function showAlert(message, options = {}) {
    return openDialog({
      title: options.title || "Chess Game",
      message,
      confirmLabel: options.confirmLabel || "OK",
      showCancel: false
    });
  }

  function showConfirm(message, options = {}) {
    return openDialog({
      title: options.title || "Chess Game",
      message,
      confirmLabel: options.confirmLabel || "OK",
      cancelLabel: options.cancelLabel || "Cancel",
      showCancel: true
    });
  }

  window.ChessApp.ui = { updateMoveList, updateStatus, alert: showAlert, confirm: showConfirm };
})();
