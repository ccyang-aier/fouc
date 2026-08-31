"use client"

import { useState } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { HomeCanvas } from "./home-canvas"
import { Sidebar, type WorkbenchView } from "./sidebar"
import { SettingsCanvas } from "./settings/settings-canvas"
import { TitleBar } from "./title-bar"
import { cn } from "@/lib/utils"

export function WorkbenchShell() {
  const [missionKey, setMissionKey] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<WorkbenchView>("home")

  function startMission() {
    setMissionKey((key) => key + 1)
    setView("home")
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("[aria-label='任务描述']")?.focus()
    })
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-[540px] min-w-[660px] flex-col overflow-hidden bg-[var(--shell)] text-[var(--ink)]">
        <TitleBar settings={view === "settings"} onBack={() => setView("home")} />
        {view === "settings" ? (
          // 设置为全窗页面：接管标题栏以下的全部空间，不保留工作台侧边栏
          <div className="min-h-0 flex-1">
            <SettingsCanvas initialSection="appearance" />
          </div>
        ) : (
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
              view={view}
              onViewChange={setView}
            />
            <main className="relative min-h-0 overflow-hidden rounded-tl-[16px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.012)]">
              {view === "home" ? (
                <HomeCanvas key={missionKey} />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--ink-soft)]">
                  该空间已在 V1 规划中，尚未开放
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
