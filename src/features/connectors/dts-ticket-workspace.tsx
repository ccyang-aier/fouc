import { useState } from 'react'
import type { DtsFilterId, DtsTicketDetail, DtsTicketListResult, DtsTicketSummary } from '@fouc/shared'
import Image from 'next/image'
import { DtsTicketList } from './dts-ticket-list'
import { DtsTicketOverview } from './dts-ticket-overview'

type Props = {
  connected: boolean
  activeFilter: DtsFilterId
  tickets: DtsTicketListResult | null
  selectedId: string | null
  detail: DtsTicketDetail | null
  loading: boolean
  detailLoading: boolean
  keyword: string
  error: string | null
  onFilterChange: (filter: DtsFilterId) => void
  onKeywordChange: (value: string) => void
  onSearch: () => void
  onSelect: (ticket: DtsTicketSummary) => void
  onPageChange: (page: number) => void
  onConnect: () => void
  onOpenInspector?: () => void
}

export function DtsTicketWorkspace(props: Props) {
  const [listOpen, setListOpen] = useState(true)

  if (!props.connected) return <DisconnectedState onConnect={props.onConnect} />

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--surface-subtle)]/45">
      {listOpen ? <DtsTicketList
        activeFilter={props.activeFilter}
        tickets={props.tickets}
        selectedId={props.selectedId}
        loading={props.loading}
        keyword={props.keyword}
        error={props.error}
        onFilterChange={props.onFilterChange}
        onKeywordChange={props.onKeywordChange}
        onSearch={props.onSearch}
        onSelect={props.onSelect}
        onPageChange={props.onPageChange}
        onCollapse={() => setListOpen(false)}
      /> : null}
      <DtsTicketOverview
        detail={props.detail}
        summary={props.tickets?.items.find((ticket) => ticket.id === props.selectedId) ?? null}
        loading={props.detailLoading}
        onOpenList={listOpen ? undefined : () => setListOpen(true)}
        onOpenInspector={props.onOpenInspector}
      />
    </div>
  )
}

function DisconnectedState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--surface-subtle)]/45 px-8">
      <div className="w-full max-w-[420px] rounded-[16px] border border-[var(--line)] bg-panel px-9 py-8 text-center shadow-[0_16px_44px_-28px_rgba(30,42,68,0.38)]">
        <Image src="/connector-logos/dts.svg" alt="DTS" width={48} height={48} className="mx-auto size-12 rounded-[12px]" />
        <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--ink)]">连接 DTS 工作空间</h2>
        <p className="mx-auto mt-2 max-w-[340px] text-[10.5px] leading-5 text-[var(--muted-strong)]">完成公司 SSO 登录后，即可在统一工作台中查看个人工单、流程进展和关联信息。</p>
        <button type="button" onClick={onConnect} className="mt-5 h-9 rounded-[7px] bg-[var(--accent)] px-5 text-[10.5px] font-semibold text-white outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">打开 DTS 登录</button>
        <p className="mt-3 text-[9px] text-[var(--muted)]">仅开放个人只读视图 · 凭证不进入模型上下文</p>
      </div>
    </div>
  )
}
