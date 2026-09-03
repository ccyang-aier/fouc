"use client"

import Image from "next/image"
import {
  At,
  BellSimple,
  Chat,
  CheckSquare,
  Cube,
  FolderOpen,
  GearSix,
  Plus,
  Robot,
} from "@phosphor-icons/react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
  presenceMeta,
  railMembers,
  type ProjectManagementPanelId,
} from "./project-management-model"

const railTools = [
  { id: "chat", label: "项目会话", icon: Chat },
  { id: "mentions", label: "提及我的", icon: At },
  { id: "notifications", label: "通知", icon: BellSimple, badge: true },
  { id: "ai-assets", label: "项目 AI 资产", icon: Cube },
  { id: "project-assets", label: "代码仓与文档资产", icon: FolderOpen },
  { id: "tasks", label: "项目任务", icon: CheckSquare },
] as const satisfies ReadonlyArray<{
  id: ProjectManagementPanelId
  label: string
  icon: typeof Chat
  badge?: boolean
}>

type ProjectManagementRailProps = {
  activePanel: ProjectManagementPanelId | null
  onPanelChange: (panel: ProjectManagementPanelId | null) => void
}

/** 项目空间最右侧的全高管理轨道：每个入口都由同一抽屉状态承接。 */
export function ProjectManagementRail({ activePanel, onPanelChange }: ProjectManagementRailProps) {
  function toggle(panel: ProjectManagementPanelId) {
    onPanelChange(activePanel === panel ? null : panel)
  }

  return (
    <aside
      aria-label="项目管理侧栏"
      className="relative z-30 flex h-full w-14 shrink-0 flex-col items-center overflow-hidden border-l border-[var(--line)] bg-panel"
    >
      <div className="flex w-full flex-col items-center pt-3">
        <RailButton
          label="项目概览"
          active={activePanel === "summary"}
          onClick={() => toggle("summary")}
          className="mb-2.5"
        >
          <span className="flex size-[27px] items-center justify-center rounded-[8px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.72)]">
            <span className="text-[9px] font-bold tracking-[-0.02em]">F1</span>
          </span>
        </RailButton>

        <nav aria-label="项目管理入口" className="flex flex-col items-center gap-0.5">
          {railTools.map((tool) => (
            <RailButton
              key={tool.id}
              label={tool.label}
              badge={"badge" in tool && tool.badge}
              active={activePanel === tool.id}
              onClick={() => toggle(tool.id)}
            >
              <tool.icon className="size-[17px]" weight={activePanel === tool.id ? "fill" : "regular"} />
            </RailButton>
          ))}
        </nav>
      </div>

      <span aria-hidden className="my-2 h-px w-6 shrink-0 bg-[var(--line)]" />

      <RailButton
        label="Nova · 项目 Agent"
        active={activePanel === "agent"}
        onClick={() => toggle("agent")}
      >
        <span className="flex size-[18px] items-center justify-center rounded-[5px] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
          <Robot className="size-[11px]" weight="fill" />
        </span>
      </RailButton>

      <div aria-label="项目成员" className="mt-1 flex min-h-0 flex-col items-center">
        {railMembers.map((member) => {
          const panelId = `member:${member.id}` as const
          const presence = presenceMeta[member.presence]
          const active = activePanel === panelId

          return (
            <Tooltip key={member.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${member.name} · ${presence.label}`}
                  aria-expanded={active}
                  aria-controls="project-management-drawer"
                  onClick={() => toggle(panelId)}
                  className="group flex size-[34px] shrink-0 items-center justify-center rounded-[9px] outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"
                >
                  <span
                    className={cn(
                      "relative rounded-full transition-[transform,box-shadow] duration-200 group-hover:scale-[1.06]",
                      active && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-panel",
                    )}
                  >
                    <Image
                      src={member.avatar}
                      alt={`${member.name}的头像`}
                      width={56}
                      height={56}
                      className="size-[27px] rounded-full object-cover"
                    />
                    <span
                      aria-hidden
                      className="absolute -bottom-px -right-px size-2 rounded-full border-[1.5px] border-panel shadow-[0_0_0_0.5px_rgb(32_33_38/0.08)]"
                      style={{ backgroundColor: presence.color }}
                    />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{member.name} · {presence.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <RailButton
        label="邀请协作成员"
        active={activePanel === "invite"}
        onClick={() => toggle("invite")}
        className="mt-0.5"
      >
        <Plus className="size-[15px]" />
      </RailButton>

      <div className="mt-auto pb-2.5 pt-2">
        <RailButton
          label="项目设置"
          active={activePanel === "settings"}
          onClick={() => toggle("settings")}
        >
          <GearSix className="size-[17px]" />
        </RailButton>
      </div>
    </aside>
  )
}

function RailButton({
  label,
  badge,
  active,
  onClick,
  children,
  className,
}: {
  label: string
  badge?: boolean
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={active}
          aria-controls="project-management-drawer"
          onClick={onClick}
          className={cn(
            "group relative flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[var(--muted-strong)] outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
            className,
          )}
        >
          <span
            className={cn(
              "relative flex size-[30px] items-center justify-center rounded-[8px] transition-[background-color,color,box-shadow,transform] duration-200 group-hover:bg-[var(--surface-hover)] group-hover:text-[var(--ink)]",
              active && "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)] group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent-ink)]",
            )}
          >
            {children}
            {badge ? <span aria-hidden className="absolute right-[3px] top-[3px] size-[5px] rounded-full bg-[#df5660] ring-1 ring-panel" /> : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}
