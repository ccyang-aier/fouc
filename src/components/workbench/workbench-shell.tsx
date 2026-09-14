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
import { applySidebarStyle, readStoredSidebarStyle } from "@/lib/sidebar-style"

import { HomeCanvas } from "./home-canvas"
import { AutomationCanvas } from "./automation/automation-canvas"
import { CommunityCanvas } from "./community/community-canvas"
import type { ProjectManagementPanelId } from "./project/project-management-model"
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
  // 项目管理面板状态由壳层持有：左侧项目菜单与项目画布共享同一开合来源
  const [managementPanel, setManagementPanel] = useState<ProjectManagementPanelId | null>(null)
  // 记录「因进入项目视图而自动收起」的侧栏状态，用于返回时还原
  const projectAutoCollapsed = useRef(false)
  const projectFavorited = useSyncExternalStore(subscribeProjectFavorite, readProjectFavorite, () => false)

  // 启动时恢复外观偏好（主题 / 字体 / 动效）与侧栏材质（标准 / 磨砂玻璃）
  useEffect(() => {
    applyAppearancePrefs(readAppearancePrefs())
    applySidebarStyle(readStoredSidebarStyle())
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
        <div className="flex h-dvh min-h-[540px] min-w-[660px] flex-col overflow-hidden text-[var(--ink)]">
          <TitleBar />
        {view === "settings" ? (
          // 设置为全窗页面：接管标题栏以下的全部空间，不保留工作台侧边栏
          <div className="min-h-0 flex-1">
            <SettingsCanvas initialSection="appearance" onBack={() => changeView("home")} />
          </div>
        ) : (
          // 材质挂在整行：侧边栏与主面板共用同一块材质底座，
          // 主面板圆角缺口处透出的也是同一材质，与侧边栏无缝衔接
          <div className="sidebar-material flex min-h-0 flex-1">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => {
                projectAutoCollapsed.current = false
                setSidebarCollapsed((collapsed) => !collapsed)
              }}
              onNewMission={startMission}
              view={view}
              onViewChange={changeView}
              projectFavorited={projectFavorited}
              onProjectFavoriteChange={updateProjectFavorite}
              managementPanel={managementPanel}
              onManagementPanelChange={setManagementPanel}
            />
            {/* 面板自绘 1px 边框（含左上圆角），与侧栏分割线同用 --wt-sidebar-glass-edge：
                真实 border 不受内容层遮挡，四边与圆角处颜色连续均匀 */}
            <main className="relative min-w-0 flex-1 overflow-hidden rounded-tl-[16px] border border-[var(--wt-sidebar-glass-edge)] bg-panel">
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
        )}
        </div>
      </TooltipProvider>
    </MotionConfig>
  )
}
