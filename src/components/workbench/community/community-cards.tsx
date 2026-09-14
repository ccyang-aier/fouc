"use client"

/** 社区目录卡片：Agent / 连接器 / Skill 三种条目形态，获取与连接动作由画布注入。 */

import { CheckCircle, Star } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { toneChips } from "../icon-tones"
import { formatInstalls, type CommunityAgent, type CommunityConnector, type CommunitySkill } from "./community-data"

const cardFrame =
  "flex flex-col gap-2 rounded-[10px] border border-[var(--line)] bg-panel p-3.5 text-left transition-[border-color,box-shadow] hover:border-[var(--line-strong)] hover:shadow-[0_6px_18px_rgba(30,36,42,0.05)]"

const installChip =
  "flex h-6 shrink-0 items-center rounded-[6px] bg-accent-soft px-2.5 text-[9.5px] font-semibold text-accent-ink outline-none transition-[background-color,box-shadow] hover:shadow-[inset_0_0_0_1px_var(--accent-soft-line)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

function InstalledChip({ label }: { label: string }) {
  return (
    <span className="flex h-6 shrink-0 items-center gap-1 rounded-[6px] bg-[#e5f4ec] px-2 text-[9.5px] font-medium text-[#2e8b63]">
      <CheckCircle className="size-3" weight="fill" />
      {label}
    </span>
  )
}

export function CommunityAgentCard({ agent, onInstall }: { agent: CommunityAgent; onInstall: () => void }) {
  return (
    <article className={cardFrame}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[12px] font-bold", toneChips[agent.tone])}>
          {agent.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-[var(--ink)]">{agent.name}</p>
          <p className="truncate text-[9.5px] text-[var(--muted)]">by {agent.author}</p>
        </div>
        {agent.installed ? <InstalledChip label="已添加" /> : (
          <button type="button" onClick={onInstall} className={installChip}>获取</button>
        )}
      </div>
      <p className="text-[10.5px] leading-[16px] text-[var(--ink-soft)]">{agent.tagline}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
        {agent.tags?.map((tag) => (
          <span key={tag} className="rounded-full bg-wash px-1.5 py-0.5 text-[9px] text-[var(--muted-strong)]">{tag}</span>
        ))}
        <span className="ml-auto flex items-center gap-1 text-[9.5px] text-[var(--muted)]">
          <Star className="size-3 text-[#d79a3b]" weight="fill" />
          <span className="font-medium text-[var(--ink-soft)]">{agent.rating}</span>
          <span aria-hidden>·</span>
          <span>{formatInstalls(agent.installs)} 次安装</span>
        </span>
      </div>
    </article>
  )
}

export function CommunityConnectorCard({ connector, onConnect }: { connector: CommunityConnector; onConnect: () => void }) {
  return (
    <article className="flex items-start gap-3 rounded-[10px] border border-[var(--line)] bg-panel p-3.5 transition-[border-color,box-shadow] hover:border-[var(--line-strong)] hover:shadow-[0_6px_18px_rgba(30,36,42,0.05)]">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold", toneChips[connector.tone])}>
        {connector.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[12px] font-semibold text-[var(--ink)]">{connector.name}</p>
          <span className="shrink-0 rounded-full bg-wash px-1.5 py-0.5 text-[9px] text-[var(--muted-strong)]">{connector.category}</span>
        </div>
        <p className="mt-1 text-[10.5px] leading-[16px] text-[var(--ink-soft)]">{connector.description}</p>
        <p className="mt-1.5 text-[9px] text-[var(--muted)]">{connector.publisher}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center self-stretch">
        {connector.connected ? (
          <span className="flex h-6 items-center gap-1 rounded-[6px] bg-[#e5f4ec] px-2 text-[9.5px] font-medium text-[#2e8b63]">
            <CheckCircle className="size-3" weight="fill" />
            已连接
          </span>
        ) : (
          <button type="button" onClick={onConnect} className={installChip}>连接</button>
        )}
      </div>
    </article>
  )
}

export function CommunitySkillCard({ skill, onInstall }: { skill: CommunitySkill; onInstall: () => void }) {
  return (
    <article className={cardFrame}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold", toneChips[skill.tone])}>
          {skill.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[12px] font-semibold text-[var(--ink)]">{skill.name}</p>
            <span className="shrink-0 rounded-full bg-wash px-1.5 py-0.5 font-mono text-[8.5px] text-[var(--muted-strong)]">v{skill.version}</span>
          </div>
          <p className="truncate text-[9.5px] text-[var(--muted)]">by {skill.author}</p>
        </div>
        {skill.installed ? <InstalledChip label="已安装" /> : (
          <button type="button" onClick={onInstall} className={installChip}>安装</button>
        )}
      </div>
      <p className="text-[10.5px] leading-[16px] text-[var(--ink-soft)]">{skill.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
        {skill.compat.map((name) => (
          <span key={name} className="rounded-full bg-wash px-1.5 py-0.5 text-[9px] text-[var(--muted-strong)]">适配 {name}</span>
        ))}
        <span className="ml-auto text-[9.5px] text-[var(--muted)]">{formatInstalls(skill.installs)} 次安装</span>
      </div>
    </article>
  )
}
