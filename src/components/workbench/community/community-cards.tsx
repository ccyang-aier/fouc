"use client"

/**
 * 社区目录卡片：市场目录卡 —— 发丝线描边白卡，tone 色彩只落在图标章上，
 * 信息三层（标题区 / 简介 / 发丝线元信息行），悬停仅描边加深与轻微抬升。
 */

import { Check, Star } from "@phosphor-icons/react"

import { toneChips, type IconTone } from "../icon-tones"
import { formatInstalls, type CommunityAgent, type CommunitySkill } from "./community-data"
import { cn } from "@/lib/utils"

const cardShell =
  "group relative flex cursor-pointer flex-col rounded-[10px] border border-[var(--line)] bg-panel p-5 text-left outline-none " +
  "shadow-[0_1px_2px_rgba(20,24,32,0.04)] transition-[border-color,box-shadow,transform] duration-200 ease-out " +
  "hover:-translate-y-[2px] hover:border-[var(--line-strong)] hover:shadow-[0_12px_28px_-16px_rgba(20,24,32,0.18)] " +
  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const glyphBadge = "flex size-11 shrink-0 items-center justify-center rounded-[10px] text-[16px] font-semibold"

const actionPill =
  "flex h-7 shrink-0 items-center rounded-[7px] bg-accent-soft px-3 text-[11.5px] font-semibold text-accent-ink outline-none " +
  "transition-colors duration-200 group-hover:bg-[var(--accent)] group-hover:text-white " +
  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:bg-[var(--accent)] focus-visible:text-white"

const installedPill =
  "flex h-7 shrink-0 items-center gap-1 rounded-[7px] bg-[var(--surface-subtle)] px-2.5 text-[11px] font-medium text-[var(--muted-strong)]"

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

const Dot = () => <span aria-hidden className="text-[var(--line-strong)]">·</span>

/** 底部元信息行：发丝线统一压底，跨卡片对齐形成栅格节奏 */
function MetaLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex items-center gap-1.5 border-t border-[var(--line)] pt-3 text-[11px] tabular-nums text-[var(--muted)]">
      {children}
    </div>
  )
}

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-[var(--ink-soft)]">
      <Star className="size-3 text-[#dfa43c]" weight="fill" />
      {value}
    </span>
  )
}

/** 通用卡面：Agents 与 Skills 共用同一骨架，差异只在文案与元信息 */
function CommunityCardFrame(props: {
  tone: IconTone
  glyph: string
  title: string
  subtitle: string
  tagline: string
  meta: React.ReactNode
  action: React.ReactNode
  ariaLabel: string
  onOpen: () => void
}) {
  return (
    <article {...cardActivation(props.onOpen)} tabIndex={0} aria-label={props.ariaLabel} className={cardShell}>
      <div className="flex items-start gap-3.5">
        <span className={cn(glyphBadge, toneChips[props.tone])}>{props.glyph}</span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{props.title}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">{props.subtitle}</p>
        </div>
        {props.action}
      </div>
      <p className="mt-3 line-clamp-2 text-[12.5px] leading-[19px] text-[var(--ink-soft)]">{props.tagline}</p>
      <MetaLine>{props.meta}</MetaLine>
    </article>
  )
}

function InstalledBadge({ label }: { label: string }) {
  return (
    <span className={installedPill}>
      <Check className="size-3 text-[var(--ok-ink)]" weight="bold" />
      {label}
    </span>
  )
}

export function CommunityAgentCard({ agent, onInstall, onOpen }: { agent: CommunityAgent; onInstall: () => void; onOpen: () => void }) {
  return (
    <CommunityCardFrame
      tone={agent.tone}
      glyph={agent.glyph}
      title={agent.name}
      subtitle={agent.author}
      tagline={agent.tagline}
      ariaLabel={`${agent.name} 详情`}
      onOpen={onOpen}
      action={
        agent.installed ? (
          <InstalledBadge label="已添加" />
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionPill}>
            获取
          </button>
        )
      }
      meta={
        <>
          <Rating value={agent.rating} />
          <Dot />
          <span>{formatInstalls(agent.installs)} 安装</span>
          <Dot />
          <span>{agent.updated}</span>
        </>
      }
    />
  )
}

export function CommunitySkillCard({ skill, onInstall, onOpen }: { skill: CommunitySkill; onInstall: () => void; onOpen: () => void }) {
  return (
    <CommunityCardFrame
      tone={skill.tone}
      glyph={skill.name.slice(0, 1)}
      title={skill.name}
      subtitle={skill.author}
      tagline={skill.summary}
      ariaLabel={`${skill.name} 详情`}
      onOpen={onOpen}
      action={
        skill.installed ? (
          <InstalledBadge label="已安装" />
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionPill}>
            安装
          </button>
        )
      }
      meta={
        <>
          <span className="font-medium text-[var(--ink-soft)]">v{skill.version}</span>
          <Dot />
          <span>适配 {skill.compat.join(" / ")}</span>
          <Dot />
          <span>{formatInstalls(skill.installs)} 安装</span>
        </>
      }
    />
  )
}
