"use client"

import { useState } from "react"
import { CaretRight } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { ProjectActivity } from "./project-activity"
import { ProjectAttention } from "./project-attention"
import { ProjectComposer } from "./project-composer"
import { ProjectContextSidebar } from "./project-context-sidebar"
import { projectTabs, type ProjectTab } from "./project-data"
import { ProjectHeader } from "./project-header"
import { ProjectManagementDrawer } from "./project-management-drawer"
import type { ProjectManagementPanelId } from "./project-management-model"
import { ProjectMilestones } from "./project-milestones"
import { ProjectOutputsCanvas } from "./project-outputs-canvas"
import { ProjectWorkCanvas } from "./project-work-canvas"
import { workObjectDetails } from "./project-workobject-detail-data"
import { WorkObjectDetailCanvas } from "./project-workobject-detail"

export function ProjectHomeCanvas({
  favorited,
  onFavoriteChange,
  managementPanel,
  onManagementPanelChange,
}: {
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  managementPanel: ProjectManagementPanelId | null
  onManagementPanelChange: (panel: ProjectManagementPanelId | null) => void
}) {
  const [tab, setTab] = useState<ProjectTab>("overview")
  const [contextOpen, setContextOpen] = useState(true)
  const [workPanelOpen, setWorkPanelOpen] = useState(true)
  const [outputsPanelOpen, setOutputsPanelOpen] = useState(true)
  const [workObjectDetailId, setWorkObjectDetailId] = useState<string | null>(null)

  // 工作对象详情页接管整个项目区域，面包屑可返回项目空间
  const workObjectDetail = workObjectDetailId ? workObjectDetails[workObjectDetailId] : null

  let content: React.ReactNode
  if (workObjectDetail) {
    content = (
      <WorkObjectDetailCanvas
        detail={workObjectDetail}
        onExit={(target) => {
          setWorkObjectDetailId(null)
          setTab(target)
        }}
      />
    )
  } else if (tab === "work") {
    content = (
      <div className="flex h-full min-h-0 flex-col bg-panel">
        <ProjectHeader
          tab={tab}
          onTabChange={setTab}
          favorited={favorited}
          onFavoriteChange={onFavoriteChange}
          panelOpen={workPanelOpen}
          onTogglePanel={() => setWorkPanelOpen((open) => !open)}
        />
        <ProjectWorkCanvas detailOpen={workPanelOpen} onDetailOpenChange={setWorkPanelOpen} />
      </div>
    )
  } else if (tab === "outputs") {
    // 产物页：侧边栏与项目头部同栅格，保持与参考稿一致的通栏布局
    content = (
      <ProjectOutputsCanvas
        tab={tab}
        onTabChange={setTab}
        favorited={favorited}
        onFavoriteChange={onFavoriteChange}
        panelOpen={outputsPanelOpen}
        onPanelOpenChange={setOutputsPanelOpen}
        onOpenWorkObject={setWorkObjectDetailId}
      />
    )
  } else {
    content = (
      <div
        className={cn(
          "grid h-full min-h-0 bg-panel",
          contextOpen ? "grid-cols-[minmax(0,1fr)_292px] max-[1120px]:grid-cols-1" : "grid-cols-1",
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <ProjectHeader
            tab={tab}
            onTabChange={setTab}
            favorited={favorited}
            onFavoriteChange={onFavoriteChange}
            panelOpen={contextOpen}
            onTogglePanel={() => setContextOpen((open) => !open)}
          />
          <ScrollArea
            as="section"
            aria-label="项目首页"
            className="min-h-0 flex-1"
            viewportClassName="bg-panel"
          >
            <div className="flex min-h-full w-full flex-col px-5 pb-6 pt-[22px]">
              {tab === "overview" ? (
                <div className="space-y-[18px]">
                  <ProjectAttention />
                  <ProjectMilestones />
                  <ProjectActivity onOpenWork={() => setTab("work")} onOpenOutputs={() => setTab("outputs")} />
                  <ProjectComposer />
                </div>
              ) : (
                <ProjectSectionPlaceholder
                  tab={tab}
                  onCreate={() => {
                    setTab("overview")
                    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("[aria-label='任务描述']")?.focus())
                  }}
                />
              )}
            </div>
          </ScrollArea>
        </div>
        {contextOpen ? <ProjectContextSidebar /> : null}
      </div>
    )
  }

  // 管理抽屉锚定主区左缘（紧邻侧栏项目菜单），覆盖于项目内容之上
  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{content}</div>
      <ProjectManagementDrawer
        activePanel={managementPanel}
        onClose={() => onManagementPanelChange(null)}
        onOpenWork={() => {
          setTab("work")
          onManagementPanelChange(null)
        }}
      />
    </div>
  )
}

function ProjectSectionPlaceholder({ tab, onCreate }: { tab: ProjectTab; onCreate: () => void }) {
  const label = projectTabs.find((item) => item.id === tab)?.label ?? "项目"

  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-subtle)] text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)]"><CaretRight className="size-5" /></span>
      <h2 className="mt-4 text-[13px] font-semibold">{label}</h2>
      <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">该分区已连接到项目上下文，内容将在后续任务中逐步沉淀。</p>
      <button type="button" onClick={onCreate} className="mt-4 rounded-[7px] border border-[var(--line)] bg-panel px-3 py-2 text-[10.5px] text-[var(--muted-strong)] outline-none hover:border-[var(--line-strong)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">创建{label}任务</button>
    </section>
  )
}
