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
  const baseFill = isWhite ? "#fcfcfc" : "#111111";
  const deepFill = isWhite ? "#d6d6d6" : "#000000";
  const accent = isWhite ? "#ffffff" : "#2b2b2b";
  const outline = isWhite ? "#2f2f2f" : "#000000";
  const glow = isWhite ? "rgba(40, 40, 40, 0.16)" : "rgba(0,0,0,0.32)";

  function ensureRoundRect() {
    if (typeof ctx.roundRect === "function") {
      return;
    }

    ctx.roundRect = function roundRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + width, y, x + width, y + height, r);
      this.arcTo(x + width, y + height, x, y + height, r);
      this.arcTo(x, y + height, x, y, r);
      this.arcTo(x, y, x + width, y, r);
      this.closePath();
    };
  }

  function drawPedestal(width, height, radius) {
    ctx.beginPath();
    ctx.fillStyle = isWhite ? "rgba(25, 47, 84, 0.14)" : "rgba(0, 0, 0, 0.26)";
    ctx.ellipse(0, size * 0.29, width, height, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.roundRect(-width * 0.95, size * 0.18, width * 1.9, height * 1.25, radius);
    ctx.fillStyle = isWhite ? "#dbe8ff" : "#111722";
    ctx.fill();
  }

  function drawGlyphPiece(fontScale, fillStyle, strokeStyle = null, strokeWidth = 0, yOffset = size * 0.03) {
    ctx.font = `700 ${Math.floor(size * fontScale)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.08;
    if (strokeStyle && strokeWidth) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeStyle;
      ctx.strokeText(classicGlyph, 0, yOffset);
    }
    ctx.fillStyle = fillStyle;
    ctx.fillText(classicGlyph, 0, yOffset);
    ctx.shadowBlur = 0;
  }

  function drawStandard() {
    drawPedestal(size * 0.19, size * 0.052, size * 0.03);
    const fill = ctx.createLinearGradient(0, -size * 0.36, 0, size * 0.26);
    fill.addColorStop(0, isWhite ? "#ffffff" : "#373737");
    fill.addColorStop(0.3, accent);
    fill.addColorStop(0.62, baseFill);
    fill.addColorStop(1, deepFill);
    drawGlyphPiece(0.82, fill, outline, Math.max(3.2, size * 0.036), size * 0.01);

    ctx.beginPath();
    ctx.ellipse(-size * 0.08, -size * 0.09, size * 0.06, size * 0.22, -0.16, 0, Math.PI * 2);
    ctx.fillStyle = isWhite ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.05)";
    ctx.fill();
  }

  function drawModern() {
    ensureRoundRect();
    const shell = ctx.createLinearGradient(0, -size * 0.3, 0, size * 0.3);
    shell.addColorStop(0, accent);
    shell.addColorStop(0.35, baseFill);
    shell.addColorStop(1, deepFill);

    ctx.roundRect(-size * 0.26, -size * 0.31, size * 0.52, size * 0.62, size * 0.18);
    ctx.fillStyle = shell;
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.08;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.roundRect(-size * 0.18, -size * 0.23, size * 0.36, size * 0.46, size * 0.12);
    ctx.fillStyle = isWhite ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)";
    ctx.fill();

    ctx.font = `700 ${Math.floor(size * 0.22)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isWhite ? "#153b71" : "#f8e7c5";
    ctx.fillText(initialGlyph, 0, size * 0.01);
  }

  function drawMinimal() {
    ensureRoundRect();
    ctx.lineWidth = Math.max(4, size * 0.048);
    ctx.strokeStyle = baseFill;
    ctx.roundRect(-size * 0.21, -size * 0.27, size * 0.42, size * 0.54, size * 0.18);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = accent;
    ctx.arc(0, -size * 0.07, size * 0.11, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `700 ${Math.floor(size * 0.16)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = baseFill;
    ctx.fillText(initialGlyph, 0, size * 0.12);
  }

  function drawLuxe() {
    ensureRoundRect();
    drawPedestal(size * 0.18, size * 0.05, size * 0.03);

    const fill = ctx.createLinearGradient(0, -size * 0.36, 0, size * 0.28);
    fill.addColorStop(0, isWhite ? "#fffef8" : "#44413a");
    fill.addColorStop(0.28, accent);
    fill.addColorStop(0.62, baseFill);
    fill.addColorStop(1, deepFill);

    drawGlyphPiece(0.8, fill, outline, Math.max(3, size * 0.034), size * 0.01);

    ctx.beginPath();
    ctx.ellipse(-size * 0.09, -size * 0.08, size * 0.07, size * 0.24, -0.18, 0, Math.PI * 2);
    ctx.fillStyle = isWhite ? "rgba(255,255,255,0.28)" : "rgba(255,212,133,0.12)";
    ctx.fill();
  }

  function drawArcade() {
    ensureRoundRect();
    ctx.roundRect(-size * 0.24, -size * 0.28, size * 0.48, size * 0.56, size * 0.08);
    ctx.fillStyle = isWhite ? "#8ebdff" : "#10161f";
    ctx.fill();

    ctx.roundRect(-size * 0.17, -size * 0.2, size * 0.34, size * 0.4, size * 0.05);
    ctx.fillStyle = isWhite ? "#d9ecff" : "#ffba6f";
    ctx.fill();

    ctx.font = `700 ${Math.floor(size * 0.2)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isWhite ? "#163862" : "#191b20";
    ctx.fillText(initialGlyph, 0, 1);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  ensureRoundRect();

  if (pieceModel === "modern") {
    drawModern();
  } else if (pieceModel === "minimal") {
    drawMinimal();
  } else if (pieceModel === "luxe") {
    drawLuxe();
  } else if (pieceModel === "arcade") {
    drawArcade();
  } else {
    drawStandard();
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
