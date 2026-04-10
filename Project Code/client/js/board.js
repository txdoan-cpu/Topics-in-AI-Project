(function attachBoardModule() {
  const FILES = "abcdefgh";
  const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  function cloneBoard(board) {
    return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
  }

  function createInitialBoard() {
    const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let col = 0; col < 8; col += 1) {
      board[0][col] = { type: backRank[col], color: "b" };
      board[1][col] = { type: "p", color: "b" };
      board[6][col] = { type: "p", color: "w" };
      board[7][col] = { type: backRank[col], color: "w" };
    }
    return board;
  }

  function toSquare(row, col) {
    return `${FILES[col]}${8 - row}`;
  }

  function fromSquare(square) {
    return { row: 8 - Number(square[1]), col: FILES.indexOf(square[0]) };
  }

  class BrowserChessGame {
    constructor(state = null) {
      if (state) {
        this.board = cloneBoard(state.board);
        this.turn = state.turn;
        this.castling = { ...state.castling };
        this.enPassant = state.enPassant;
        this.halfmoveClock = state.halfmoveClock;
        this.fullmoveNumber = state.fullmoveNumber;
        this.moveHistory = state.moveHistory.map((move) => ({ ...move }));
      } else {
        this.board = createInitialBoard();
        this.turn = "w";
        this.castling = { wKingSide: true, wQueenSide: true, bKingSide: true, bQueenSide: true };
        this.enPassant = null;
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
        this.moveHistory = [];
      }
    }

    static fromState(state) {
      return new BrowserChessGame(state);
    }

    serialize() {
      return {
        board: cloneBoard(this.board),
        turn: this.turn,
        castling: { ...this.castling },
        enPassant: this.enPassant,
        halfmoveClock: this.halfmoveClock,
        fullmoveNumber: this.fullmoveNumber,
        moveHistory: this.moveHistory.map((move) => ({ ...move }))
      };
    }

    clone() {
      return BrowserChessGame.fromState(this.serialize());
    }

    inBounds(row, col) {
      return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    getKingSquare(color) {
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const piece = this.board[row][col];
          if (piece && piece.type === "k" && piece.color === color) {
            return toSquare(row, col);
          }
        }
      }
      return null;
    }

    isSquareAttacked(square, byColor) {
      const { row, col } = fromSquare(square);
      const pawnDirection = byColor === "w" ? -1 : 1;

      for (const offset of [-1, 1]) {
        const testRow = row - pawnDirection;
        const testCol = col + offset;
        if (this.inBounds(testRow, testCol)) {
          const piece = this.board[testRow][testCol];
          if (piece && piece.color === byColor && piece.type === "p") return true;
        }
      }

      for (const [rowOffset, colOffset] of KNIGHT_OFFSETS) {
        const testRow = row + rowOffset;
        const testCol = col + colOffset;
        if (this.inBounds(testRow, testCol)) {
          const piece = this.board[testRow][testCol];
          if (piece && piece.color === byColor && piece.type === "n") return true;
        }
      }

      for (const [rowStep, colStep] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let testRow = row + rowStep;
        let testCol = col + colStep;
        while (this.inBounds(testRow, testCol)) {
          const piece = this.board[testRow][testCol];
          if (piece) {
            if (piece.color === byColor && (piece.type === "r" || piece.type === "q")) return true;
            break;
          }
          testRow += rowStep;
          testCol += colStep;
        }
      }

      for (const [rowStep, colStep] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        let testRow = row + rowStep;
        let testCol = col + colStep;
        while (this.inBounds(testRow, testCol)) {
          const piece = this.board[testRow][testCol];
          if (piece) {
            if (piece.color === byColor && (piece.type === "b" || piece.type === "q")) return true;
            break;
          }
          testRow += rowStep;
          testCol += colStep;
        }
      }

      for (const [rowOffset, colOffset] of KING_OFFSETS) {
        const testRow = row + rowOffset;
        const testCol = col + colOffset;
        if (this.inBounds(testRow, testCol)) {
          const piece = this.board[testRow][testCol];
          if (piece && piece.color === byColor && piece.type === "k") return true;
        }
      }

      return false;
    }

    isInCheck(color = this.turn) {
      const kingSquare = this.getKingSquare(color);
      return kingSquare ? this.isSquareAttacked(kingSquare, color === "w" ? "b" : "w") : false;
    }

    generatePseudoMovesForSquare(square) {
      const { row, col } = fromSquare(square);
      const piece = this.board[row][col];
      if (!piece || piece.color !== this.turn) return [];

      const moves = [];
      const push = (targetRow, targetCol, extra = {}) => {
        if (!this.inBounds(targetRow, targetCol)) return;
        moves.push({ from: square, to: toSquare(targetRow, targetCol), piece: piece.type, color: piece.color, ...extra });
      };

      if (piece.type === "p") {
        const direction = piece.color === "w" ? -1 : 1;
        const startRow = piece.color === "w" ? 6 : 1;
        const promotionRow = piece.color === "w" ? 0 : 7;
        const nextRow = row + direction;
        if (this.inBounds(nextRow, col) && !this.board[nextRow][col]) {
          if (nextRow === promotionRow) {
            ["q", "r", "b", "n"].forEach((promotion) => push(nextRow, col, { promotion }));
          } else {
            push(nextRow, col);
          }
          const jumpRow = row + direction * 2;
          if (row === startRow && !this.board[jumpRow][col]) push(jumpRow, col, { doubleStep: true });
        }

        for (const offset of [-1, 1]) {
          const targetCol = col + offset;
          if (!this.inBounds(nextRow, targetCol)) continue;
          const targetPiece = this.board[nextRow][targetCol];
          if (targetPiece && targetPiece.color !== piece.color) {
            if (nextRow === promotionRow) {
              ["q", "r", "b", "n"].forEach((promotion) => push(nextRow, targetCol, { promotion, captured: targetPiece.type }));
            } else {
              push(nextRow, targetCol, { captured: targetPiece.type });
            }
          }
        }

        if (this.enPassant) {
          const enPassantSquare = fromSquare(this.enPassant);
          if (enPassantSquare.row === nextRow && Math.abs(enPassantSquare.col - col) === 1) {
            push(enPassantSquare.row, enPassantSquare.col, { enPassant: true, captured: "p" });
          }
        }
      }

      if (piece.type === "n") {
        for (const [rowOffset, colOffset] of KNIGHT_OFFSETS) {
          const targetRow = row + rowOffset;
          const targetCol = col + colOffset;
          if (!this.inBounds(targetRow, targetCol)) continue;
          const targetPiece = this.board[targetRow][targetCol];
          if (!targetPiece || targetPiece.color !== piece.color) push(targetRow, targetCol, { captured: targetPiece?.type || null });
        }
      }

      if (["b", "r", "q"].includes(piece.type)) {
        const directions = [];
        if (["b", "q"].includes(piece.type)) directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        if (["r", "q"].includes(piece.type)) directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        for (const [rowStep, colStep] of directions) {
          let targetRow = row + rowStep;
          let targetCol = col + colStep;
          while (this.inBounds(targetRow, targetCol)) {
            const targetPiece = this.board[targetRow][targetCol];
            if (!targetPiece) {
              push(targetRow, targetCol);
            } else {
              if (targetPiece.color !== piece.color) push(targetRow, targetCol, { captured: targetPiece.type });
              break;
            }
            targetRow += rowStep;
            targetCol += colStep;
          }
        }
      }

      if (piece.type === "k") {
        for (const [rowOffset, colOffset] of KING_OFFSETS) {
          const targetRow = row + rowOffset;
          const targetCol = col + colOffset;
          if (!this.inBounds(targetRow, targetCol)) continue;
          const targetPiece = this.board[targetRow][targetCol];
          if (!targetPiece || targetPiece.color !== piece.color) push(targetRow, targetCol, { captured: targetPiece?.type || null });
        }

        const enemyColor = piece.color === "w" ? "b" : "w";
        if (!this.isInCheck(piece.color)) {
          if (piece.color === "w" && this.castling.wKingSide && !this.board[7][5] && !this.board[7][6] &&
            !this.isSquareAttacked("f1", enemyColor) && !this.isSquareAttacked("g1", enemyColor)) push(7, 6, { castle: "king" });
          if (piece.color === "w" && this.castling.wQueenSide && !this.board[7][1] && !this.board[7][2] && !this.board[7][3] &&
            !this.isSquareAttacked("d1", enemyColor) && !this.isSquareAttacked("c1", enemyColor)) push(7, 2, { castle: "queen" });
          if (piece.color === "b" && this.castling.bKingSide && !this.board[0][5] && !this.board[0][6] &&
            !this.isSquareAttacked("f8", enemyColor) && !this.isSquareAttacked("g8", enemyColor)) push(0, 6, { castle: "king" });
          if (piece.color === "b" && this.castling.bQueenSide && !this.board[0][1] && !this.board[0][2] && !this.board[0][3] &&
            !this.isSquareAttacked("d8", enemyColor) && !this.isSquareAttacked("c8", enemyColor)) push(0, 2, { castle: "queen" });
        }
      }

      return moves;
    }

    generateLegalMoves() {
      const legalMoves = [];
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const piece = this.board[row][col];
          if (!piece || piece.color !== this.turn) continue;
          const square = toSquare(row, col);
          for (const move of this.generatePseudoMovesForSquare(square)) {
            const clone = this.clone();
            clone.applyMove(move, true);
            if (!clone.isInCheck(piece.color)) legalMoves.push(move);
          }
        }
      }
      return legalMoves;
    }

    updateCastlingRights(from, to, piece, capturedPiece) {
      if (piece.type === "k") {
        if (piece.color === "w") {
          this.castling.wKingSide = false;
          this.castling.wQueenSide = false;
        } else {
          this.castling.bKingSide = false;
          this.castling.bQueenSide = false;
        }
      }
      if (piece.type === "r") {
        if (from === "a1") this.castling.wQueenSide = false;
        if (from === "h1") this.castling.wKingSide = false;
        if (from === "a8") this.castling.bQueenSide = false;
        if (from === "h8") this.castling.bKingSide = false;
      }
      if (capturedPiece?.type === "r") {
        if (to === "a1") this.castling.wQueenSide = false;
        if (to === "h1") this.castling.wKingSide = false;
        if (to === "a8") this.castling.bQueenSide = false;
        if (to === "h8") this.castling.bKingSide = false;
      }
    }

    getStatus() {
      const legalMoves = this.generateLegalMoves();
      const inCheck = this.isInCheck(this.turn);
      if (inCheck && legalMoves.length === 0) return { over: true, result: this.turn === "w" ? "0-1" : "1-0", message: "Checkmate" };
      if (!inCheck && legalMoves.length === 0) return { over: true, result: "1/2-1/2", message: "Stalemate" };
      return { over: false, result: null, message: inCheck ? "Check" : "In progress" };
    }

    toFen() {
      const rows = this.board.map((row) => {
        let empty = 0;
        let result = "";
        row.forEach((piece) => {
          if (!piece) {
            empty += 1;
            return;
          }
          if (empty) {
            result += empty;
            empty = 0;
          }
          result += piece.color === "w" ? piece.type.toUpperCase() : piece.type;
        });
        if (empty) result += empty;
        return result;
      });

      const castling = [
        this.castling.wKingSide ? "K" : "",
        this.castling.wQueenSide ? "Q" : "",
        this.castling.bKingSide ? "k" : "",
        this.castling.bQueenSide ? "q" : ""
      ].join("") || "-";

      return `${rows.join("/")} ${this.turn} ${castling} ${this.enPassant || "-"} ${this.halfmoveClock} ${this.fullmoveNumber}`;
    }

    applyMove(move, skipValidation = false) {
      const legalMoves = skipValidation ? [move] : this.generateLegalMoves();
      const selectedMove = legalMoves.find((candidate) =>
        candidate.from === move.from && candidate.to === move.to && (candidate.promotion || null) === (move.promotion || null)
      );
      if (!selectedMove) throw new Error("Illegal move.");

      const from = fromSquare(selectedMove.from);
      const to = fromSquare(selectedMove.to);
      const piece = this.board[from.row][from.col];
      let capturedPiece = this.board[to.row][to.col];

      this.updateCastlingRights(selectedMove.from, selectedMove.to, piece, capturedPiece);
      this.board[from.row][from.col] = null;

      if (selectedMove.enPassant) {
        const captureRow = piece.color === "w" ? to.row + 1 : to.row - 1;
        capturedPiece = this.board[captureRow][to.col];
        this.board[captureRow][to.col] = null;
      }

      if (selectedMove.castle === "king") {
        this.board[to.row][to.col] = piece;
        this.board[to.row][5] = this.board[to.row][7];
        this.board[to.row][7] = null;
      } else if (selectedMove.castle === "queen") {
        this.board[to.row][to.col] = piece;
        this.board[to.row][3] = this.board[to.row][0];
        this.board[to.row][0] = null;
      } else {
        this.board[to.row][to.col] = selectedMove.promotion ? { type: selectedMove.promotion, color: piece.color } : piece;
      }

      this.enPassant = null;
      if (piece.type === "p" && selectedMove.doubleStep) this.enPassant = toSquare((from.row + to.row) / 2, from.col);
      this.halfmoveClock = piece.type === "p" || capturedPiece ? 0 : this.halfmoveClock + 1;
      if (this.turn === "b") this.fullmoveNumber += 1;
      this.turn = this.turn === "w" ? "b" : "w";

      if (skipValidation) {
        return {
          from: selectedMove.from,
          to: selectedMove.to,
          piece: piece.type,
          captured: capturedPiece?.type || null,
          san: null,
          fen: this.toFen(),
          promotion: selectedMove.promotion || null
        };
      }

      const status = this.getStatus();
      const checkSuffix = status.over && status.message === "Checkmate" ? "#" : status.message === "Check" ? "+" : "";
      const san = selectedMove.castle === "king"
        ? `O-O${checkSuffix}`
        : selectedMove.castle === "queen"
          ? `O-O-O${checkSuffix}`
          : `${piece.type === "p" ? "" : piece.type.toUpperCase()}${piece.type === "p" && (capturedPiece || selectedMove.enPassant) ? selectedMove.from[0] : ""}${capturedPiece || selectedMove.enPassant ? "x" : ""}${selectedMove.to}${selectedMove.promotion ? `=${selectedMove.promotion.toUpperCase()}` : ""}${checkSuffix}`;

      const moveRecord = {
        from: selectedMove.from,
        to: selectedMove.to,
        piece: piece.type,
        captured: capturedPiece?.type || null,
        san,
        fen: this.toFen(),
        promotion: selectedMove.promotion || null
      };
      this.moveHistory.push(moveRecord);
      return moveRecord;
    }
  }

  class ChessBoard {
    constructor(root, options = {}) {
      this.root = root;
      this.onSquareClick = options.onSquareClick || (() => {});
      this.pieceModel = options.pieceModel || "classic";
      this.selectedSquare = null;
      this.legalTargets = [];
      this.render(createInitialBoard());
    }

    setPieceModel(pieceModel) {
      this.pieceModel = pieceModel || "classic";
    }

    render(boardState) {
      this.root.innerHTML = "";
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const square = document.createElement("button");
          square.type = "button";
          square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
          square.dataset.square = toSquare(row, col);
          const piece = boardState[row][col];
          if (piece) {
            const canvas = document.createElement("canvas");
            canvas.width = 96;
            canvas.height = 96;
            canvas.className = `piece-canvas piece-${piece.color}`;
            window.ChessApp.drawPieceToCanvas(canvas, `${piece.color}${piece.type}`, this.pieceModel);
            square.appendChild(canvas);
          }
          if (this.selectedSquare === square.dataset.square) square.classList.add("selected");
          if (this.legalTargets.includes(square.dataset.square)) square.classList.add("legal");
          square.addEventListener("click", () => this.onSquareClick(square.dataset.square));
          this.root.appendChild(square);
        }
      }
    }

    setSelection(square, legalTargets) {
      this.selectedSquare = square;
      this.legalTargets = legalTargets || [];
    }
  }

  window.ChessApp.BrowserChessGame = BrowserChessGame;
  window.ChessApp.ChessBoard = ChessBoard;
})();
