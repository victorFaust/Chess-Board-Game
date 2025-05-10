"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ChessGame from "@/components/chess-game"
import OnlineChess from "@/components/online-chess"
import { UserProvider } from "@/lib/user-context"

export function GameModeSwitcher() {
  const [activeTab, setActiveTab] = useState("local")

  return (
    <UserProvider>
      <Tabs defaultValue="local" className="w-full max-w-5xl" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-[400px] mx-auto mb-6">
          <TabsTrigger value="local">Local Game</TabsTrigger>
          <TabsTrigger value="online">Online Multiplayer</TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="flex justify-center">
          <ChessGame />
        </TabsContent>

        <TabsContent value="online" className="flex justify-center">
          <OnlineChess />
        </TabsContent>
      </Tabs>
    </UserProvider>
  )
}
