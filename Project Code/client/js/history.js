(function startHistoryPage() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  const { storage } = window.ChessApp;

  function loadGames() {
    const games = storage.listGames();
    if (!games.length) {
      historyList.innerHTML = "<p>No saved games yet. Finish a match on the play page and save it.</p>";
      return;
    }

    historyList.innerHTML = "";
    games.forEach((game) => {
      const card = document.createElement("article");
      card.className = "history-card";
      card.innerHTML = `
        <div>
          <strong>${game.whitePlayer} vs ${game.blackPlayer}</strong>
          <p>${game.mode.toUpperCase()} | ${game.result}</p>
          <p>${new Date(game.createdAt).toLocaleString()}</p>
        </div>
        <a class="button primary" href="/replay?id=${game.id}">Replay</a>
      `;
      historyList.appendChild(card);
    });
  }

  loadGames();
})();
