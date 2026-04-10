window.ChessApp = window.ChessApp || {};

const STORAGE_KEY = "chessSavedGames";
const AUTH_STORAGE_KEY = "chessAuth";

function isStrongPassword(password) {
  return typeof password === "string" && password.length >= 8 && /[^A-Za-z0-9]/.test(password);
}

function readSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function setAuthFeedback(message, tone = "") {
  const feedback = document.getElementById("auth-feedback");
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("is-error", "is-success");

  if (tone) {
    feedback.classList.add(tone === "error" ? "is-error" : "is-success");
  }
}

function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function updateLandingAccessState(session) {
  const accessNote = document.getElementById("access-note");

  if (!accessNote) {
    return;
  }

  if (session?.user?.username) {
    accessNote.textContent = `Authenticated as ${session.user.username}.`;
    return;
  }

  accessNote.textContent = "Authentication is required before entering the game.";
}

async function validateExistingSession() {
  const session = readSession();
  updateLandingAccessState(session);

  if (!session?.token) {
    return null;
  }

  try {
    const data = await window.ChessApp.api.request("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${session.token}`
      }
    });

    const nextSession = { ...session, user: data.user };
    saveSession(nextSession);
    updateLandingAccessState(nextSession);
    return nextSession;
  } catch (error) {
    clearSession();
    updateLandingAccessState(null);
    return null;
  }
}

function bindAuthPanel() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const modeButtons = document.querySelectorAll("[data-auth-mode]");

  if (!loginForm || !registerForm || modeButtons.length === 0) {
    return;
  }

  function setMode(mode) {
    const loginActive = mode === "login";
    loginForm.classList.toggle("is-hidden", !loginActive);
    registerForm.classList.toggle("is-hidden", loginActive);
    setAuthFeedback("");
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.authMode));
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const identifier = String(formData.get("identifier") || "").trim();
    const password = String(formData.get("password") || "");

    if (!identifier || !password) {
      setAuthFeedback("Email or username and password are required.", "error");
      return;
    }

    try {
      const data = await window.ChessApp.api.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password })
      });

      saveSession(data);
      window.location.assign("/play");
    } catch (error) {
      setAuthFeedback(error.message, "error");
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!username || !email || !password) {
      setAuthFeedback("Username, email, and password are required.", "error");
      return;
    }

    if (!isStrongPassword(password)) {
      setAuthFeedback("Password must be at least 8 characters and include a special character.", "error");
      return;
    }

    try {
      const data = await window.ChessApp.api.request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });

      clearSession();
      updateLandingAccessState(null);
      setAuthFeedback(data.message || `Account created for ${data.user.username}. Please log in.`, "success");
      registerForm.reset();
      setMode("login");
    } catch (error) {
      setAuthFeedback(error.message, "error");
    }
  });
}

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

window.ChessApp.auth = {
  readSession,
  saveSession,
  clearSession,
  validateExistingSession
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

window.ChessApp.pieceSets = {
  classic: {
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
  },
  initials: {
    wp: "P",
    wn: "N",
    wb: "B",
    wr: "R",
    wq: "Q",
    wk: "K",
    bp: "P",
    bn: "N",
    bb: "B",
    br: "R",
    bq: "Q",
    bk: "K"
  }
};

window.ChessApp.drawPieceToCanvas = function drawPieceToCanvas(canvas, pieceKey, pieceModel = "standard") {
  const ctx = canvas.getContext("2d");
  const size = Math.min(canvas.width, canvas.height);
  const isWhite = pieceKey.startsWith("w");
  const classicGlyph = window.ChessApp.pieceSets.classic[pieceKey];
  const initialGlyph = window.ChessApp.pieceSets.initials[pieceKey];
  const fill = isWhite ? "#fffaf0" : "#1a2328";
  const accent = isWhite ? "#bfc8d2" : "#d4a65c";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  if (pieceModel === "standard") {
    ctx.fillStyle = fill;
    ctx.font = `${Math.floor(size * 0.62)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 8;
    ctx.fillText(classicGlyph, 0, size * 0.04);
  } else if (pieceModel === "modern") {
    ctx.beginPath();
    ctx.lineWidth = Math.max(3, size * 0.05);
    ctx.strokeStyle = fill;
    ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `700 ${Math.floor(size * 0.3)}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialGlyph, 0, 2);
  } else {
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = accent;
    ctx.arc(0, size * 0.04, size * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${Math.floor(size * 0.24)}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = isWhite ? "#1d2328" : "#fff9ef";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialGlyph, 0, size * 0.04);
  }

  ctx.restore();
};

document.addEventListener("DOMContentLoaded", () => {
  validateExistingSession();
  bindAuthPanel();
  if (new URLSearchParams(window.location.search).get("auth") === "required") {
    setAuthFeedback("Please log in to access the game page.", "error");
  }
});
