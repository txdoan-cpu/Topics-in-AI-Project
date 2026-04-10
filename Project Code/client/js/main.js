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
  const toggleButtons = document.querySelectorAll("[data-auth-mode]");

  if (!loginForm || !registerForm || toggleButtons.length === 0) {
    return;
  }

  function setMode(mode) {
    const loginActive = mode === "login";
    loginForm.classList.toggle("is-hidden", !loginActive);
    registerForm.classList.toggle("is-hidden", loginActive);

    toggleButtons.forEach((button) => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    setAuthFeedback("");
  }

  toggleButtons.forEach((button) => {
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

document.addEventListener("DOMContentLoaded", () => {
  validateExistingSession();
  bindAuthPanel();
  if (new URLSearchParams(window.location.search).get("auth") === "required") {
    setAuthFeedback("Please log in to access the game page.", "error");
  }
});
