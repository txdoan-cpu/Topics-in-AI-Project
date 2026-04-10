const express = require("express");
const User = require("../models/User");
const { hashPassword, comparePassword, signToken, authMiddleware } = require("../utils/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 6) {
      return res.status(400).json({ error: "Username and a 6+ character password are required." });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists." });
    }

    const user = await User.create({
      username,
      passwordHash: await hashPassword(password)
    });

    return res.status(201).json({
      token: signToken(user),
      user: { id: user._id, username: user.username }
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to register user." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    return res.json({
      token: signToken(user),
      user: { id: user._id, username: user.username }
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to log in." });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  return res.json({
    user: { id: req.user.sub, username: req.user.username }
  });
});

module.exports = router;

