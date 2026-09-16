"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react"

import { TooltipProvider } from "@/components/ui/tooltip"

/** 主区视图切换：横向推挤 + 3D 微转角，direction +1 进入项目视图 */
const mainCanvasVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 90,
    scale: 0.96,
    rotateY: direction * 2.5,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    rotateY: 0,
    transition: { type: "spring", stiffness: 220, damping: 27 },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -70,
    scale: 0.965,
    rotateY: direction * -2,
    // 退场层让出指针，避免过渡期间拦截新视图的点击
    pointerEvents: "none",
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  }),
}

import { applyAppearancePrefs, readAppearancePrefs } from "@/lib/appearance"
import { setOverlayRoot } from "@/lib/overlay-root"
import { manageWindowFrame } from "@/lib/window-frame"

import { HomeCanvas } from "@/features/home/home-canvas"
import { AutomationCanvas } from "@/features/automation/automation-canvas"
import { CommunityCanvas } from "@/features/community/community-canvas"
import { ConnectorsCanvas } from "@/features/connectors/connectors-canvas"
import { NavigationSidebar, type WorkbenchView } from "./navigation-sidebar"
import type { ProjectManagementPanelId } from "@/features/project/project-management-model"
import { ProjectHomeCanvas } from "@/features/project/project-home-canvas"
import "./sidebar-material.css"
import { SettingsCanvas } from "@/features/settings/settings-canvas"
import { SystemBar } from "./system-bar"
import { WorkspaceRail } from "./workspace-rail"

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
  // 项目管理面板状态由壳层持有：左侧项目菜单与项目画布共享同一开合来源
  const [managementPanel, setManagementPanel] = useState<ProjectManagementPanelId | null>(null)
  // 记录「因进入项目视图而自动收起」的侧栏状态，用于返回时还原
  const projectAutoCollapsed = useRef(false)
  const projectFavorited = useSyncExternalStore(subscribeProjectFavorite, readProjectFavorite, () => false)
  // 应用面板根：桌面端作为自绘外框的内层与弹层宿主
  const frameRef = useRef<HTMLDivElement>(null)

  // 启动时恢复外观偏好（主题 / 字体 / 动效）
  useEffect(() => {
    applyAppearancePrefs(readAppearancePrefs())
  }, [])

  // 桌面端启用窗口自绘外框，并把弹层收进应用面板内
  useEffect(() => {
    setOverlayRoot(frameRef.current)
    let disposeFrame: (() => void) | undefined
    void manageWindowFrame().then((dispose) => {
      disposeFrame = dispose
    })
    return () => {
      disposeFrame?.()
      setOverlayRoot(null)
    }
  }, [])

  function updateProjectFavorite(favorited: boolean) {
    writeProjectFavorite(favorited)
  }

  function changeView(nextView: WorkbenchView) {
    if (nextView !== "projects") setManagementPanel(null)
    // 进入项目视图默认收起侧栏为内容让位；返回工作台时还原。
    // 用户在项目视图内手动展开/收起后，视为偏好，不再自动还原。
    if (nextView === "projects" && !sidebarCollapsed) {
      projectAutoCollapsed.current = true
      setSidebarCollapsed(true)
    } else if (nextView !== "projects" && projectAutoCollapsed.current) {
      projectAutoCollapsed.current = false
      setSidebarCollapsed(false)
    }
    setView(nextView)
  }

  function startMission() {
    setMissionKey((key) => key + 1)
    changeView("home")
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("[aria-label='任务描述']")?.focus()
    })
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        {/* 外层透明边距承载自绘阴影；应用面板根绘环境画布并作为弹层宿主 */}
        <div className="h-dvh w-full p-[var(--win-frame-inset)]">
          <div
            ref={frameRef}
            className="flex h-full w-full min-w-[660px] min-h-[540px] flex-col overflow-hidden bg-background text-[var(--ink)] shadow-[var(--win-shadow)]"
          >
            {view === "settings" ? (
              // 设置为全窗页面：接管全部空间且不显示系统顶行；
              // 窗口拖拽由设置侧栏的 drag region 承担（见 settings-canvas）
              <div className="min-h-0 flex-1">
                <SettingsCanvas initialSection="appearance" onBack={() => changeView("home")} />
              </div>
            ) : (
              // 双层侧栏（工作区轨道 + 主导航）顶行全高，共用同一块材质底座；
              // 系统底层行只在主区顶部、与主导航 header 等高并接
              <div className="flex min-h-0 flex-1">
                <div className="sidebar-material flex shrink-0">
                  <WorkspaceRail view={view} onViewChange={changeView} onNewMission={startMission} />
                  <NavigationSidebar
                    open={!sidebarCollapsed}
                    onCollapse={() => {
                      projectAutoCollapsed.current = false
                      setSidebarCollapsed(true)
                    }}
                    onExpand={() => {
                      projectAutoCollapsed.current = false
                      setSidebarCollapsed(false)
                    }}
                    view={view}
                    onViewChange={changeView}
                    projectFavorited={projectFavorited}
                    onProjectFavoriteChange={updateProjectFavorite}
                    managementPanel={managementPanel}
                    onManagementPanelChange={setManagementPanel}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <SystemBar onNavigate={changeView} />
                  <main className="relative min-w-0 flex-1 overflow-hidden bg-panel">
                    <div className="relative h-full min-h-0" style={{ perspective: 1600 }}>
                      <AnimatePresence initial={false} custom={view === "projects" ? 1 : -1}>
                        <motion.div
                          key={`${view}-${missionKey}`}
                          custom={view === "projects" ? 1 : -1}
                          variants={mainCanvasVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          className="absolute inset-0"
                        >
                          {view === "home" ? (
                            <HomeCanvas />
                          ) : view === "projects" ? (
                            <ProjectHomeCanvas
                              favorited={projectFavorited}
                              onFavoriteChange={updateProjectFavorite}
                              managementPanel={managementPanel}
                              onManagementPanelChange={setManagementPanel}
                            />
                          ) : view === "community" ? (
                            <CommunityCanvas />
                          ) : view === "automation" ? (
                            <AutomationCanvas />
                          ) : view === "connectors" ? (
                            <ConnectorsCanvas />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[13px] text-[var(--ink-soft)]">
                              该空间已在 V1 规划中，尚未开放
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </main>
                </div>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </MotionConfig>
  )
}
