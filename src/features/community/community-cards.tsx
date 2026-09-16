"use client"

/**
 * 社区目录卡片：市场目录的紧凑信息卡 —— 圆形作者头像、作者/标题双层、
 * 单行简介、标签 chips、发丝线分隔的元信息行与右侧动作按钮。
 */

import { Check, DownloadSimple, SealCheck, Star } from "@phosphor-icons/react"

import { toneChips, type IconTone } from "@/lib/icon-tones"
import { formatInstalls, type CommunityAgent, type CommunitySkill } from "./community-data"
import { cn } from "@/lib/utils"

const cardShell =
  "group flex cursor-pointer flex-col rounded-[12px] border border-[var(--line)] bg-panel p-4 text-left outline-none " +
  "transition-[border-color,box-shadow] duration-200 hover:border-[var(--line-strong)] hover:shadow-[0_10px_28px_-18px_rgba(20,24,32,0.22)] " +
  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

export function Avatar({ glyph, tone, className }: { glyph: string; tone: IconTone; className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", toneChips[tone], className)}>
      {glyph}
    </span>
  )
}

function AuthorName({ author, official }: { author: string; official: boolean }) {
  return (
    <p className="flex items-center gap-1 text-[11.5px] text-[var(--muted-strong)]">
      <span className="truncate">{author}</span>
      {official ? <SealCheck className="size-3.5 shrink-0 text-[var(--accent)]" weight="fill" /> : null}
    </p>
  )
}

function TagChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[6px] bg-[var(--surface-hover)] px-1.5 py-1 text-[10.5px] leading-none text-[var(--muted-strong)]">{children}</span>
}

const actionButton =
  "h-7 shrink-0 rounded-[7px] border border-[var(--line-strong)] bg-panel px-3 text-[11.5px] font-medium text-[var(--ink)] outline-none " +
  "transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

const installedMark = "flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-[var(--ok-ink)]"

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

function CardFrame(props: {
  avatar: { glyph: string; tone: IconTone }
  author: string
  official: boolean
  title: string
  summary: string
  tags: string[]
  footer: React.ReactNode
  action: React.ReactNode
  ariaLabel: string
  onOpen: () => void
}) {
  return (
    <article {...cardActivation(props.onOpen)} tabIndex={0} aria-label={props.ariaLabel} className={cardShell}>
      <div className="flex items-center gap-2.5">
        <Avatar glyph={props.avatar.glyph} tone={props.avatar.tone} className="size-9 text-[13px]" />
        <div className="min-w-0 flex-1">
          <AuthorName author={props.author} official={props.official} />
          <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{props.title}</p>
        </div>
      </div>
      <p className="mt-2.5 truncate text-[12px] text-[var(--ink-soft)]">{props.summary}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {props.tags.map((tag) => (
          <TagChip key={tag}>{tag}</TagChip>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-2.5 text-[11px] tabular-nums text-[var(--muted)]">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">{props.footer}</div>
        {props.action}
      </div>
    </article>
  )
}

export function CommunityAgentCard({ agent, onInstall, onOpen }: { agent: CommunityAgent; onInstall: () => void; onOpen: () => void }) {
  return (
    <CardFrame
      avatar={{ glyph: agent.author.slice(0, 1), tone: agent.tone }}
      author={agent.author}
      official={agent.author === "Fouc 官方"}
      title={agent.name}
      summary={agent.tagline}
      tags={agent.tags}
      ariaLabel={`${agent.name} 详情`}
      onOpen={onOpen}
      footer={
        <>
          <Star className="size-3 text-[#dfa43c]" weight="fill" />
          <span className="font-medium text-[var(--ink-soft)]">{agent.rating}</span>
          <span>({agent.ratingCount})</span>
          <DownloadSimple className="ml-1 size-3.5" />
          <span>{formatInstalls(agent.installs)}</span>
        </>
      }
      action={
        agent.installed ? (
          <span className={installedMark}>
            <Check className="size-3.5" weight="bold" />
            已添加
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionButton}>
            获取
          </button>
        )
      }
    />
  )
}

export function CommunitySkillCard({ skill, onInstall, onOpen }: { skill: CommunitySkill; onInstall: () => void; onOpen: () => void }) {
  return (
    <CardFrame
      avatar={{ glyph: skill.author.slice(0, 1), tone: skill.tone }}
      author={skill.author}
      official={skill.author === "Fouc 官方"}
      title={skill.name}
      summary={skill.summary}
      tags={skill.compat}
      ariaLabel={`${skill.name} 详情`}
      onOpen={onOpen}
      footer={
        <>
          <DownloadSimple className="size-3.5" />
          <span>{formatInstalls(skill.installs)}</span>
          <span className="text-[var(--line-strong)]">|</span>
          <span>v{skill.version}</span>
        </>
      }
      action={
        skill.installed ? (
          <span className={installedMark}>
            <Check className="size-3.5" weight="bold" />
            已安装
          </span>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onInstall() }} className={actionButton}>
            安装
          </button>
        )
      }
    />
  )
}
