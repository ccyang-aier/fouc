"use client"

import { useEffect, useState } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { applySidebarStyle, readStoredSidebarStyle } from "@/lib/sidebar-style"

import { HomeCanvas } from "./home-canvas"
import "./sidebar-material.css"
import { Sidebar, type WorkbenchView } from "./sidebar"
import { SettingsCanvas } from "./settings/settings-canvas"
import { TitleBar } from "./title-bar"

export function WorkbenchShell() {
  const [missionKey, setMissionKey] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<WorkbenchView>("home")

  // 启动时恢复侧栏材质偏好（标准 / 磨砂玻璃）
  useEffect(() => {
    applySidebarStyle(readStoredSidebarStyle())
  }, [])

  function startMission() {
    setMissionKey((key) => key + 1)
    setView("home")
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("[aria-label='任务描述']")?.focus()
    })
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-[540px] min-w-[660px] flex-col overflow-hidden text-[var(--ink)]">
        <TitleBar settings={view === "settings"} onBack={() => setView("home")} />
        {view === "settings" ? (
          // 设置为全窗页面：接管标题栏以下的全部空间，不保留工作台侧边栏
          <div className="min-h-0 flex-1">
            <SettingsCanvas initialSection="appearance" />
          </div>
        ) : (
          // 材质挂在整行：侧边栏与主面板共用同一块材质底座，
          // 主面板圆角缺口处透出的也是同一材质，与侧边栏无缝衔接
          <div className="sidebar-material flex min-h-0 flex-1">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
              onNewMission={startMission}
              view={view}
              onViewChange={setView}
            />
            <main className="relative min-w-0 flex-1 overflow-hidden rounded-tl-[16px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.012)]">
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
