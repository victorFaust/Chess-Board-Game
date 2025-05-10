import { Suspense } from "react"
import { GameModeSwitcher } from "@/components/game-mode-switcher"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-200">
      <h1 className="text-3xl font-bold mb-4 text-slate-800">Chess Game</h1>

      <Suspense fallback={<div>Loading game modes...</div>}>
        <GameModeSwitcher />
      </Suspense>
    </main>
  )
}
