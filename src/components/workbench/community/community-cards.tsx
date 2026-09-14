"use client"

/**
 * 社区目录卡片：三种条目共用一套骨架 —— 图标 + 名称 + 两行简介 + 底部元信息。
 * hover 时整体上浮、描边转主题色、投影加深，动作按钮由浅底翻为主题实底。
 */

import { CheckCircle, Star } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { toneChips } from "../icon-tones"
import { formatInstalls, type CommunityAgent, type CommunityConnector, type CommunitySkill } from "./community-data"

const cardShell =
  "group relative flex cursor-pointer flex-col gap-2.5 rounded-[12px] border border-[var(--line)] bg-panel p-3.5 text-left outline-none transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-[2px] hover:border-[var(--accent-soft-line)] hover:shadow-[0_16px_32px_-12px_rgba(30,36,42,0.16)] focus-visible:-translate-y-[2px] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const actionChip =
  "flex h-6 shrink-0 items-center rounded-[7px] px-2.5 text-[9.5px] font-semibold outline-none transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const pendingChip = `${actionChip} bg-accent-soft text-accent-ink group-hover:bg-[var(--accent)] group-hover:text-white group-hover:shadow-[0_4px_10px_-2px_color-mix(in_srgb,var(--accent)_45%,transparent)]`

function InstalledChip({ label }: { label: string }) {
  return (
    <span className={`${actionChip} cursor-default bg-[#e5f4ec] text-[#2e8b63]`}>
      <CheckCircle className="mr-1 size-3" weight="fill" />
      {label}
    </span>
  )
}

function CardIcon({ glyph, tone }: { glyph: string; tone: CommunityAgent["tone"] }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.55)] transition-transform duration-200 ease-out group-hover:scale-[1.05]",
        toneChips[tone],
      )}
    >
      {glyph}
    </span>
  )
}

function MetaDot() {
  return <span aria-hidden className="text-[var(--line-strong)]">·</span>
}

function cardActivation(onOpen: () => void) {
  return {
    onClick: onOpen,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onOpen()
      }
    },
  }
}

export function CommunityAgentCard({ agent, onInstall, onOpen }: { agent: CommunityAgent; onInstall: () => void; onOpen: () => void }) {
  return (
    <article {...cardActivation(onOpen)} tabIndex={0} aria-label={`${agent.name} 详情`} className={cardShell}>
      <div className="flex items-center gap-2.5">
        <CardIcon glyph={agent.glyph} tone={agent.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{agent.name}</p>
          <p className="mt-px truncate text-[9.5px] text-[var(--muted)]">by {agent.author} · {agent.category}</p>
        </div>
        {agent.installed ? (
          <InstalledChip label="已添加" />
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={pendingChip}>
            获取
          </button>
        )}
      </div>
      <p className="line-clamp-2 min-h-[32px] text-[10.5px] leading-[16px] text-[var(--ink-soft)]">{agent.tagline}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-0.5 text-[9px] text-[var(--muted)]">
        <Star className="size-3 text-[#d79a3b]" weight="fill" />
        <span className="font-medium text-[var(--ink-soft)]">{agent.rating}</span>
        <MetaDot />
        <span>{formatInstalls(agent.installs)} 安装</span>
        <MetaDot />
        <span>{agent.updated}更新</span>
      </div>
    </article>
  )
}

export function CommunityConnectorCard({ connector, onConnect, onOpen }: { connector: CommunityConnector; onConnect: () => void; onOpen: () => void }) {
  return (
    <article {...cardActivation(onOpen)} tabIndex={0} aria-label={`${connector.name} 详情`} className={cardShell}>
      <div className="flex items-center gap-2.5">
        <CardIcon glyph={connector.glyph} tone={connector.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{connector.name}</p>
          <p className="mt-px truncate text-[9.5px] text-[var(--muted)]">{connector.category} · v{connector.version}</p>
        </div>
        {connector.connected ? (
          <InstalledChip label="已连接" />
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onConnect() }} className={pendingChip}>
            连接
          </button>
        )}
      </div>
      <p className="line-clamp-2 min-h-[32px] text-[10.5px] leading-[16px] text-[var(--ink-soft)]">{connector.description}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-0.5 text-[9px] text-[var(--muted)]">
        <span className="truncate">{connector.publisher}</span>
        <MetaDot />
        <span>{connector.updated}更新</span>
      </div>
    </article>
  )
}

export function CommunitySkillCard({ skill, onInstall, onOpen }: { skill: CommunitySkill; onInstall: () => void; onOpen: () => void }) {
  return (
    <article {...cardActivation(onOpen)} tabIndex={0} aria-label={`${skill.name} 详情`} className={cardShell}>
      <div className="flex items-center gap-2.5">
        <CardIcon glyph={skill.name.slice(0, 1)} tone={skill.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{skill.name}</p>
          <p className="mt-px truncate text-[9.5px] text-[var(--muted)]">by {skill.author} · v{skill.version}</p>
        </div>
        {skill.installed ? (
          <InstalledChip label="已安装" />
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={pendingChip}>
            安装
          </button>
        )}
      </div>
      <p className="line-clamp-2 min-h-[32px] text-[10.5px] leading-[16px] text-[var(--ink-soft)]">{skill.summary}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-0.5 text-[9px] text-[var(--muted)]">
        <span>适配 {skill.compat.join(" / ")}</span>
        <MetaDot />
        <span>{formatInstalls(skill.installs)} 安装</span>
      </div>
    </article>
  )
}
