window.ChessApp = window.ChessApp || {};

const STORAGE_KEY = "chessSavedGames";

window.ChessApp.api = {
  async request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }
};

window.ChessApp.storage = {
  listGames() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const games = raw ? JSON.parse(raw) : [];
      return Array.isArray(games) ? games : [];
    } catch (error) {
      return [];
    }
  },

  getGame(gameId) {
    return this.listGames().find((game) => game.id === gameId) || null;
  },

  saveGame(game) {
    const games = this.listGames();
    const savedGame = {
      id: game.id || (window.crypto?.randomUUID?.() || `game-${Date.now()}`),
      createdAt: game.createdAt || new Date().toISOString(),
      ...game
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([savedGame, ...games]));
    return savedGame;
  }
};

window.ChessApp.pieces = {
  wp: "\u2659",
  wn: "\u2658",
  wb: "\u2657",
  wr: "\u2656",
  wq: "\u2655",
  wk: "\u2654",
  bp: "\u265F",
  bn: "\u265E",
  bb: "\u265D",
  br: "\u265C",
  bq: "\u265B",
  bk: "\u265A"
};
