"use client"

import { useState } from "react"
import Image from "next/image"
import { At, BellSimple, Chat, Plus, Robot } from "@phosphor-icons/react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type RailPresence = "online" | "busy" | "away" | "offline"

const presenceMeta: Record<RailPresence, { color: string; label: string }> = {
  online: { color: "#3cc36e", label: "在线" },
  busy: { color: "#e0464a", label: "忙碌" },
  away: { color: "#f5b93e", label: "离开" },
  offline: { color: "#d7dbe1", label: "离线" },
}

const railTools = [
  { id: "chat", label: "项目会话", icon: Chat },
  { id: "mentions", label: "提及我的", icon: At },
  { id: "notifications", label: "通知", icon: BellSimple, badge: true },
] as const

type RailTool = (typeof railTools)[number]["id"]

/** 项目协作成员（头像取自项目空间成员目录），presence 决定右下角状态点 */
const railMembers: { id: string; name: string; avatar: string; presence: RailPresence }[] = [
  { id: "lin-mo", name: "林默", avatar: "/avatars/member-1.png", presence: "online" },
  { id: "zhou-xin", name: "周欣", avatar: "/avatars/member-2.png", presence: "online" },
  { id: "chen-an", name: "陈安", avatar: "/avatars/member-3.png", presence: "offline" },
  { id: "su-qing", name: "苏晴", avatar: "/avatars/member-4.png", presence: "busy" },
  { id: "li-ang", name: "李昂", avatar: "/avatars/member-5.png", presence: "busy" },
  { id: "xiao-man", name: "小满", avatar: "/avatars/member-6.png", presence: "online" },
  { id: "he-jing", name: "何静", avatar: "/avatars/member-7.png", presence: "away" },
  { id: "gao-xiang", name: "高翔", avatar: "/avatars/member-8.png", presence: "away" },
  { id: "han-mei", name: "韩梅", avatar: "/avatars/member-9.png", presence: "offline" },
]

/** 项目空间最右侧的全高管理侧栏：协作入口、项目 Agent 与成员在线状态 */
export function ProjectManagementRail() {
  const [activeTool, setActiveTool] = useState<RailTool | null>(null)
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null)
  const [agentActive, setAgentActive] = useState(false)

  return (
    <aside aria-label="项目管理侧栏" className="flex h-full w-14 shrink-0 flex-col items-center overflow-hidden border-l border-[var(--line)] bg-panel">
      <div role="toolbar" aria-label="协作入口" className="flex flex-col items-center">
        {railTools.map((tool) => (
          <RailToolButton
            key={tool.id}
            label={tool.label}
            badge={"badge" in tool && tool.badge}
            active={activeTool === tool.id}
            onClick={() => setActiveTool((current) => (current === tool.id ? null : tool.id))}
          >
            <tool.icon className="size-[17px]" />
          </RailToolButton>
        ))}
      </div>

      <span aria-hidden className="mt-2.5 h-px w-[26px] bg-[var(--line)]" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="项目 Agent Nova"
            aria-pressed={agentActive}
            onClick={() => setAgentActive((value) => !value)}
            className={cn(
              "mt-2.5 flex size-9 items-center justify-center rounded-[10px] outline-none transition-[background-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
              agentActive ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-hover)]",
            )}
          >
            <span className="flex size-4 items-center justify-center rounded-[5px] bg-[#edf0f5] text-[#59606c]">
              <Robot className="size-[10px]" weight="fill" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Nova · 项目 Agent</TooltipContent>
      </Tooltip>

      <div aria-label="项目成员" className="flex flex-col items-center">
        {railMembers.map((member) => {
          const presence = presenceMeta[member.presence]
          const active = activeMemberId === member.id

          return (
            <Tooltip key={member.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${member.name} · ${presence.label}`}
                  aria-pressed={active}
                  onClick={() => setActiveMemberId((current) => (current === member.id ? null : member.id))}
                  className="group flex size-10 items-center justify-center rounded-[10px] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"
                >
                  <span className={cn("relative rounded-full transition-transform group-hover:scale-105", active && "ring-2 ring-[var(--accent-ink)] ring-offset-2 ring-offset-panel")}>
                    <Image src={member.avatar} alt="" width={64} height={64} className="size-8 rounded-full object-cover" />
                    <span
                      aria-hidden
                      className="absolute -bottom-px -right-px size-3 rounded-full border-2 border-panel"
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

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="邀请协作成员"
            className="mt-1.5 flex size-9 items-center justify-center rounded-[10px] text-[var(--muted-strong)] outline-none transition-[background-color,color,transform] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"
          >
            <Plus className="size-[15px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">邀请协作成员</TooltipContent>
      </Tooltip>
    </aside>
  )
}

function RailToolButton({ label, badge, active, onClick, children }: { label: string; badge?: boolean; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-[10px] text-[var(--muted-strong)] outline-none transition-[background-color,color,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
            active ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
          )}
        >
          {children}
          {badge ? <span aria-hidden className="absolute right-[9px] top-[7px] size-[6px] rounded-full bg-[#e0464a]" /> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}
