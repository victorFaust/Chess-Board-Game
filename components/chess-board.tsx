"use client"

import { cn } from "@/lib/utils"
import type { ChessPiece } from "@/lib/chess-logic"
import type { Position } from "@/lib/chess-logic"

interface ChessBoardProps {
  board: (ChessPiece | null)[][]
  selectedPiece: Position | null
  possibleMoves: Position[]
  onSquareClick: (row: number, col: number) => void
  flipped?: boolean
}

export function ChessBoard({ board, selectedPiece, possibleMoves, onSquareClick, flipped = false }: ChessBoardProps) {
  const isSelected = (row: number, col: number) => {
    return selectedPiece?.row === row && selectedPiece?.col === col
  }

  const isPossibleMove = (row: number, col: number) => {
    return possibleMoves.some((move) => move.row === row && move.col === col)
  }

  const renderPiece = (piece: ChessPiece | null) => {
    if (!piece) return null

    const pieceSymbols: Record<string, string> = {
      "white-pawn": "♙",
      "white-rook": "♖",
      "white-knight": "♘",
      "white-bishop": "♗",
      "white-queen": "♕",
      "white-king": "♔",
      "black-pawn": "♟",
      "black-rook": "♜",
      "black-knight": "♞",
      "black-bishop": "♝",
      "black-queen": "♛",
      "black-king": "♚",
    }

    const pieceKey = `${piece.color}-${piece.type}`
    return (
      <div className={`text-4xl ${piece.color === "white" ? "text-white" : "text-slate-800"}`}>
        {pieceSymbols[pieceKey]}
      </div>
    )
  }

  // Create the board rows and columns in the correct order based on flipped state
  const rows = [...Array(8).keys()]
  const cols = [...Array(8).keys()]

  if (flipped) {
    rows.reverse()
    cols.reverse()
  }

  return (
    <div className="grid grid-cols-8 gap-0 border-2 border-slate-800">
      {rows.map((rowIndex) =>
        cols.map((colIndex) => {
          const isBlackSquare = (rowIndex + colIndex) % 2 === 1
          const isSelected_ = isSelected(rowIndex, colIndex)
          const isPossibleMove_ = isPossibleMove(rowIndex, colIndex)

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center relative",
                isBlackSquare ? "bg-slate-600" : "bg-slate-200",
                isSelected_ && "ring-4 ring-yellow-400 ring-inset",
                isPossibleMove_ && board[rowIndex][colIndex] && "ring-4 ring-red-500 ring-inset",
              )}
              onClick={() => onSquareClick(rowIndex, colIndex)}
            >
              {renderPiece(board[rowIndex][colIndex])}
              {isPossibleMove_ && !board[rowIndex][colIndex] && (
                <div className="absolute w-3 h-3 rounded-full bg-slate-400 opacity-70"></div>
              )}
              {/* Coordinates - adjust based on flipped state */}
              {(flipped ? colIndex === 7 : colIndex === 0) && (
                <div className="absolute left-0.5 top-0 text-xs font-bold">{8 - rowIndex}</div>
              )}
              {(flipped ? rowIndex === 0 : rowIndex === 7) && (
                <div className="absolute right-0.5 bottom-0 text-xs font-bold">
                  {String.fromCharCode(97 + colIndex)}
                </div>
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}
