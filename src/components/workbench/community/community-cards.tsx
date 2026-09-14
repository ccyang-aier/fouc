"use client"

/**
 * 社区目录卡片：Apple 风格 —— 白卡无描边、常驻柔投影、中性圆角徽章、
 * 胶囊动作按钮（悬停翻为主题实底），信息三层：名称 / 单行简介 / 元信息。
 */

import { Check } from "@phosphor-icons/react"

import { formatInstalls, type CommunityAgent, type CommunityConnector, type CommunitySkill } from "./community-data"

const cardShell =
  "group relative flex cursor-pointer flex-col rounded-[12px] bg-panel p-4 text-left outline-none shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_14px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.04),0_10px_28px_rgba(0,0,0,0.09)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const neutralBadge =
  "flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-hover)] text-[13px] font-semibold text-[var(--ink-soft)]"

const actionPill =
  "flex h-7 shrink-0 items-center rounded-full bg-accent-soft px-3.5 text-[11px] font-semibold text-accent-ink outline-none transition-[background-color,color] duration-200 group-hover:bg-[var(--accent)] group-hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:bg-[var(--accent)] focus-visible:text-white"

const installedPill =
  "flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--line-strong)] px-3 text-[10.5px] font-medium text-[var(--muted-strong)]"

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
    <div className="mt-auto flex items-center gap-1.5 pt-3 text-[10px] text-[var(--muted)]">
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
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{agent.name}</p>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{agent.author}</p>
        </div>
        {agent.installed ? (
          <span className={installedPill}>
            <Check className="size-3" weight="bold" />
            已添加
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionPill}>
            获取
          </button>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">{agent.tagline}</p>
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
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{connector.name}</p>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{connector.publisher}</p>
        </div>
        {connector.connected ? (
          <span className={installedPill}>
            <Check className="size-3" weight="bold" />
            已连接
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onConnect() }} className={actionPill}>
            连接
          </button>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">{connector.description}</p>
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
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{skill.name}</p>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{skill.author}</p>
        </div>
        {skill.installed ? (
          <span className={installedPill}>
            <Check className="size-3" weight="bold" />
            已安装
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionPill}>
            安装
          </button>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">{skill.summary}</p>
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
