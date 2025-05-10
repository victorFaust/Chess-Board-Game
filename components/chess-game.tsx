"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ChessBoard } from "./chess-board"
import { MoveHistory } from "./move-history"
import { TimeControl } from "./time-control"
import {
  initialBoard,
  getPossibleMoves,
  movePiece,
  isCheck,
  isCheckmate,
  type ChessPiece,
  type PieceColor,
  getAIMove,
  getMoveNotation,
  type Position,
  type PieceType,
} from "@/lib/chess-logic"

export interface ChessMove {
  from: Position
  to: Position
  piece: ChessPiece
  capturedPiece: ChessPiece | null
  notation: string
  boardState: (ChessPiece | null)[][]
}

export default function ChessGame() {
  const [board, setBoard] = useState(initialBoard())
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<Position[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white")
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState<PieceColor | "timeout" | null>(null)
  const [isInCheck, setIsInCheck] = useState<PieceColor | null>(null)
  const [moveHistory, setMoveHistory] = useState<ChessMove[]>([])
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null)
  const [aiOpponent, setAiOpponent] = useState(false)
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [timeControl, setTimeControl] = useState<number>(10 * 60) // 10 minutes in seconds
  const [whiteTime, setWhiteTime] = useState<number>(10 * 60)
  const [blackTime, setBlackTime] = useState<number>(10 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [promotionPending, setPromotionPending] = useState<{
    from: Position
    to: Position
    color: PieceColor
  } | null>(null)

  // Initialize or reset timers when time control changes
  useEffect(() => {
    setWhiteTime(timeControl)
    setBlackTime(timeControl)
  }, [timeControl])

  // Timer logic
  useEffect(() => {
    if (gameOver || !isTimerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      return
    }

    timerRef.current = setInterval(() => {
      if (currentPlayer === "white") {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            // White loses on time
            setGameOver(true)
            setWinner("black")
            setIsTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            // Black loses on time
            setGameOver(true)
            setWinner("white")
            setIsTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [currentPlayer, gameOver, isTimerRunning])

  // Check for checkmate after each move
  useEffect(() => {
    if (viewingMoveIndex !== null) return // Don't check while viewing history

    const whiteInCheck = isCheck(board, "white")
    const blackInCheck = isCheck(board, "black")

    if (whiteInCheck) setIsInCheck("white")
    else if (blackInCheck) setIsInCheck("black")
    else setIsInCheck(null)

    if (whiteInCheck && isCheckmate(board, "white")) {
      setGameOver(true)
      setWinner("black")
      setIsTimerRunning(false)
    } else if (blackInCheck && isCheckmate(board, "black")) {
      setGameOver(true)
      setWinner("white")
      setIsTimerRunning(false)
    }
  }, [board, currentPlayer, viewingMoveIndex])

  // AI move logic
  useEffect(() => {
    if (aiOpponent && currentPlayer === "black" && !gameOver && viewingMoveIndex === null && !promotionPending) {
      // Add a small delay to make the AI move feel more natural
      const aiMoveTimeout = setTimeout(() => {
        const aiMove = getAIMove(board, "black", aiDifficulty)
        if (aiMove) {
          if (aiMove.promotion) {
            // AI always promotes to queen for simplicity
            const { from, to } = aiMove

            // Create new board with the promotion move
            const newBoard = movePiece(board, from.row, from.col, to.row, to.col, "queen")

            // Generate move notation with promotion
            const notation = getMoveNotation(
              board,
              from,
              to,
              isCheck(newBoard, "white"),
              isCheckmate(newBoard, "white"),
              "queen",
            )

            // Record the move in history
            const piece = board[from.row][from.col]
            const capturedPiece = board[to.row][to.col]

            const move: ChessMove = {
              from,
              to,
              piece: { ...piece! },
              capturedPiece: capturedPiece ? { ...capturedPiece } : null,
              notation,
              boardState: JSON.parse(JSON.stringify(newBoard)),
            }

            setMoveHistory([...moveHistory, move])
            setBoard(newBoard)
            setCurrentPlayer("white")
          } else {
            makeMove(aiMove.from.row, aiMove.from.col, aiMove.to.row, aiMove.to.col)
          }
        }
      }, 500)

      return () => clearTimeout(aiMoveTimeout)
    }
  }, [aiOpponent, currentPlayer, gameOver, board, aiDifficulty, viewingMoveIndex, promotionPending])

  const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const piece = board[fromRow][fromCol]
    const capturedPiece = board[toRow][toCol]

    // Check for pawn promotion
    if (
      piece?.type === "pawn" &&
      ((piece.color === "white" && toRow === 0) || (piece.color === "black" && toRow === 7))
    ) {
      // Set promotion pending and wait for user selection
      setPromotionPending({
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        color: piece.color,
      })
      return
    }

    // Create new board with the move
    const newBoard = movePiece(board, fromRow, fromCol, toRow, toCol)

    // Generate move notation
    const notation = getMoveNotation(
      board,
      { row: fromRow, col: fromCol },
      { row: toRow, col: toCol },
      isCheck(newBoard, currentPlayer === "white" ? "black" : "white"),
      isCheckmate(newBoard, currentPlayer === "white" ? "black" : "white"),
    )

    // Record the move in history
    const move: ChessMove = {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: { ...piece! },
      capturedPiece: capturedPiece ? { ...capturedPiece } : null,
      notation,
      boardState: JSON.parse(JSON.stringify(newBoard)),
    }

    // If we're viewing history, truncate the history up to that point
    const newHistory =
      viewingMoveIndex !== null ? [...moveHistory.slice(0, viewingMoveIndex + 1), move] : [...moveHistory, move]

    setMoveHistory(newHistory)
    setBoard(newBoard)
    setCurrentPlayer(currentPlayer === "white" ? "black" : "white")
    setSelectedPiece(null)
    setPossibleMoves([])
    setViewingMoveIndex(null)

    // Start the timer if it's not already running
    if (!isTimerRunning) {
      setIsTimerRunning(true)
    }
  }

  const handlePromotion = (pieceType: PieceType) => {
    if (!promotionPending) return

    const { from, to } = promotionPending

    // Create new board with the promotion move
    const newBoard = movePiece(board, from.row, from.col, to.row, to.col, pieceType)

    // Generate move notation with promotion
    const notation = getMoveNotation(
      board,
      from,
      to,
      isCheck(newBoard, currentPlayer === "white" ? "black" : "white"),
      isCheckmate(newBoard, currentPlayer === "white" ? "black" : "white"),
      pieceType,
    )

    // Record the move in history
    const piece = board[from.row][from.col]
    const capturedPiece = board[to.row][to.col]

    const move: ChessMove = {
      from,
      to,
      piece: { ...piece! },
      capturedPiece: capturedPiece ? { ...capturedPiece } : null,
      notation,
      boardState: JSON.parse(JSON.stringify(newBoard)),
    }

    // If we're viewing history, truncate the history up to that point
    const newHistory =
      viewingMoveIndex !== null ? [...moveHistory.slice(0, viewingMoveIndex + 1), move] : [...moveHistory, move]

    setMoveHistory(newHistory)
    setBoard(newBoard)
    setCurrentPlayer(currentPlayer === "white" ? "black" : "white")
    setSelectedPiece(null)
    setPossibleMoves([])
    setViewingMoveIndex(null)
    setPromotionPending(null)

    // Start the timer if it's not already running
    if (!isTimerRunning) {
      setIsTimerRunning(true)
    }
  }

  const handleSquareClick = (row: number, col: number) => {
    // If viewing history, don't allow moves
    if (viewingMoveIndex !== null) return

    const piece = board[row][col]

    // If a piece is already selected
    if (selectedPiece) {
      // Check if the clicked square is a valid move
      const isValidMove = possibleMoves.some((move) => move.row === row && move.col === col)

      if (isValidMove) {
        makeMove(selectedPiece.row, selectedPiece.col, row, col)
      } else if (piece && piece.color === currentPlayer) {
        // Select a different piece of the same color
        setSelectedPiece({ row, col })
        setPossibleMoves(getPossibleMoves(board, row, col))
      } else {
        // Deselect the piece
        setSelectedPiece(null)
        setPossibleMoves([])
      }
    } else if (piece && piece.color === currentPlayer && !(aiOpponent && currentPlayer === "black")) {
      // Select a piece (but not if it's AI's turn)
      setSelectedPiece({ row, col })
      setPossibleMoves(getPossibleMoves(board, row, col))
    }
  }

  const viewHistoryMove = (index: number) => {
    if (index < 0 || index >= moveHistory.length) {
      setViewingMoveIndex(null)
      setBoard(moveHistory[moveHistory.length - 1].boardState)
    } else {
      setViewingMoveIndex(index)
      setBoard(moveHistory[index].boardState)
    }
  }

  const resetGame = () => {
    setBoard(initialBoard())
    setSelectedPiece(null)
    setPossibleMoves([])
    setCurrentPlayer("white")
    setGameOver(false)
    setWinner(null)
    setIsInCheck(null)
    setMoveHistory([])
    setViewingMoveIndex(null)
    setWhiteTime(timeControl)
    setBlackTime(timeControl)
    setIsTimerRunning(false)
  }

  const handleTimeControlChange = (value: string) => {
    const minutes = Number.parseInt(value, 10)
    setTimeControl(minutes * 60)
    setWhiteTime(minutes * 60)
    setBlackTime(minutes * 60)
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl">
      <div className="flex flex-col items-center">
        <div className="mb-4 flex items-center justify-between w-full max-w-md">
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full ${
                currentPlayer === "white" ? "bg-white" : "bg-slate-800"
              } border border-slate-400`}
            ></div>
            <span className="font-medium">{currentPlayer === "white" ? "White" : "Black"}'s turn</span>
          </div>
          {isInCheck && !gameOver && (
            <div className="text-red-500 font-bold">{isInCheck === "white" ? "White" : "Black"} is in check!</div>
          )}
          {viewingMoveIndex !== null && <div className="text-amber-500 font-bold">Viewing move history</div>}
        </div>

        <div className="flex gap-4 mb-4 w-full max-w-md">
          <TimeControl time={whiteTime} color="white" isActive={currentPlayer === "white" && isTimerRunning} />
          <TimeControl time={blackTime} color="black" isActive={currentPlayer === "black" && isTimerRunning} />
        </div>

        <div className="bg-white rounded-lg shadow-xl p-4 mb-6">
          <ChessBoard
            board={board}
            selectedPiece={selectedPiece}
            possibleMoves={possibleMoves}
            onSquareClick={handleSquareClick}
            flipped={aiOpponent && currentPlayer === "black"}
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          <Button variant="outline" size="sm" onClick={resetGame}>
            New Game
          </Button>

          {viewingMoveIndex !== null && (
            <Button variant="outline" size="sm" onClick={() => viewHistoryMove(-1)}>
              Return to Game
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch id="ai-opponent" checked={aiOpponent} onCheckedChange={setAiOpponent} />
              <Label htmlFor="ai-opponent">AI Opponent</Label>
            </div>

            {aiOpponent && (
              <Select value={aiDifficulty} onValueChange={(value) => setAiDifficulty(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Select value={String(timeControl / 60)} onValueChange={handleTimeControlChange}>
              <SelectTrigger>
                <SelectValue placeholder="Time Control" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 minute</SelectItem>
                <SelectItem value="3">3 minutes</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[250px] max-w-[350px]">
        <MoveHistory moves={moveHistory} currentIndex={viewingMoveIndex} onSelectMove={viewHistoryMove} />
      </div>

      <AlertDialog open={gameOver}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Game Over!</AlertDialogTitle>
            <AlertDialogDescription>
              {winner === "timeout"
                ? `${currentPlayer === "white" ? "Black" : "White"} wins on time!`
                : winner && `${winner === "white" ? "White" : "Black"} wins by checkmate!`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={resetGame}>Play Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pawn Promotion Dialog */}
      {promotionPending && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold mb-4 text-center">Choose promotion piece</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handlePromotion("queen")}
                className="w-16 h-16 flex items-center justify-center text-4xl bg-slate-100 hover:bg-slate-200 rounded"
              >
                {promotionPending.color === "white" ? "♕" : "♛"}
              </button>
              <button
                onClick={() => handlePromotion("rook")}
                className="w-16 h-16 flex items-center justify-center text-4xl bg-slate-100 hover:bg-slate-200 rounded"
              >
                {promotionPending.color === "white" ? "♖" : "♜"}
              </button>
              <button
                onClick={() => handlePromotion("bishop")}
                className="w-16 h-16 flex items-center justify-center text-4xl bg-slate-100 hover:bg-slate-200 rounded"
              >
                {promotionPending.color === "white" ? "♗" : "♝"}
              </button>
              <button
                onClick={() => handlePromotion("knight")}
                className="w-16 h-16 flex items-center justify-center text-4xl bg-slate-100 hover:bg-slate-200 rounded"
              >
                {promotionPending.color === "white" ? "♘" : "♞"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
