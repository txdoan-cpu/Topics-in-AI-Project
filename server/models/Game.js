const mongoose = require("mongoose");

const moveSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    piece: String,
    captured: String,
    san: String,
    fen: String,
    promotion: String
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    whitePlayer: {
      type: String,
      required: true
    },
    blackPlayer: {
      type: String,
      required: true
    },
    result: {
      type: String,
      required: true
    },
    mode: {
      type: String,
      enum: ["local", "ai", "online"],
      default: "local"
    },
    moves: {
      type: [moveSchema],
      default: []
    },
    finalFen: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Game", gameSchema);

