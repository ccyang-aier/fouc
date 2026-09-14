"use client"

/**
 * 社区目录卡片：单色克制风 —— 中性徽章、排版层级、单行简介、一行元信息。
 * 无彩色徽章 / 标签堆叠；hover 仅描边加深与轻投影，动作按钮保持安静。
 */

import { Check } from "@phosphor-icons/react"

import { formatInstalls, type CommunityAgent, type CommunityConnector, type CommunitySkill } from "./community-data"

const cardShell =
  "group relative flex cursor-pointer flex-col rounded-[12px] border border-[var(--line)] bg-panel p-4 text-left outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--line-strong)] hover:shadow-[0_10px_24px_-14px_rgba(28,33,42,0.14)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const neutralBadge =
  "flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--surface-hover)] text-[12px] font-semibold text-[var(--ink-soft)]"

const actionBtn =
  "flex h-6 shrink-0 items-center rounded-[6px] px-1.5 text-[11px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const installedMark = (
  <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--muted-strong)]">
    <Check className="size-3" weight="bold" />
    已添加
  </span>
)

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

function MetaLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[10px] text-[var(--muted)]">
      {children}
    </div>
  )
}

const Dot = () => <span aria-hidden className="text-[var(--line-strong)]">·</span>

export function CommunityAgentCard({ agent, onInstall, onOpen }: { agent: CommunityAgent; onInstall: () => void; onOpen: () => void }) {
  return (
    <article {...cardActivation(onOpen)} tabIndex={0} aria-label={`${agent.name} 详情`} className={cardShell}>
      <div className="flex items-start gap-3">
        <span className={neutralBadge}>{agent.glyph}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{agent.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{agent.author}</p>
        </div>
        {agent.installed ? installedMark : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionBtn}>
            获取
          </button>
        )}
      </div>
      <p className="mt-2.5 line-clamp-1 text-[11px] leading-[16px] text-[var(--ink-soft)]">{agent.tagline}</p>
      <MetaLine>
        <span className="font-medium text-[var(--ink-soft)]">★ {agent.rating}</span>
        <Dot />
        <span>{formatInstalls(agent.installs)} 安装</span>
        <Dot />
        <span>{agent.updated}</span>
      </MetaLine>
    </article>
  )
}

export function CommunityConnectorCard({ connector, onConnect, onOpen }: { connector: CommunityConnector; onConnect: () => void; onOpen: () => void }) {
  return (
    <article {...cardActivation(onOpen)} tabIndex={0} aria-label={`${connector.name} 详情`} className={cardShell}>
      <div className="flex items-start gap-3">
        <span className={neutralBadge}>{connector.glyph}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{connector.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{connector.publisher}</p>
        </div>
        {connector.connected ? (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--muted-strong)]">
            <Check className="size-3" weight="bold" />
            已连接
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onConnect() }} className={actionBtn}>
            连接
          </button>
        )}
      </div>
      <p className="mt-2.5 line-clamp-1 text-[11px] leading-[16px] text-[var(--ink-soft)]">{connector.description}</p>
      <MetaLine>
        <span>{connector.category}</span>
        <Dot />
        <span>v{connector.version}</span>
        <Dot />
        <span>{connector.updated}</span>
      </MetaLine>
    </article>
  )
}

export function CommunitySkillCard({ skill, onInstall, onOpen }: { skill: CommunitySkill; onInstall: () => void; onOpen: () => void }) {
  return (
    <article {...cardActivation(onOpen)} tabIndex={0} aria-label={`${skill.name} 详情`} className={cardShell}>
      <div className="flex items-start gap-3">
        <span className={neutralBadge}>{skill.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{skill.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{skill.author}</p>
        </div>
        {skill.installed ? (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--muted-strong)]">
            <Check className="size-3" weight="bold" />
            已安装
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionBtn}>
            安装
          </button>
        )}
      </div>
      <p className="mt-2.5 line-clamp-1 text-[11px] leading-[16px] text-[var(--ink-soft)]">{skill.summary}</p>
      <MetaLine>
        <span className="font-medium text-[var(--ink-soft)]">v{skill.version}</span>
        <Dot />
        <span>适配 {skill.compat.join(" / ")}</span>
        <Dot />
        <span>{formatInstalls(skill.installs)} 安装</span>
      </MetaLine>
    </article>
  )
}
