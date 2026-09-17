"use client"

import { CaretLeft } from "@phosphor-icons/react"

import type { Connector } from "./connectors-data"

export function ConnectorDetail({ connector, onBack }: { connector: Connector; onBack: () => void }) {
  return (
    <section aria-label={`${connector.name} 连接器详情`} className="flex h-full min-h-0 flex-col bg-panel">
      <header className="flex h-[42px] shrink-0 items-center border-b border-[var(--line)] px-[18px]">
        <button
          type="button"
          onClick={onBack}
          className="mr-2 flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-label="返回连接器列表"
        >
          <CaretLeft className="size-3.5" weight="bold" />
        </button>
        <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <button type="button" onClick={onBack} className="outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">连接器</button>
          <span aria-hidden className="text-[var(--line-strong)]">/</span>
          <strong className="truncate font-medium text-[var(--muted-strong)]">{connector.name}</strong>
        </nav>
      </header>
      <div aria-label="连接器详情内容" className="min-h-0 flex-1" />
    </section>
  )
}
