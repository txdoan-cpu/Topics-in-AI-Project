const express = require("express");
const Game = require("../models/Game");
const { authMiddleware } = require("../utils/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const games = await Game.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select("whitePlayer blackPlayer result mode createdAt");

    return res.json({ games });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load games." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: "Game not found." });
    }
    return res.json({ game });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load game." });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const game = await Game.create({
      ...req.body,
      owner: req.user.sub
    });
    return res.status(201).json({ game });
  } catch (error) {
    return res.status(400).json({ error: "Unable to save game." });
  }
});

module.exports = router;

