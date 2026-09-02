"use client"

/**
 * 外观页分区卡片：统一的「图标徽章 + 标题 + 说明」头部与面板主体，
 * 与通用设置页的「运行状态」卡片同一视觉家族。
 */

import type { Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: Icon
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "mt-5 overflow-hidden rounded-[12px] border border-[var(--line)] bg-panel shadow-[0_1px_2px_rgba(23,25,27,0.04)]",
        className,
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-accent-soft text-accent-ink">
          <Icon className="size-4" weight="fill" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium">{title}</h2>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{description}</p>
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
