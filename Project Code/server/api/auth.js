const express = require("express");
const User = require("../models/User");
const { AUTH_COOKIE_NAME, hashPassword, comparePassword, signToken, authMiddleware } = require("../utils/auth");

const router = express.Router();
const PASSWORD_RULE = /^(?=.*[^A-Za-z0-9]).{8,}$/;

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function isStrongPassword(password) {
  return PASSWORD_RULE.test(password || "");
}

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const trimmedUsername = String(username || "").trim();

    if (!trimmedUsername || !normalizedEmail || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters and include a special character." });
    }

    const existingUser = await User.findOne({
      $or: [{ username: trimmedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      return res.status(409).json({ error: "Username or email already exists." });
    }

    const user = await User.create({
      username: trimmedUsername,
      email: normalizedEmail,
      passwordHash: await hashPassword(password)
    });

    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(201).json({
      message: "Account created successfully. Please log in to continue.",
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to register user." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const normalizedIdentifier = String(identifier || "").trim();

    if (!normalizedIdentifier || !password) {
      return res.status(400).json({ error: "Email or username and password are required." });
    }

    const user = await User.findOne({
      $or: [
        { username: normalizedIdentifier },
        { email: normalizedIdentifier.toLowerCase() }
      ]
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    return res.json({
      token: (() => {
        const token = signToken(user);
        setAuthCookie(res, token);
        return token;
      })(),
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to log in." });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  return res.json({
    user: { id: req.user.sub, username: req.user.username, email: req.user.email }
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  return res.status(204).send();
});

module.exports = router;
