export type PieceType = "pawn" | "rook" | "knight" | "bishop" | "queen" | "king"
export type PieceColor = "white" | "black"

export interface ChessPiece {
  type: PieceType
  color: PieceColor
  hasMoved?: boolean
}

export interface Position {
  row: number
  col: number
}

export function initialBoard(): (ChessPiece | null)[][] {
  const board: (ChessPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null))

  // Set up pawns
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: "pawn", color: "black", hasMoved: false }
    board[6][i] = { type: "pawn", color: "white", hasMoved: false }
  }

  // Set up rooks
  board[0][0] = { type: "rook", color: "black", hasMoved: false }
  board[0][7] = { type: "rook", color: "black", hasMoved: false }
  board[7][0] = { type: "rook", color: "white", hasMoved: false }
  board[7][7] = { type: "rook", color: "white", hasMoved: false }

  // Set up knights
  board[0][1] = { type: "knight", color: "black" }
  board[0][6] = { type: "knight", color: "black" }
  board[7][1] = { type: "knight", color: "white" }
  board[7][6] = { type: "knight", color: "white" }

  // Set up bishops
  board[0][2] = { type: "bishop", color: "black" }
  board[0][5] = { type: "bishop", color: "black" }
  board[7][2] = { type: "bishop", color: "white" }
  board[7][5] = { type: "bishop", color: "white" }

  // Set up queens
  board[0][3] = { type: "queen", color: "black" }
  board[7][3] = { type: "queen", color: "white" }

  // Set up kings
  board[0][4] = { type: "king", color: "black", hasMoved: false }
  board[7][4] = { type: "king", color: "white", hasMoved: false }

  return board
}

// Check if a position is valid
export function isValidPosition(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c < 8
}

// Check if a king is under attack
export function isKingUnderAttack(
  board: (ChessPiece | null)[][],
  kingRow: number,
  kingCol: number,
  kingColor: PieceColor,
): boolean {
  // Check for attacks from pawns
  const pawnDirection = kingColor === "white" ? 1 : -1
  if (
    isValidPosition(kingRow + pawnDirection, kingCol - 1) &&
    board[kingRow + pawnDirection][kingCol - 1]?.type === "pawn" &&
    board[kingRow + pawnDirection][kingCol - 1]?.color !== kingColor
  ) {
    return true
  }
  if (
    isValidPosition(kingRow + pawnDirection, kingCol + 1) &&
    board[kingRow + pawnDirection][kingCol + 1]?.type === "pawn" &&
    board[kingRow + pawnDirection][kingCol + 1]?.color !== kingColor
  ) {
    return true
  }

  // Check for attacks from knights
  const knightMoves = [
    { dr: -2, dc: -1 },
    { dr: -2, dc: 1 },
    { dr: -1, dc: -2 },
    { dr: -1, dc: 2 },
    { dr: 1, dc: -2 },
    { dr: 1, dc: 2 },
    { dr: 2, dc: -1 },
    { dr: 2, dc: 1 },
  ]
  for (const { dr, dc } of knightMoves) {
    const r = kingRow + dr
    const c = kingCol + dc
    if (isValidPosition(r, c) && board[r][c]?.type === "knight" && board[r][c]?.color !== kingColor) {
      return true
    }
  }

  // Check for attacks from kings (for adjacent squares)
  const kingMoves = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: -1, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
  ]
  for (const { dr, dc } of kingMoves) {
    const r = kingRow + dr
    const c = kingCol + dc
    if (isValidPosition(r, c) && board[r][c]?.type === "king" && board[r][c]?.color !== kingColor) {
      return true
    }
  }

  // Check for attacks from sliding pieces (queen, rook, bishop)
  const directions = [
    { dr: -1, dc: 0, pieces: ["rook", "queen"] }, // up
    { dr: 1, dc: 0, pieces: ["rook", "queen"] }, // down
    { dr: 0, dc: -1, pieces: ["rook", "queen"] }, // left
    { dr: 0, dc: 1, pieces: ["rook", "queen"] }, // right
    { dr: -1, dc: -1, pieces: ["bishop", "queen"] }, // up-left
    { dr: -1, dc: 1, pieces: ["bishop", "queen"] }, // up-right
    { dr: 1, dc: -1, pieces: ["bishop", "queen"] }, // down-left
    { dr: 1, dc: 1, pieces: ["bishop", "queen"] }, // down-right
  ]

  for (const { dr, dc, pieces } of directions) {
    let r = kingRow + dr
    let c = kingCol + dc
    while (isValidPosition(r, c)) {
      if (board[r][c]) {
        if (board[r][c]?.color !== kingColor && pieces.includes(board[r][c]?.type as string)) {
          return true
        }
        break // Blocked by a piece
      }
      r += dr
      c += dc
    }
  }

  return false
}

// Check if a move would put or leave own king in check
function wouldBeInCheck(
  board: (ChessPiece | null)[][],
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  pieceColor: PieceColor,
): boolean {
  // Create a temporary board with the move applied
  const tempBoard = JSON.parse(JSON.stringify(board))
  tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol]
  tempBoard[fromRow][fromCol] = null

  // Find the king
  let kingRow = -1
  let kingCol = -1

  // If we're moving the king, use the destination coordinates
  if (tempBoard[toRow][toCol]?.type === "king") {
    kingRow = toRow
    kingCol = toCol
  } else {
    // Otherwise find the king
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (tempBoard[r][c]?.type === "king" && tempBoard[r][c]?.color === pieceColor) {
          kingRow = r
          kingCol = c
          break
        }
      }
      if (kingRow !== -1) break
    }
  }

  return isKingUnderAttack(tempBoard, kingRow, kingCol, pieceColor)
}

// Check if a player is in check
export function isCheck(board: (ChessPiece | null)[][], color: PieceColor): boolean {
  // Find the king
  let kingRow = -1
  let kingCol = -1

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.type === "king" && board[r][c]?.color === color) {
        kingRow = r
        kingCol = c
        break
      }
    }
    if (kingRow !== -1) break
  }

  return isKingUnderAttack(board, kingRow, kingCol, color)
}

// Get possible moves for a piece
export function getPossibleMoves(board: (ChessPiece | null)[][], row: number, col: number): Position[] {
  const piece = board[row][col]
  if (!piece) return []

  const moves: Position[] = []

  const isEmptyOrCapture = (r: number, c: number) => {
    if (!isValidPosition(r, c)) return false
    return !board[r][c] || board[r][c]?.color !== piece.color
  }

  const isEmpty = (r: number, c: number) => {
    if (!isValidPosition(r, c)) return false
    return !board[r][c]
  }

  // Get raw moves without checking if they would put the king in check
  function getRawMoves(board: (ChessPiece | null)[][], row: number, col: number) {
    const piece = board[row][col]
    if (!piece) return []

    const moves: Position[] = []

    switch (piece.type) {
      case "pawn": {
        const direction = piece.color === "white" ? -1 : 1

        // Move forward one square
        if (isEmpty(row + direction, col)) {
          moves.push({ row: row + direction, col })

          // Move forward two squares from starting position
          if (!piece.hasMoved && isEmpty(row + direction, col) && isEmpty(row + 2 * direction, col)) {
            moves.push({ row: row + 2 * direction, col })
          }
        }

        // Capture diagonally
        if (
          isValidPosition(row + direction, col - 1) &&
          board[row + direction][col - 1] &&
          board[row + direction][col - 1]?.color !== piece.color
        ) {
          moves.push({ row: row + direction, col: col - 1 })
        }

        if (
          isValidPosition(row + direction, col + 1) &&
          board[row + direction][col + 1] &&
          board[row + direction][col + 1]?.color !== piece.color
        ) {
          moves.push({ row: row + direction, col: col + 1 })
        }

        break
      }

      case "rook": {
        // Move horizontally and vertically
        const directions = [
          { dr: -1, dc: 0 }, // up
          { dr: 1, dc: 0 }, // down
          { dr: 0, dc: -1 }, // left
          { dr: 0, dc: 1 }, // right
        ]

        for (const { dr, dc } of directions) {
          let r = row + dr
          let c = col + dc

          while (isValidPosition(r, c)) {
            if (isEmpty(r, c)) {
              moves.push({ row: r, col: c })
            } else if (board[r][c]?.color !== piece.color) {
              moves.push({ row: r, col: c })
              break
            } else {
              break
            }

            r += dr
            c += dc
          }
        }

        break
      }

      case "knight": {
        // L-shaped moves
        const knightMoves = [
          { dr: -2, dc: -1 },
          { dr: -2, dc: 1 },
          { dr: -1, dc: -2 },
          { dr: -1, dc: 2 },
          { dr: 1, dc: -2 },
          { dr: 1, dc: 2 },
          { dr: 2, dc: -1 },
          { dr: 2, dc: 1 },
        ]

        for (const { dr, dc } of knightMoves) {
          const r = row + dr
          const c = col + dc

          if (isEmptyOrCapture(r, c)) {
            moves.push({ row: r, col: c })
          }
        }

        break
      }

      case "bishop": {
        // Move diagonally
        const directions = [
          { dr: -1, dc: -1 }, // up-left
          { dr: -1, dc: 1 }, // up-right
          { dr: 1, dc: -1 }, // down-left
          { dr: 1, dc: 1 }, // down-right
        ]

        for (const { dr, dc } of directions) {
          let r = row + dr
          let c = col + dc

          while (isValidPosition(r, c)) {
            if (isEmpty(r, c)) {
              moves.push({ row: r, col: c })
            } else if (board[r][c]?.color !== piece.color) {
              moves.push({ row: r, col: c })
              break
            } else {
              break
            }

            r += dr
            c += dc
          }
        }

        break
      }

      case "queen": {
        // Combine rook and bishop moves
        const directions = [
          { dr: -1, dc: 0 }, // up
          { dr: 1, dc: 0 }, // down
          { dr: 0, dc: -1 }, // left
          { dr: 0, dc: 1 }, // right
          { dr: -1, dc: -1 }, // up-left
          { dr: -1, dc: 1 }, // up-right
          { dr: 1, dc: -1 }, // down-left
          { dr: 1, dc: 1 }, // down-right
        ]

        for (const { dr, dc } of directions) {
          let r = row + dr
          let c = col + dc

          while (isValidPosition(r, c)) {
            if (isEmpty(r, c)) {
              moves.push({ row: r, col: c })
            } else if (board[r][c]?.color !== piece.color) {
              moves.push({ row: r, col: c })
              break
            } else {
              break
            }

            r += dr
            c += dc
          }
        }

        break
      }

      case "king": {
        // Move one square in any direction
        const kingMoves = [
          { dr: -1, dc: -1 },
          { dr: -1, dc: 0 },
          { dr: -1, dc: 1 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 },
          { dr: 1, dc: -1 },
          { dr: 1, dc: 0 },
          { dr: 1, dc: 1 },
        ]

        for (const { dr, dc } of kingMoves) {
          const r = row + dr
          const c = col + dc

          if (isEmptyOrCapture(r, c)) {
            moves.push({ row: r, col: c })
          }
        }

        // Castling
        if (!piece.hasMoved) {
          // Kingside castling
          if (
            board[row][7]?.type === "rook" &&
            board[row][7]?.color === piece.color &&
            !board[row][7]?.hasMoved &&
            !board[row][5] &&
            !board[row][6]
          ) {
            // Check if king is not in check and doesn't pass through check
            if (
              !isCheck(board, piece.color) &&
              !wouldBeInCheck(board, row, col, row, col + 1, piece.color) &&
              !wouldBeInCheck(board, row, col, row, col + 2, piece.color)
            ) {
              moves.push({ row, col: col + 2 })
            }
          }

          // Queenside castling
          if (
            board[row][0]?.type === "rook" &&
            board[row][0]?.color === piece.color &&
            !board[row][0]?.hasMoved &&
            !board[row][1] &&
            !board[row][2] &&
            !board[row][3]
          ) {
            // Check if king is not in check and doesn't pass through check
            if (
              !isCheck(board, piece.color) &&
              !wouldBeInCheck(board, row, col, row, col - 1, piece.color) &&
              !wouldBeInCheck(board, row, col, row, col - 2, piece.color)
            ) {
              moves.push({ row, col: col - 2 })
            }
          }
        }

        break
      }
    }

    return moves
  }

  // Get all possible moves without check validation
  const rawMoves = getRawMoves(board, row, col)

  // Filter out moves that would put or leave the king in check
  for (const move of rawMoves) {
    if (!wouldBeInCheck(board, row, col, move.row, move.col, piece.color)) {
      moves.push(move)
    }
  }

  return moves
}

// Move a piece on the board
export function movePiece(
  board: (ChessPiece | null)[][],
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  promotionPiece?: PieceType,
): (ChessPiece | null)[][] {
  const newBoard = JSON.parse(JSON.stringify(board))
  const piece = newBoard[fromRow][fromCol]

  if (!piece) return newBoard

  // Handle castling
  if (piece.type === "king" && Math.abs(fromCol - toCol) === 2) {
    // Kingside castling
    if (toCol > fromCol) {
      newBoard[toRow][5] = newBoard[toRow][7] // Move rook
      newBoard[toRow][7] = null
    }
    // Queenside castling
    else {
      newBoard[toRow][3] = newBoard[toRow][0] // Move rook
      newBoard[toRow][0] = null
    }
  }

  // Handle pawn promotion
  if (piece.type === "pawn" && (toRow === 0 || toRow === 7)) {
    piece.type = promotionPiece || "queen" // Use specified piece or default to queen
  }

  // Update piece movement status
  if (piece.type === "king" || piece.type === "rook" || piece.type === "pawn") {
    piece.hasMoved = true
  }

  // Move the piece
  newBoard[toRow][toCol] = piece
  newBoard[fromRow][fromCol] = null

  return newBoard
}

// Check if a player is in checkmate
export function isCheckmate(board: (ChessPiece | null)[][], color: PieceColor): boolean {
  // If not in check, it's not checkmate
  if (!isCheck(board, color)) return false

  // Check if any piece can make a move that gets out of check
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.color === color) {
        const moves = getPossibleMoves(board, r, c)
        if (moves.length > 0) {
          return false // There's at least one legal move
        }
      }
    }
  }

  // No legal moves and in check = checkmate
  return true
}

// Convert board position to algebraic notation
export function positionToAlgebraic(position: Position): string {
  const file = String.fromCharCode(97 + position.col) // a-h
  const rank = 8 - position.row // 1-8
  return `${file}${rank}`
}

// Generate chess notation for a move
export function getMoveNotation(
  board: (ChessPiece | null)[][],
  from: Position,
  to: Position,
  isCheckAfterMove: boolean,
  isCheckmateAfterMove: boolean,
  promotionPiece?: PieceType,
): string {
  const piece = board[from.row][from.col]
  if (!piece) return ""

  const capturedPiece = board[to.row][to.col]
  const isCapture = capturedPiece !== null

  // Handle castling
  if (piece.type === "king" && Math.abs(from.col - to.col) === 2) {
    return to.col > from.col ? "O-O" : "O-O-O"
  }

  // Piece symbol
  let notation = ""
  if (piece.type !== "pawn") {
    const pieceSymbols: Record<PieceType, string> = {
      pawn: "",
      rook: "R",
      knight: "N",
      bishop: "B",
      queen: "Q",
      king: "K",
    }
    notation += pieceSymbols[piece.type]

    // Disambiguation if needed
    const ambiguousPieces = findAmbiguousPieces(board, piece, from, to)
    if (ambiguousPieces.length > 0) {
      if (ambiguousPieces.every((p) => p.col !== from.col)) {
        notation += positionToAlgebraic(from)[0] // Add file
      } else if (ambiguousPieces.every((p) => p.row !== from.row)) {
        notation += positionToAlgebraic(from)[1] // Add rank
      } else {
        notation += positionToAlgebraic(from) // Add both
      }
    }
  }

  // Capture notation
  if (isCapture) {
    if (piece.type === "pawn") {
      notation += positionToAlgebraic(from)[0] // Add file for pawn captures
    }
    notation += "x"
  }

  // Destination square
  notation += positionToAlgebraic(to)

  // Pawn promotion
  if (piece.type === "pawn" && (to.row === 0 || to.row === 7)) {
    const promotionSymbols: Record<PieceType, string> = {
      queen: "Q",
      rook: "R",
      bishop: "B",
      knight: "N",
      pawn: "", // Should never happen
      king: "", // Should never happen
    }
    notation += "=" + promotionSymbols[promotionPiece || "queen"]
  }

  // Check and checkmate
  if (isCheckmateAfterMove) {
    notation += "#"
  } else if (isCheckAfterMove) {
    notation += "+"
  }

  return notation
}

// Find pieces that could also move to the same destination
function findAmbiguousPieces(
  board: (ChessPiece | null)[][],
  piece: ChessPiece,
  from: Position,
  to: Position,
): Position[] {
  const ambiguousPieces: Position[] = []

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      // Skip the piece itself
      if (r === from.row && c === from.col) continue

      const otherPiece = board[r][c]
      if (otherPiece && otherPiece.type === piece.type && otherPiece.color === piece.color) {
        const moves = getPossibleMoves(board, r, c)
        if (moves.some((move) => move.row === to.row && move.col === to.col)) {
          ambiguousPieces.push({ row: r, col: c })
        }
      }
    }
  }

  return ambiguousPieces
}

// Simple piece values for AI evaluation
const pieceValues: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0, // King has no material value since it can't be captured
}

// Evaluate board position (positive is good for white, negative is good for black)
function evaluateBoard(board: (ChessPiece | null)[][]): number {
  let score = 0

  // Material evaluation
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece) {
        const value = pieceValues[piece.type]
        score += piece.color === "white" ? value : -value
      }
    }
  }

  // Position evaluation - bonus for center control
  for (let r = 2; r < 6; r++) {
    for (let c = 2; c < 6; c++) {
      const piece = board[r][c]
      if (piece) {
        const centerValue = (r === 3 || r === 4) && (c === 3 || c === 4) ? 0.3 : 0.1
        score += piece.color === "white" ? centerValue : -centerValue
      }
    }
  }

  // Check and checkmate evaluation
  if (isCheckmate(board, "white")) {
    score = -1000 // Black wins
  } else if (isCheckmate(board, "black")) {
    score = 1000 // White wins
  } else if (isCheck(board, "white")) {
    score -= 0.5 // White is in check
  } else if (isCheck(board, "black")) {
    score += 0.5 // Black is in check
  }

  return score
}

// Minimax algorithm with alpha-beta pruning
function minimax(
  board: (ChessPiece | null)[][],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  color: PieceColor,
): { score: number; move?: { from: Position; to: Position } } {
  // Base case: reached max depth or game over
  if (depth === 0 || isCheckmate(board, "white") || isCheckmate(board, "black")) {
    return { score: evaluateBoard(board) }
  }

  // Find all possible moves for the current player
  const moves: { from: Position; to: Position }[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.color === color) {
        const possibleMoves = getPossibleMoves(board, r, c)
        for (const move of possibleMoves) {
          moves.push({ from: { row: r, col: c }, to: move })
        }
      }
    }
  }

  // No moves available
  if (moves.length === 0) {
    return { score: evaluateBoard(board) }
  }

  let bestMove: { from: Position; to: Position } | undefined

  if (isMaximizing) {
    let maxScore = Number.NEGATIVE_INFINITY
    for (const move of moves) {
      // Make move
      const newBoard = movePiece(board, move.from.row, move.from.col, move.to.row, move.to.col)

      // Recursive evaluation
      const result = minimax(newBoard, depth - 1, alpha, beta, false, color === "white" ? "black" : "white")

      // Update best score
      if (result.score > maxScore) {
        maxScore = result.score
        bestMove = move
      }

      // Alpha-beta pruning
      alpha = Math.max(alpha, maxScore)
      if (beta <= alpha) break
    }
    return { score: maxScore, move: bestMove }
  } else {
    let minScore = Number.POSITIVE_INFINITY
    for (const move of moves) {
      // Make move
      const newBoard = movePiece(board, move.from.row, move.from.col, move.to.row, move.to.col)

      // Recursive evaluation
      const result = minimax(newBoard, depth - 1, alpha, beta, true, color === "white" ? "black" : "white")

      // Update best score
      if (result.score < minScore) {
        minScore = result.score
        bestMove = move
      }

      // Alpha-beta pruning
      beta = Math.min(beta, minScore)
      if (beta <= alpha) break
    }
    return { score: minScore, move: bestMove }
  }
}

// Get AI move based on difficulty
export function getAIMove(
  board: (ChessPiece | null)[][],
  color: PieceColor,
  difficulty: "easy" | "medium" | "hard",
): { from: Position; to: Position; promotion?: boolean } | null {
  // Set search depth based on difficulty
  let depth = 1
  switch (difficulty) {
    case "easy":
      depth = 1
      break
    case "medium":
      depth = 2
      break
    case "hard":
      depth = 3
      break
  }

  // For easy difficulty, sometimes make a random move
  if (difficulty === "easy" && Math.random() < 0.3) {
    const allMoves: { from: Position; to: Position; promotion?: boolean }[] = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece && piece.color === color) {
          const possibleMoves = getPossibleMoves(board, r, c)
          for (const move of possibleMoves) {
            // Check if this is a promotion move
            const isPromotion =
              piece.type === "pawn" && ((color === "white" && move.row === 0) || (color === "black" && move.row === 7))

            allMoves.push({
              from: { row: r, col: c },
              to: move,
              promotion: isPromotion,
            })
          }
        }
      }
    }

    if (allMoves.length > 0) {
      const randomIndex = Math.floor(Math.random() * allMoves.length)
      return allMoves[randomIndex]
    }
  }

  // Use minimax for normal move selection
  const isMaximizing = color === "white"
  const result = minimax(board, depth, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, isMaximizing, color)

  if (result.move) {
    // Check if this is a promotion move
    const piece = board[result.move.from.row][result.move.from.col]
    const isPromotion =
      piece?.type === "pawn" &&
      ((color === "white" && result.move.to.row === 0) || (color === "black" && result.move.to.row === 7))

    return {
      ...result.move,
      promotion: isPromotion,
    }
  }

  return null
}
