import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"
import type { PieceColor } from "@/lib/chess-logic"

interface TimeControlProps {
  time: number
  color: PieceColor
  isActive: boolean
}

export function TimeControl({ time, color, isActive }: TimeControlProps) {
  // Format time as mm:ss
  const minutes = Math.floor(time / 60)
  const seconds = time % 60
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`

  // Warning colors when time is running low
  const getTimeColor = () => {
    if (time < 10) return "text-red-600"
    if (time < 30) return "text-amber-600"
    return ""
  }

  return (
    <div
      className={cn(
        "flex-1 flex items-center justify-between p-3 rounded-md border",
        color === "white" ? "bg-white" : "bg-slate-800",
        isActive && "ring-2 ring-blue-500",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-3 h-3 rounded-full",
            color === "white" ? "bg-white border border-slate-300" : "bg-slate-800",
          )}
        />
        <span className={color === "white" ? "text-slate-800" : "text-white"}>
          {color === "white" ? "White" : "Black"}
        </span>
      </div>

      <div
        className={cn(
          "flex items-center gap-1 font-mono font-bold",
          color === "white" ? "text-slate-800" : "text-white",
          getTimeColor(),
        )}
      >
        <Clock size={16} />
        {formattedTime}
      </div>
    </div>
  )
}
