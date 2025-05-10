"use client"

import { useState, useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/lib/user-context"
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
  type Position,
  type PieceType,
} from "@/lib/chess-logic"
import type { ChessMove } from "./chess-game"
import { UserProfile } from "./user-profile"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { Loader2, RefreshCw, Users } from "lucide-react"

// Game states
type GameState = "lobby" | "waiting" | "playing" | "gameOver"

// Game types
interface Game {
  id: string
  name: string
  createdBy: string
  players: string[]
  timeControl: number
}

// Socket events
interface ServerToClientEvents {
  gameCreated: (game: Game) => void
  gameJoined: (game: Game) => void
  gamesList: (games: Game[]) => void
  gameStarted: (gameData: {
    id: string
    whitePlayer: string
    blackPlayer: string
    timeControl: number
  }) => void
  playerMove: (moveData: {
    from: Position
    to: Position
    promotionPiece?: PieceType
  }) => void
  gameOver: (result: {
    winner: PieceColor | "draw" | null
    reason: string
  }) => void
  playerDisconnected: (playerId: string) => void
  playerReconnected: (playerId: string) => void
  error: (message: string) => void
}

interface ClientToServerEvents {
  createGame: (game: { name: string; timeControl: number }) => void
  joinGame: (gameId: string) => void
  leaveGame: () => void
  makeMove: (moveData: {
    from: Position
    to: Position
    promotionPiece?: PieceType
  }) => void
  getGames: () => void
}

export default function OnlineChess() {
  const { toast } = useToast()
  const { user, setUser } = useUser()
  const [username, setUsername] = useState("")
  const [gameState, setGameState] = useState<GameState>("lobby")
  const [availableGames, setAvailableGames] = useState<Game[]>([])
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [gameName, setGameName] = useState("")
  const [timeControlMinutes, setTimeControlMinutes] = useState("10")
  const [playerColor, setPlayerColor] = useState<PieceColor | null>(null)
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [board, setBoard] = useState(initialBoard())
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null)
  const [possibleMoves, setPossibleMoves] = useState<Position[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white")
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState<{
    winner: PieceColor | "draw" | null
    reason: string
  } | null>(null)
  const [isInCheck, setIsInCheck] = useState<PieceColor | null>(null)
  const [moveHistory, setMoveHistory] = useState<ChessMove[]>([])
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null)
  const [whiteTime, setWhiteTime] = useState<number>(10 * 60)
  const [blackTime, setBlackTime] = useState<number>(10 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  const [promotionPending, setPromotionPending] = useState<{
    from: Position
    to: Position
    color: PieceColor
  } | null>(null)
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isRefreshingGames, setIsRefreshingGames] = useState(false)
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize socket connection
  useEffect(() => {
    if (!user) return

    // Connect to the WebSocket server
    socketRef.current = io("/api/socket", {
      path: "/api/socket",
      addTrailingSlash: false,
      auth: {
        username: user.name,
      },
    })

    // Set up event listeners
    const socket = socketRef.current

    socket.on("connect", () => {
      console.log("Connected to server")
      socket.emit("getGames")
    })

    socket.on("gamesList", (games) => {
      setAvailableGames(games)
      setIsRefreshingGames(false)
    })

    socket.on("gameCreated", (game) => {
      setCurrentGame(game)
      setGameState("waiting")
      setIsCreatingGame(false)
      toast({
        title: "Game created",
        description: "Waiting for an opponent to join...",
      })
    })

    socket.on("gameJoined", (game) => {
      setCurrentGame(game)
      toast({
        title: "Game joined",
        description: "Waiting for the game to start...",
      })
    })

    socket.on("gameStarted", (gameData) => {
      setGameState("playing")
      setBoard(initialBoard())
      setCurrentPlayer("white")
      setMoveHistory([])
      setSelectedPiece(null)
      setPossibleMoves([])
      setGameOver(false)
      setGameResult(null)
      setIsInCheck(null)
      setViewingMoveIndex(null)
      setOpponentDisconnected(false)

      // Set player colors and opponent name
      if (gameData.whitePlayer === user.name) {
        setPlayerColor("white")
        setOpponentName(gameData.blackPlayer)
      } else {
        setPlayerColor("black")
        setOpponentName(gameData.whitePlayer)
      }

      // Set time controls
      const timeInSeconds = gameData.timeControl * 60
      setWhiteTime(timeInSeconds)
      setBlackTime(timeInSeconds)
      setIsTimerRunning(true)

      toast({
        title: "Game started!",
        description: `You are playing as ${gameData.whitePlayer === user.name ? "White" : "Black"}`,
      })
    })

    socket.on("playerMove", (moveData) => {
      handleOpponentMove(moveData.from, moveData.to, moveData.promotionPiece)
    })

    socket.on("gameOver", (result) => {
      setGameOver(true)
      setGameResult(result)
      setIsTimerRunning(false)
      setGameState("gameOver")
    })

    socket.on("playerDisconnected", (playerId) => {
      if (gameState === "playing") {
        setOpponentDisconnected(true)
        toast({
          title: "Opponent disconnected",
          description: "Your opponent has disconnected. The game will resume if they reconnect.",
          variant: "destructive",
        })
      }
    })

    socket.on("playerReconnected", (playerId) => {
      if (gameState === "playing") {
        setOpponentDisconnected(false)
        toast({
          title: "Opponent reconnected",
          description: "Your opponent has reconnected. The game will continue.",
        })
      }
    })

    socket.on("error", (message) => {
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [user, gameState, toast])

  // Timer logic
  useEffect(() => {
    if (gameState !== "playing" || !isTimerRunning || gameOver || opponentDisconnected) {
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
            if (socketRef.current) {
              socketRef.current.emit("makeMove", {
                from: { row: -1, col: -1 }, // Special move to indicate time out
                to: { row: -1, col: -1 },
              })
            }
            setGameOver(true)
            setGameResult({
              winner: "black",
              reason: "timeout",
            })
            setIsTimerRunning(false)
            return 0
          }
          return prev - 1
        })
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            // Black loses on time
            if (socketRef.current) {
              socketRef.current.emit("makeMove", {
                from: { row: -1, col: -1 }, // Special move to indicate time out
                to: { row: -1, col: -1 },
              })
            }
            setGameOver(true)
            setGameResult({
              winner: "white",
              reason: "timeout",
            })
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
  }, [currentPlayer, gameState, isTimerRunning, gameOver, opponentDisconnected])

  // Check for checkmate after each move
  useEffect(() => {
    if (gameState !== "playing" || viewingMoveIndex !== null) return

    const whiteInCheck = isCheck(board, "white")
    const blackInCheck = isCheck(board, "black")

    if (whiteInCheck) setIsInCheck("white")
    else if (blackInCheck) setIsInCheck("black")
    else setIsInCheck(null)

    // Let the server handle checkmate detection
  }, [board, currentPlayer, viewingMoveIndex, gameState])

  const handleLogin = () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to continue",
        variant: "destructive",
      })
      return
    }

    setUser({ name: username.trim() })
  }

  const createGame = () => {
    if (!socketRef.current) return

    if (!gameName.trim()) {
      toast({
        title: "Game name required",
        description: "Please enter a name for your game",
        variant: "destructive",
      })
      return
    }

    setIsCreatingGame(true)
    socketRef.current.emit("createGame", {
      name: gameName.trim(),
      timeControl: Number.parseInt(timeControlMinutes, 10),
    })
  }

  const joinGame = (gameId: string) => {
    if (!socketRef.current) return
    socketRef.current.emit("joinGame", gameId)
  }

  const leaveGame = () => {
    if (!socketRef.current) return
    socketRef.current.emit("leaveGame")
    setCurrentGame(null)
    setGameState("lobby")
    setBoard(initialBoard())
    setMoveHistory([])
    setSelectedPiece(null)
    setPossibleMoves([])
    setPlayerColor(null)
    setOpponentName(null)
  }

  const refreshGames = () => {
    if (!socketRef.current) return
    setIsRefreshingGames(true)
    socketRef.current.emit("getGames")
  }

  const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    if (!socketRef.current || gameState !== "playing") return

    const piece = board[fromRow][fromCol]

    // Check if it's a promotion move
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

    // Send the move to the server
    socketRef.current.emit("makeMove", {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
    })

    // Update the local board
    updateLocalBoard(fromRow, fromCol, toRow, toCol)
  }

  const handlePromotion = (pieceType: PieceType) => {
    if (!promotionPending || !socketRef.current) return

    const { from, to } = promotionPending

    // Send the promotion move to the server
    socketRef.current.emit("makeMove", {
      from,
      to,
      promotionPiece: pieceType,
    })

    // Update the local board with the promotion
    updateLocalBoard(from.row, from.col, to.row, to.col, pieceType)

    // Clear the promotion pending state
    setPromotionPending(null)
  }

  const handleOpponentMove = (from: Position, to: Position, promotionPiece?: PieceType) => {
    // Update the local board with the opponent's move
    updateLocalBoard(from.row, from.col, to.row, to.col, promotionPiece)
  }

  const updateLocalBoard = (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotionPiece?: PieceType,
  ) => {
    const piece = board[fromRow][fromCol]
    const capturedPiece = board[toRow][toCol]

    // Create new board with the move
    const newBoard = movePiece(board, fromRow, fromCol, toRow, toCol, promotionPiece)

    // Generate move notation
    const notation = getMoveNotation(
      board,
      { row: fromRow, col: fromCol },
      { row: toRow, col: toCol },
      isCheck(newBoard, currentPlayer === "white" ? "black" : "white"),
      isCheckmate(newBoard, currentPlayer === "white" ? "black" : "white"),
      promotionPiece,
    )

    // Record the move in history
    const move: ChessMove = {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: piece ? { ...piece } : { type: "pawn", color: "white" }, // Fallback for special moves
      capturedPiece: capturedPiece ? { ...capturedPiece } : null,
      notation,
      boardState: JSON.parse(JSON.stringify(newBoard)),
    }

    setMoveHistory((prev) => [...prev, move])
    setBoard(newBoard)
    setCurrentPlayer(currentPlayer === "white" ? "black" : "white")
    setSelectedPiece(null)
    setPossibleMoves([])
    setViewingMoveIndex(null)
  }

  const handleSquareClick = (row: number, col: number) => {
    // Only allow moves if it's the player's turn and the game is in progress
    if (
      gameState !== "playing" ||
      viewingMoveIndex !== null ||
      gameOver ||
      currentPlayer !== playerColor ||
      opponentDisconnected
    ) {
      return
    }

    const piece = board[row][col]

    // If a piece is already selected
    if (selectedPiece) {
      // Check if the clicked square is a valid move
      const isValidMove = possibleMoves.some((move) => move.row === row && move.col === col)

      if (isValidMove) {
        makeMove(selectedPiece.row, selectedPiece.col, row, col)
      } else if (piece && piece.color === playerColor) {
        // Select a different piece of the same color
        setSelectedPiece({ row, col })
        setPossibleMoves(getPossibleMoves(board, row, col))
      } else {
        // Deselect the piece
        setSelectedPiece(null)
        setPossibleMoves([])
      }
    } else if (piece && piece.color === playerColor) {
      // Select a piece
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

  // Helper function to generate move notation (simplified version)
  const getMoveNotation = (
    board: (ChessPiece | null)[][],
    from: Position,
    to: Position,
    isCheckAfterMove: boolean,
    isCheckmateAfterMove: boolean,
    promotionPiece?: PieceType,
  ): string => {
    // Special case for timeout or resignation
    if (from.row === -1 && from.col === -1) {
      return "Timeout/Resignation"
    }

    const piece = board[from.row][from.col]
    if (!piece) return ""

    // Get file and rank
    const fromFile = String.fromCharCode(97 + from.col)
    const fromRank = 8 - from.row
    const toFile = String.fromCharCode(97 + to.col)
    const toRank = 8 - to.row

    // Piece symbol
    const pieceSymbols: Record<PieceType, string> = {
      pawn: "",
      rook: "R",
      knight: "N",
      bishop: "B",
      queen: "Q",
      king: "K",
    }

    let notation = pieceSymbols[piece.type]

    // For pawns, include the file only on captures
    if (piece.type === "pawn" && from.col !== to.col) {
      notation += fromFile
    }

    // Add capture symbol if applicable
    if (board[to.row][to.col]) {
      notation += "x"
    }

    // Add destination
    notation += toFile + toRank

    // Add promotion if applicable
    if (promotionPiece && piece.type === "pawn" && (to.row === 0 || to.row === 7)) {
      notation += "=" + pieceSymbols[promotionPiece]
    }

    // Add check or checkmate symbol
    if (isCheckmateAfterMove) {
      notation += "#"
    } else if (isCheckAfterMove) {
      notation += "+"
    }

    return notation
  }

  // Render login form if no user
  if (!user) {
    return (
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Welcome to Chess Online</CardTitle>
          <CardDescription>Enter a username to start playing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLogin} className="w-full">
            Enter Lobby
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Render game lobby
  if (gameState === "lobby") {
    return (
      <div className="flex flex-col w-full max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Game Lobby</h2>
          <UserProfile />
        </div>

        <Tabs defaultValue="join">
          <TabsList className="grid grid-cols-2 w-[300px] mx-auto mb-6">
            <TabsTrigger value="join">Join Game</TabsTrigger>
            <TabsTrigger value="create">Create Game</TabsTrigger>
          </TabsList>

          <TabsContent value="join">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Available Games</CardTitle>
                  <Button variant="outline" size="sm" onClick={refreshGames} disabled={isRefreshingGames}>
                    {isRefreshingGames ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription>Select a game to join</CardDescription>
              </CardHeader>
              <CardContent>
                {availableGames.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
                    <p>No games available</p>
                    <p className="text-sm">Create a new game or wait for someone to host</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableGames.map((game) => (
                      <div
                        key={game.id}
                        className="flex justify-between items-center p-3 border rounded-md hover:bg-slate-50 cursor-pointer"
                        onClick={() => joinGame(game.id)}
                      >
                        <div>
                          <p className="font-medium">{game.name}</p>
                          <p className="text-sm text-muted-foreground">Created by: {game.createdBy}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{game.timeControl} min</Badge>
                          <Button size="sm">Join</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create a New Game</CardTitle>
                <CardDescription>Set up a game for others to join</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Game Name</label>
                    <Input placeholder="My Chess Game" value={gameName} onChange={(e) => setGameName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time Control (minutes per player)</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={timeControlMinutes}
                      onChange={(e) => setTimeControlMinutes(e.target.value)}
                    >
                      <option value="1">1 minute</option>
                      <option value="3">3 minutes</option>
                      <option value="5">5 minutes</option>
                      <option value="10">10 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                    </select>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={createGame} className="w-full" disabled={isCreatingGame}>
                  {isCreatingGame ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Game"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Render waiting room
  if (gameState === "waiting") {
    return (
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Waiting for Opponent</CardTitle>
          <CardDescription>Share this game with a friend to play</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-md">
              <p className="font-medium">{currentGame?.name}</p>
              <p className="text-sm text-muted-foreground">Time Control: {currentGame?.timeControl} minutes</p>
            </div>

            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>

            <p className="text-center text-muted-foreground">Waiting for someone to join your game...</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={leaveGame} className="w-full">
            Cancel Game
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Render the chess game
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
            <span className="font-medium">
              {currentPlayer === playerColor
                ? "Your turn"
                : opponentName
                  ? `${opponentName}'s turn`
                  : "Opponent's turn"}
            </span>
          </div>
          {isInCheck && !gameOver && (
            <div className="text-red-500 font-bold">{isInCheck === "white" ? "White" : "Black"} is in check!</div>
          )}
          {viewingMoveIndex !== null && <div className="text-amber-500 font-bold">Viewing move history</div>}
          {opponentDisconnected && <div className="text-red-500 font-bold">Opponent disconnected</div>}
        </div>

        <div className="flex gap-4 mb-4 w-full max-w-md">
          <TimeControl
            time={whiteTime}
            color="white"
            isActive={currentPlayer === "white" && isTimerRunning && !opponentDisconnected}
          />
          <TimeControl
            time={blackTime}
            color="black"
            isActive={currentPlayer === "black" && isTimerRunning && !opponentDisconnected}
          />
        </div>

        <div className="bg-white rounded-lg shadow-xl p-4 mb-6">
          <ChessBoard
            board={board}
            selectedPiece={selectedPiece}
            possibleMoves={possibleMoves}
            onSquareClick={handleSquareClick}
            flipped={playerColor === "black"}
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {viewingMoveIndex !== null && (
            <Button variant="outline" size="sm" onClick={() => viewHistoryMove(-1)}>
              Return to Game
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={leaveGame}>
            Leave Game
          </Button>
        </div>

        <div className="w-full max-w-md p-3 bg-slate-50 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white border border-slate-300"></div>
              <span className="font-medium">{playerColor === "white" ? user.name : opponentName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{playerColor === "black" ? user.name : opponentName}</span>
              <div className="w-3 h-3 rounded-full bg-slate-800"></div>
            </div>
          </div>
          <Separator className="my-2" />
          <div className="text-sm text-center text-muted-foreground">{currentGame?.timeControl} minute game</div>
        </div>
      </div>

      <div className="flex-1 min-w-[250px] max-w-[350px]">
        <MoveHistory moves={moveHistory} currentIndex={viewingMoveIndex} onSelectMove={viewHistoryMove} />
      </div>

      {/* Game Over Dialog */}
      <AlertDialog open={gameOver}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Game Over!</AlertDialogTitle>
            <AlertDialogDescription>
              {gameResult?.winner === "draw"
                ? "The game ended in a draw."
                : gameResult?.winner
                  ? gameResult.winner === playerColor
                    ? "You won the game!"
                    : "You lost the game."
                  : "The game has ended."}
              {gameResult?.reason && <p className="mt-2">Reason: {gameResult.reason}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={leaveGame}>Return to Lobby</AlertDialogAction>
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
