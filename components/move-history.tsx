"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { ChessMove } from "./chess-game"

interface MoveHistoryProps {
  moves: ChessMove[]
  currentIndex: number | null
  onSelectMove: (index: number) => void
}

export function MoveHistory({ moves, currentIndex, onSelectMove }: MoveHistoryProps) {
  // Group moves by pairs (white and black)
  const movesByTurn: { white: ChessMove; black?: ChessMove }[] = []

  for (let i = 0; i < moves.length; i += 2) {
    movesByTurn.push({
      white: moves[i],
      black: moves[i + 1],
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full">
      <h3 className="text-lg font-bold mb-2">Move History</h3>

      <ScrollArea className="h-[400px] pr-4">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left w-10">#</th>
              <th className="text-left">White</th>
              <th className="text-left">Black</th>
            </tr>
          </thead>
          <tbody>
            {movesByTurn.map((turn, turnIndex) => (
              <tr key={turnIndex} className="border-b border-gray-100 last:border-0">
                <td className="py-2 text-gray-500">{turnIndex + 1}.</td>
                <td className="py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`px-2 h-auto ${currentIndex === turnIndex * 2 ? "bg-blue-100" : ""}`}
                    onClick={() => onSelectMove(turnIndex * 2)}
                  >
                    {turn.white.notation}
                  </Button>
                </td>
                <td className="py-2">
                  {turn.black && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`px-2 h-auto ${currentIndex === turnIndex * 2 + 1 ? "bg-blue-100" : ""}`}
                      onClick={() => onSelectMove(turnIndex * 2 + 1)}
                    >
                      {turn.black.notation}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {moves.length === 0 && <div className="text-center py-4 text-gray-500">No moves yet</div>}
      </ScrollArea>

      {currentIndex !== null && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => onSelectMove(-1)}>
            Return to Current Position
          </Button>
        </div>
      )}
    </div>
  )
}
