"use client"

import { useWorkbenchView } from "./workbench-view"
import { closeSettings, setSettingsSection, useSettingsSection, WORKBENCH_VIEW_CHANGED } from "@/lib/settings-navigation"
import { useMenuMotion } from "@/lib/use-menu-motion"
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
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
import { useProjectResources, type ProjectResource } from "@/features/project/project-resources"
import { ProjectDeliveryProvider, AcceptDeliveryInvitation } from "@/features/project/delivery"
import { useAppAlert } from "@/components/app-alert-provider"
import { ProjectHomeCanvas } from "@/features/project/project-home-canvas"
import { ProjectIndexCanvas } from "@/features/project/project-index-canvas"
import styles from "./workbench-shell.module.css"
import { SettingsCanvas } from "@/features/settings/settings-canvas"
import { HelpFeedbackCanvas } from "@/features/help/help-feedback-canvas"
import { SystemBar } from "./system-bar"

export function WorkbenchShell() {
  useMenuMotion()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useWorkbenchView()
  const settingsSection = useSettingsSection()
  const { projects, selectedProject, selectProject, refreshProjects, favorites, managementPanel, setManagementPanel, setFavorite } = useProjectResources()
  const { notify } = useAppAlert()
  const query = useSyncExternalStore(subscribeProjectLink, readProjectLink, () => "")
  const link = new URLSearchParams(query)
  const linkedProjectId = link.get("projectId")
  const invitationId = link.get("invitationId")
  const invitationToken = link.get("invitationToken")
  const projectFavorited = selectedProject !== null && favorites.includes(selectedProject.id)
  // 应用面板根：桌面端作为自绘外框的内层与弹层宿主
  const frameRef = useRef<HTMLDivElement>(null)

  // 启动时恢复外观偏好（主题 / 字体）
  useEffect(() => {
    applyAppearancePrefs(readAppearancePrefs())
  }, [])

  useEffect(() => {
    if (linkedProjectId && projects.some(project => project.id === linkedProjectId) && selectedProject?.id !== linkedProjectId) selectProject(linkedProjectId)
  }, [linkedProjectId, projects, selectedProject?.id, selectProject])

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
    const needsCompactNavigation = nextView === "community" || nextView === "knowledge"
    if (needsCompactNavigation && !sidebarCollapsed) {
      setSidebarCollapsed(true)
    }
    setView(nextView)
  }

  function closeInvitation() {
    const url = new URL(window.location.href)
    url.searchParams.delete("invitationId")
    url.searchParams.delete("invitationToken")
    window.history.replaceState(null, "", url)
    window.dispatchEvent(new Event(WORKBENCH_VIEW_CHANGED))
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        {/* 外层透明边距承载自绘阴影；应用面板根绘环境画布并作为弹层宿主 */}
        <div className="h-dvh w-full p-[var(--win-frame-inset)]">
          <div
            ref={frameRef}
            className={`${styles.frame} flex h-full w-full min-w-[660px] min-h-[540px] flex-col overflow-hidden bg-background text-[var(--ink)] shadow-[var(--win-shadow)]`}
          >
            {view === "settings" ? (
              // 设置为全窗页面：接管全部空间且不显示系统顶行；
              // 窗口拖拽由设置侧栏的 drag region 承担（见 settings-canvas）
              <div className="min-h-0 flex-1">
                <SettingsCanvas initialSection={settingsSection} onSectionChange={setSettingsSection} onBack={closeSettings} />
              </div>
            ) : (
              // 主导航包含底部身份入口，顶行全高；
              // 系统底层行只在主区顶部、与主导航 header 等高并接
              <ProjectDeliveryBoundary project={selectedProject}><div className="flex min-h-0 flex-1">
                <div className={`${styles.navigation} sidebar-material flex shrink-0`}>
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
                  <div className={styles.systemBar}><SystemBar onNavigate={changeView} /></div>
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
                            selectedProject ? <ProjectHomeCanvas key={`${selectedProject.source}:${selectedProject.id}`}
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
                            <AutomationCanvas />
                          ) : view === "connectors" ? (
                            <ConnectorsCanvas onWorkbenchFocus={() => setSidebarCollapsed(true)} onOpenProject={id => { if (projects.some(project => project.id === id)) { selectProject(id); changeView("projects"); } else changeView("project-home"); }} />
                          ) : view === "knowledge" ? (
                            <KnowledgePage onOpenSettings={() => changeView("settings")} />
                          ) : view === "help" ? (
                            <HelpFeedbackCanvas onNavigate={changeView} />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[13px] text-[var(--ink-soft)]">
                              该视图已在 V1 规划中，尚未开放
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </main>
                </div>
              </div></ProjectDeliveryBoundary>
            )}
            {linkedProjectId && invitationId && invitationToken ? <AcceptDeliveryInvitation projectId={linkedProjectId} invitationId={invitationId} token={invitationToken} onClose={closeInvitation} onAccepted={() => {
              closeInvitation()
              void refreshProjects(linkedProjectId).then(refreshed => {
                if (refreshed) { changeView("projects"); notify("success", "已加入项目") }
                else { changeView("project-home"); notify("warning", "已加入项目，项目列表暂未刷新，请稍后重试") }
              })
            }} /> : null}
          </div>
        </div>
      </TooltipProvider>
    </MotionConfig>
  )
}

function ProjectDeliveryBoundary({project, children}: {project: ProjectResource | null; children: ReactNode}) {
  return project ? <ProjectDeliveryProvider key={`${project.source}:${project.id}`} project={project}>{children}</ProjectDeliveryProvider> : children
}

function readProjectLink() { return window.location.search }
function subscribeProjectLink(listener: () => void) {
  window.addEventListener("popstate", listener)
  window.addEventListener(WORKBENCH_VIEW_CHANGED, listener)
  return () => { window.removeEventListener("popstate", listener); window.removeEventListener(WORKBENCH_VIEW_CHANGED, listener) }
}
