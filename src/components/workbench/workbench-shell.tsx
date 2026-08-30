"use client"

import { useState } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { HomeCanvas } from "./home-canvas"
import { Sidebar } from "./sidebar"
import { TitleBar } from "./title-bar"
import { cn } from "@/lib/utils"

export function WorkbenchShell() {
  const [missionKey, setMissionKey] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function startMission() {
    setMissionKey((key) => key + 1)
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("[aria-label='任务描述']")?.focus()
    })
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-[540px] min-w-[660px] flex-col overflow-hidden bg-[var(--shell)] text-[var(--ink)]">
        <TitleBar />
        <div
          className={cn(
            "grid min-h-0 flex-1 transition-[grid-template-columns] duration-200",
            sidebarCollapsed
              ? "grid-cols-[60px_minmax(0,1fr)]"
              : "grid-cols-[240px_minmax(0,1fr)] max-[1080px]:grid-cols-[204px_minmax(0,1fr)] max-[820px]:grid-cols-[60px_minmax(0,1fr)]",
          )}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
            onNewMission={startMission}
          />
          <main className="relative min-h-0 overflow-hidden rounded-tl-[16px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.012)]">
            <HomeCanvas key={missionKey} />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
