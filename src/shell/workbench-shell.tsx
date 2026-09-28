"use client"

import { useWorkbenchView } from "./workbench-view"
import { useEffect, useRef, useState } from "react"
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
import { KnowledgePage } from "@/features/knowledge/knowledge-page"
import { NavigationSidebar, type WorkbenchView } from "./navigation-sidebar"
import { useProjectResources } from "@/features/project/project-resources"
import { ProjectHomeCanvas } from "@/features/project/project-home-canvas"
import { ProjectIndexCanvas } from "@/features/project/project-index-canvas"
import "./sidebar-material.css"
import { SettingsCanvas } from "@/features/settings/settings-canvas"
import { SystemBar } from "./system-bar"
import { WorkspaceRail } from "./workspace-rail"
import { useWorkspace } from "@/features/workspaces/workspace-provider"

export function WorkbenchShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useWorkbenchView()
  const { spaces, activeSpace, updateSpaces, selectWorkspace, createWorkspace } = useWorkspace()
  const { selectedProject, favorites, managementPanel, setManagementPanel, setFavorite } = useProjectResources()
  const projectFavorited = selectedProject !== null && favorites.includes(selectedProject.id)
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

  function changeView(nextView: WorkbenchView) {
    if (nextView !== "projects") setManagementPanel(null)
    const needsCompactNavigation = nextView === "projects" || nextView === "community" || nextView === "knowledge"
    // 项目、社区与知识库视图默认收起主导航为内容让位。
    if (needsCompactNavigation && !sidebarCollapsed) {
      setSidebarCollapsed(true)
    }
    setView(nextView)
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
                  <WorkspaceRail view={view} onViewChange={changeView} spaces={spaces} activeSpaceId={activeSpace.id} onSpacesChange={updateSpaces} onActiveSpaceChange={selectWorkspace} onCreateSpace={createWorkspace} />
                  <NavigationSidebar
                    open={!sidebarCollapsed}
                    onCollapse={() => {
                      setSidebarCollapsed(true)
                    }}
                    onExpand={() => {
                      setSidebarCollapsed(false)
                    }}
                    view={view}
                    onViewChange={changeView}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <SystemBar onNavigate={changeView} />
                  <main className="relative min-w-0 flex-1 overflow-hidden bg-panel">
                    <div className="relative h-full min-h-0" style={{ perspective: 1600 }}>
                      <AnimatePresence initial={false} custom={view === "projects" ? 1 : -1}>
                        <motion.div
                          key={view}
                          custom={view === "projects" ? 1 : -1}
                          variants={mainCanvasVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          className="absolute inset-0"
                        >
                          {view === "home" ? (
                            <HomeCanvas />
                          ) : view === "project-home" ? (
                            <ProjectIndexCanvas onOpenProject={() => changeView("projects")} />
                          ) : view === "projects" ? (
                            selectedProject ? <ProjectHomeCanvas key={`${activeSpace.id}:${selectedProject.id}`}
                              projectId={selectedProject.id}
                              projectName={selectedProject.name}
                              favorited={projectFavorited}
                              onFavoriteChange={(favorite) => setFavorite(selectedProject.id, favorite)}
                              managementPanel={managementPanel}
                              onManagementPanelChange={setManagementPanel}
                            /> : <ProjectIndexCanvas onOpenProject={() => changeView("projects")} />
                          ) : view === "community" ? (
                            <CommunityCanvas />
                          ) : view === "automation" ? (
                            <AutomationCanvas key={activeSpace.id} workspaceId={activeSpace.id} workspaceName={activeSpace.label} />
                          ) : view === "connectors" ? (
                            <ConnectorsCanvas key={activeSpace.id} onWorkbenchFocus={() => setSidebarCollapsed(true)} />
                          ) : view === "knowledge" ? (
                            <KnowledgePage key={activeSpace.id} onOpenSettings={() => changeView("settings")} />
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
