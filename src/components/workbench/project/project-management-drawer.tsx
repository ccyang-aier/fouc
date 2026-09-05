"use client"

import {
  At,
  BellSimple,
  Chat,
  CheckSquare,
  Cube,
  FolderOpen,
  GearSix,
  Robot,
  UserPlus,
  X,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { toneChips, type IconTone } from "./icon-tones"
import { ChatPanel } from "./project-chat-panel"
import { getRailMember, type ProjectManagementPanelId } from "./project-management-model"
import {
  AgentPanel,
  AiAssetsPanel,
  InvitePanel,
  MemberPanel,
  MentionsPanel,
  NotificationsPanel,
  ProjectAssetsPanel,
  ProjectSummaryPanel,
  SettingsPanel,
  TasksPanel,
} from "./project-management-panels"

type ProjectManagementDrawerProps = {
  activePanel: ProjectManagementPanelId | null
  onClose: () => void
  onOpenWork: () => void
}

const panelCopy: Record<Exclude<ProjectManagementPanelId, `member:${string}`>, { title: string; description: string; tone: IconTone }> = {
  summary: { title: "项目概览", description: "项目状态、协作与关键资源", tone: "sky" },
  chat: { title: "项目会话", description: "围绕项目推进的共享讨论", tone: "teal" },
  mentions: { title: "提及我的", description: "需要你回应或确认的项目动态", tone: "amber" },
  notifications: { title: "项目通知", description: "评审、任务与资产同步提醒", tone: "rose" },
  "ai-assets": { title: "项目 AI 资产", description: "让 Agent 继承项目专属能力与约束", tone: "violet" },
  "project-assets": { title: "代码仓与文档", description: "管理 Agent 可读取的项目资产", tone: "blue" },
  tasks: { title: "项目任务", description: "查看当前项目的任务与进展", tone: "indigo" },
  agent: { title: "项目 Agent", description: "Nova 的上下文、能力与执行状态", tone: "indigo" },
  invite: { title: "邀请成员", description: "为项目添加新的协作伙伴", tone: "blue" },
  settings: { title: "项目设置", description: "配置项目基础信息与协作策略", tone: "slate" },
}

const DRAWER_WIDTH = 356

/** 项目内容左侧的推挤式抽屉：以弹簧宽度推开主内容而非覆盖，
    入口在左侧项目菜单，切换面板时复用相同的布局与内容切换动效。 */
export function ProjectManagementDrawer({ activePanel, onClose, onOpenWork }: ProjectManagementDrawerProps) {
  const open = activePanel !== null
  const displayedPanel = activePanel ?? "ai-assets"

  const member = getRailMember(displayedPanel)
  const meta = member
    ? { title: member.name, description: `${member.role} · 查看协作状态与任务`, tone: "sky" as IconTone }
    : panelCopy[displayedPanel as Exclude<ProjectManagementPanelId, `member:${string}`>]

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          key="project-management-drawer"
          id="project-management-drawer"
          aria-label={meta.title}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: DRAWER_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 36, opacity: { duration: 0.18 } }}
          className="relative z-20 h-full shrink-0 overflow-hidden border-r border-[var(--line)] bg-panel"
        >
          {/* 内层固定宽度：容器宽度收放时内容不发生挤压重排 */}
          <div className="flex h-full flex-col" style={{ width: DRAWER_WIDTH }}>
            <header className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-5">
              <span className={cn("flex size-[34px] shrink-0 items-center justify-center rounded-[10px]", toneChips[meta.tone])}>
                <PanelIcon panel={displayedPanel} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[13px] font-semibold tracking-[-0.015em]">{meta.title}</h2>
                <p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">{meta.description}</p>
              </div>
              <button type="button" aria-label="关闭项目管理面板" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-[background-color,color,transform] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"><X className="size-4" /></button>
            </header>

            <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-panel">
              <motion.div
                key={displayedPanel}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="px-5 pb-8 pt-2"
              >
                <PanelContent panel={displayedPanel} onOpenWork={onOpenWork} />
              </motion.div>
            </ScrollArea>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

function PanelIcon({ panel }: { panel: ProjectManagementPanelId }) {
  const member = getRailMember(panel)
  if (member) return <UserPlus className="size-[18px]" />
  if (panel === "summary") return <Cube className="size-[18px]" weight="fill" />
  if (panel === "chat") return <Chat className="size-[18px]" weight="fill" />
  if (panel === "mentions") return <At className="size-[18px]" />
  if (panel === "notifications") return <BellSimple className="size-[18px]" weight="fill" />
  if (panel === "ai-assets") return <Cube className="size-[18px]" weight="fill" />
  if (panel === "project-assets") return <FolderOpen className="size-[18px]" weight="fill" />
  if (panel === "tasks") return <CheckSquare className="size-[18px]" weight="fill" />
  if (panel === "agent") return <Robot className="size-[18px]" weight="fill" />
  if (panel === "invite") return <UserPlus className="size-[18px]" weight="fill" />
  return <GearSix className="size-[18px]" weight="fill" />
}

function PanelContent({ panel, onOpenWork }: { panel: ProjectManagementPanelId; onOpenWork: () => void }) {
  const member = getRailMember(panel)
  if (member) return <MemberPanel member={member} />
  if (panel === "summary") return <ProjectSummaryPanel />
  if (panel === "chat") return <ChatPanel />
  if (panel === "mentions") return <MentionsPanel />
  if (panel === "notifications") return <NotificationsPanel />
  if (panel === "ai-assets") return <AiAssetsPanel />
  if (panel === "project-assets") return <ProjectAssetsPanel />
  if (panel === "tasks") return <TasksPanel onOpenWork={onOpenWork} />
  if (panel === "agent") return <AgentPanel />
  if (panel === "invite") return <InvitePanel />
  return <SettingsPanel />
}
