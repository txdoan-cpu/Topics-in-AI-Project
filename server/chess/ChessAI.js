const ChessGame = require("./ChessGame");

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

class ChessAI {
  constructor(depth = 2) {
    this.depth = depth;
  }

  evaluate(game) {
    const status = game.getStatus();
    if (status.over) {
      if (status.result === "1-0") return 100000;
      if (status.result === "0-1") return -100000;
      return 0;
    }

    let score = 0;
    for (const row of game.board) {
      for (const piece of row) {
        if (!piece) continue;
        score += piece.color === "w" ? PIECE_VALUES[piece.type] : -PIECE_VALUES[piece.type];
      }
    }

    const mobility = game.generateLegalMoves().length * 5;
    return score + (game.turn === "w" ? mobility : -mobility);
  }

  minimax(game, depth, alpha, beta, maximizing) {
    const status = game.getStatus();
    if (depth === 0 || status.over) {
      return { score: this.evaluate(game) };
    }

    const legalMoves = game.generateLegalMoves();
    if (!legalMoves.length) {
      return { score: this.evaluate(game) };
    }

    let bestMove = legalMoves[0];

    if (maximizing) {
      let bestScore = -Infinity;
      for (const move of legalMoves) {
        const clone = ChessGame.fromState(game.serialize());
        clone.applyMove(move, true);
        const result = this.minimax(clone, depth - 1, alpha, beta, false);
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
        if (beta <= alpha) break;
      }
      return { score: bestScore, move: bestMove };
    }

    let bestScore = Infinity;
    for (const move of legalMoves) {
      const clone = ChessGame.fromState(game.serialize());
      clone.applyMove(move, true);
      const result = this.minimax(clone, depth - 1, alpha, beta, true);
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }

  chooseMove(gameState, depth = this.depth) {
    const game = ChessGame.fromState(gameState);
    return this.minimax(game, depth, -Infinity, Infinity, game.turn === "w").move;
  }
}

module.exports = ChessAI;

