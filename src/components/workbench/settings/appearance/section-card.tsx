"use client"

/**
 * 外观页分区骨架：标题（图标徽章 + 名称 + 说明）置于卡片之外，
 * 卡片只承载内容主体，与设置的「运行状态」卡同一面板家族。
 */

import type { Icon } from "@phosphor-icons/react"

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: Icon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-7 first:mt-6">
      <header className="flex items-center gap-2.5 px-0.5">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-accent-soft text-accent-ink">
          <Icon className="size-[14px]" weight="fill" aria-hidden />
        </span>
        <h2 className="shrink-0 text-[13px] font-medium">{title}</h2>
        <p className="min-w-0 truncate text-[11px] text-[var(--muted)]">{description}</p>
      </header>
      <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-panel px-5 py-4 shadow-[0_1px_2px_rgba(23,25,27,0.04)]">
        {children}
      </div>
    </section>
  )
}
