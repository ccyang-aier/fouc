"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { applyAppearancePrefs, readAppearancePrefs } from "@/lib/appearance"
import { applySidebarStyle, readStoredSidebarStyle } from "@/lib/sidebar-style"

import { HomeCanvas } from "./home-canvas"
import { ProjectHomeCanvas } from "./project/project-home-canvas"
import "./sidebar-material.css"
import { Sidebar, type WorkbenchView } from "./sidebar"
import { SettingsCanvas } from "./settings/settings-canvas"
import { TitleBar } from "./title-bar"

const PROJECT_FAVORITE_STORAGE_KEY = "fouc.project.fouc-desktop.favorite"
const PROJECT_FAVORITE_EVENT = "fouc-project-favorite-change"
let fallbackProjectFavorite = false

function subscribeProjectFavorite(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(PROJECT_FAVORITE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(PROJECT_FAVORITE_EVENT, onStoreChange)
  }
}

function readProjectFavorite() {
  try {
    return window.localStorage.getItem(PROJECT_FAVORITE_STORAGE_KEY) === "true"
  } catch {
    return fallbackProjectFavorite
  }
}

function writeProjectFavorite(favorited: boolean) {
  fallbackProjectFavorite = favorited

  try {
    window.localStorage.setItem(PROJECT_FAVORITE_STORAGE_KEY, String(favorited))
  } catch {
    // localStorage 不可用时回退到当前会话状态。
  }

  window.dispatchEvent(new Event(PROJECT_FAVORITE_EVENT))
}

export function WorkbenchShell() {
  const [missionKey, setMissionKey] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<WorkbenchView>("home")
  const projectFavorited = useSyncExternalStore(subscribeProjectFavorite, readProjectFavorite, () => false)

  // 启动时恢复外观偏好（主题 / 字体 / 动效）与侧栏材质（标准 / 磨砂玻璃）
  useEffect(() => {
    applyAppearancePrefs(readAppearancePrefs())
    applySidebarStyle(readStoredSidebarStyle())
  }, [])

  function updateProjectFavorite(favorited: boolean) {
    writeProjectFavorite(favorited)
  }

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
        <TitleBar />
        {view === "settings" ? (
          // 设置为全窗页面：接管标题栏以下的全部空间，不保留工作台侧边栏
          <div className="min-h-0 flex-1">
            <SettingsCanvas initialSection="appearance" onBack={() => setView("home")} />
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
              projectFavorited={projectFavorited}
            />
            {/* 面板自绘 1px 边框（含左上圆角），与侧栏分割线同用 --wt-sidebar-glass-edge：
                真实 border 不受内容层遮挡，四边与圆角处颜色连续均匀 */}
            <main className="relative min-w-0 flex-1 overflow-hidden rounded-tl-[16px] border border-[var(--wt-sidebar-glass-edge)] bg-panel">
              {view === "home" ? (
                <HomeCanvas key={missionKey} />
              ) : view === "projects" ? (
                <ProjectHomeCanvas favorited={projectFavorited} onFavoriteChange={updateProjectFavorite} />
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
