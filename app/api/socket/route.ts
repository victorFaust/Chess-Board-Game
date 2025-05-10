import { Server } from "socket.io"
import { v4 as uuidv4 } from "uuid"
import type { NextApiRequest, NextApiResponse } from "next"
import type { PieceType, Position } from "@/lib/chess-logic"

// Game types
interface Game {
  id: string
  name: string
  createdBy: string
  players: string[]
  timeControl: number
  status: "waiting" | "playing" | "finished"
  whitePlayer?: string
  blackPlayer?: string
}

// Player types
interface Player {
  id: string
  username: string
  gameId?: string
}

// Global state
const games: Record<string, Game> = {}
const players: Record<string, Player> = {}

// Socket.io server
const ioHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
    })

    io.on("connection", (socket) => {
      console.log("New connection", socket.id)

      // Get username from auth
      const username = socket.handshake.auth.username
      if (!username) {
        socket.disconnect()
        return
      }

      // Register player
      players[socket.id] = {
        id: socket.id,
        username,
      }

      // Get available games
      socket.on("getGames", () => {
        const availableGames = Object.values(games).filter(
          (game) => game.status === "waiting" && game.players.length < 2,
        )
        socket.emit("gamesList", availableGames)
      })

      // Create a new game
      socket.on("createGame", (gameData: { name: string; timeControl: number }) => {
        const gameId = uuidv4()
        const game: Game = {
          id: gameId,
          name: gameData.name,
          createdBy: username,
          players: [socket.id],
          timeControl: gameData.timeControl,
          status: "waiting",
        }

        games[gameId] = game
        players[socket.id].gameId = gameId

        socket.join(gameId)
        socket.emit("gameCreated", game)

        // Update game list for all clients in the lobby
        io.emit(
          "gamesList",
          Object.values(games).filter((game) => game.status === "waiting" && game.players.length < 2),
        )
      })

      // Join an existing game
      socket.on("joinGame", (gameId: string) => {
        const game = games[gameId]

        if (!game) {
          socket.emit("error", "Game not found")
          return
        }

        if (game.status !== "waiting") {
          socket.emit("error", "Game already started")
          return
        }

        if (game.players.length >= 2) {
          socket.emit("error", "Game is full")
          return
        }

        // Add player to game
        game.players.push(socket.id)
        players[socket.id].gameId = gameId

        socket.join(gameId)
        socket.emit("gameJoined", game)

        // Start the game if we have 2 players
        if (game.players.length === 2) {
          // Randomly assign colors
          const isFirstPlayerWhite = Math.random() < 0.5

          game.whitePlayer = players[game.players[isFirstPlayerWhite ? 0 : 1]].username
          game.blackPlayer = players[game.players[isFirstPlayerWhite ? 1 : 0]].username
          game.status = "playing"

          // Notify both players that the game has started
          io.to(gameId).emit("gameStarted", {
            id: gameId,
            whitePlayer: game.whitePlayer,
            blackPlayer: game.blackPlayer,
            timeControl: game.timeControl,
          })

          // Update game list for all clients in the lobby
          io.emit(
            "gamesList",
            Object.values(games).filter((game) => game.status === "waiting" && game.players.length < 2),
          )
        }
      })

      // Leave game
      socket.on("leaveGame", () => {
        const player = players[socket.id]
        if (!player || !player.gameId) return

        const gameId = player.gameId
        const game = games[gameId]

        if (!game) return

        // Remove player from game
        game.players = game.players.filter((id) => id !== socket.id)
        player.gameId = undefined

        // If game is in progress, notify other player and end game
        if (game.status === "playing" && game.players.length === 1) {
          game.status = "finished"

          io.to(gameId).emit("gameOver", {
            winner: game.whitePlayer === username ? "black" : "white",
            reason: "opponent_left",
          })
        }

        // If no players left, remove the game
        if (game.players.length === 0) {
          delete games[gameId]
        }

        socket.leave(gameId)

        // Update game list for all clients in the lobby
        io.emit(
          "gamesList",
          Object.values(games).filter((game) => game.status === "waiting" && game.players.length < 2),
        )
      })

      // Make a move
      socket.on(
        "makeMove",
        (moveData: {
          from: Position
          to: Position
          promotionPiece?: PieceType
        }) => {
          const player = players[socket.id]
          if (!player || !player.gameId) return

          const gameId = player.gameId
          const game = games[gameId]

          if (!game || game.status !== "playing") return

          // Broadcast the move to the other player
          socket.to(gameId).emit("playerMove", moveData)

          // Special case for timeout or resignation
          if (moveData.from.row === -1 && moveData.from.col === -1) {
            game.status = "finished"

            io.to(gameId).emit("gameOver", {
              winner: game.whitePlayer === username ? "black" : "white",
              reason: "timeout",
            })
          }
        },
      )

      // Handle disconnection
      socket.on("disconnect", () => {
        const player = players[socket.id]
        if (!player) return

        // If player was in a game, handle it
        if (player.gameId) {
          const gameId = player.gameId
          const game = games[gameId]

          if (game) {
            // Notify other players of disconnection
            socket.to(gameId).emit("playerDisconnected", socket.id)

            // If game was in progress, end it after a timeout
            if (game.status === "playing") {
              // We could implement a reconnection window here
              // For now, just end the game immediately
              game.status = "finished"

              io.to(gameId).emit("gameOver", {
                winner: game.whitePlayer === username ? "black" : "white",
                reason: "disconnection",
              })
            }

            // Remove player from game
            game.players = game.players.filter((id) => id !== socket.id)

            // If no players left, remove the game
            if (game.players.length === 0) {
              delete games[gameId]
            }
          }
        }

        // Remove player
        delete players[socket.id]

        // Update game list for all clients in the lobby
        io.emit(
          "gamesList",
          Object.values(games).filter((game) => game.status === "waiting" && game.players.length < 2),
        )
      })
    })

    res.socket.server.io = io
  }

  res.end()
}

export const GET = ioHandler
export const POST = ioHandler
