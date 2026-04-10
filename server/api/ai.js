const express = require("express");
const ChessAI = require("../chess/ChessAI");

const router = express.Router();
const ai = new ChessAI(2);

router.post("/move", async (req, res) => {
  try {
    const { state, depth } = req.body;
    if (!state) {
      return res.status(400).json({ error: "Game state is required." });
    }

    const move = ai.chooseMove(state, depth || 2);
    if (!move) {
      return res.status(400).json({ error: "No legal move available." });
    }

    return res.json({ move });
  } catch (error) {
    return res.status(500).json({ error: "Unable to generate AI move." });
  }
});

module.exports = router;

