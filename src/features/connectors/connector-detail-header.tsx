"use client"

import { CaretLeft } from "@phosphor-icons/react"

export function ConnectorDetailHeader({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <header className="flex h-[42px] shrink-0 items-center gap-2 border-b border-[var(--line)] px-[18px]">
      <button
        type="button"
        onClick={onBack}
        aria-label="返回连接器列表"
        className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:border focus-visible:border-[var(--accent)]"
      >
        <CaretLeft className="size-3.5" weight="bold" />
      </button>
      <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--muted)]">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[5px] px-1 py-0.5 outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:text-[var(--accent-ink)]"
        >
          连接器
        </button>
        <span aria-hidden className="text-[var(--line-strong)]">/</span>
        <strong aria-current="page" className="truncate font-medium text-[var(--muted-strong)]">{name}</strong>
      </nav>
    </header>
  )
}
