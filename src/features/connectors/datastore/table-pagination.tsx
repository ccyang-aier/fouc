"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowsClockwise, CaretDoubleLeft, CaretDoubleRight, CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import type { RelationalTableCount, RelationalTablePage, RelationalTableQuery } from '@fouc/shared'
import { RELATIONAL_PAGE_LIMITS } from '@fouc/shared'
import { Button } from '@/components/ui/button'
import { useAppAlert } from '@/components/app-alert-provider'
import { backendFetch } from '@/lib/backend'
import { TablePageSize } from './table-page-size'
import { lastTablePageOffset, loadedTableTotal, tablePageOffset } from './table-pagination-model'
import styles from './table-pagination.module.css'

type Props = {
  base: string; schema: string; page: RelationalTablePage; query: RelationalTableQuery; revision: number;
  offset: number; limit: number; defaultSize: number; loadTimeMs: number | null; disabled: boolean;
  onNavigate: (offset: number) => void; onLimit: (limit: number) => void; onDefault: (limit: number) => void;
  onClose: () => void; exportAction: ReactNode;
}

export function TablePagination({ base, schema, page, query, revision, offset, limit, defaultSize, loadTimeMs, disabled, onNavigate, onLimit, onDefault, onClose, exportAction }: Props) {
  const alerts = useAppAlert()
  const scope = JSON.stringify([base, schema, page.table, query, revision]), requestKey = JSON.stringify([scope, offset, limit])
  const [count, setCount] = useState<{ scope: string; total: string } | null>(null)
  const [operation, setOperation] = useState({ key: '', busy: false })
  const request = useRef<AbortController | null>(null), live = useRef(true)
  useLayoutEffect(() => { live.current = true; return () => { live.current = false; request.current?.abort() } }, [])
  useLayoutEffect(() => () => request.current?.abort(), [requestKey, disabled])
  const counting = operation.key === requestKey && operation.busy, blocked = disabled || counting
  const total = count?.scope === scope ? count.total : disabled ? null : loadedTableTotal(page)
  const currentPage = Math.floor(offset / limit) + 1, lastOffset = total === null ? null : lastTablePageOffset(total, limit)
  const [input, setInput] = useState({ page: currentPage, draft: String(currentPage) })
  if (input.page !== currentPage) setInput({ page: currentPage, draft: String(currentPage) })
  async function countRows(goLast = false) {
    if (blocked) return
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setOperation({ key: requestKey, busy: true })
    try {
      const result = await backendFetch<RelationalTableCount>(`${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(page.table)}/count`, { method: 'POST', body: JSON.stringify(query), signal: controller.signal })
      if (controller.signal.aborted) return
      setCount({ scope, total: result.totalRows })
      if (goLast) {
        const last = lastTablePageOffset(result.totalRows, limit)
        if (last === null) alerts.notify('warning', '总行数超出当前分页可跳转范围')
        else if (last !== offset) onNavigate(last)
      }
    } catch (reason) {
      if (!controller.signal.aborted) alerts.notify('error', '读取总行数失败', reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (request.current === controller) { request.current = null; if (live.current) setOperation({ key: requestKey, busy: false }) }
    }
  }
  function jump() {
    if (blocked) return
    const next = tablePageOffset(input.draft, limit, total)
    if (next === null) alerts.notify('warning', '请输入有效页码')
    else if (next !== offset) onNavigate(next)
    setInput({ page: currentPage, draft: next === null ? String(currentPage) : String(Math.floor(next / limit) + 1) })
  }
  return <footer className={styles.footer} aria-label="表数据分页与统计">
    <div className={styles.summary}><span title={`当前页从数据库返回 ${page.rows.length} 行`}>共 {page.rows.length} 行</span><Button className={styles.count} variant="ghost" disabled={disabled} loading={counting} aria-label="刷新总行数" title="读取当前数据库筛选下的总行数" onClick={() => void countRows()}><ArrowsClockwise size={12} /><span className={styles.countLabel} title={total === null ? '总行数尚未读取' : `总计 ${total} 行`}>总计 {total === null ? '—' : BigInt(total).toLocaleString('zh-CN')} 行</span></Button>{loadTimeMs !== null ? <span title={`表数据请求耗时 ${loadTimeMs} ms，包含网络传输`}>{loadTimeMs} ms</span> : null}</div>
    <code title={page.statement.sql}>{page.statement.sql}</code>
    <div className={styles.pagination}>
      <TablePageSize size={limit} defaultSize={defaultSize} disabled={blocked} onChange={onLimit} onDefault={onDefault} />
      <button type="button" className="fouc-action" aria-label="首页数据" title="首页" disabled={!offset || blocked} onClick={() => onNavigate(0)}><CaretDoubleLeft size={13} /></button>
      <button type="button" className="fouc-action" aria-label="上一页数据" title="上一页" disabled={!offset || blocked} onClick={() => onNavigate(Math.max(0, offset - limit))}><CaretLeft size={13} /></button>
      <input className={styles.pageInput} aria-label="跳转数据页" title="输入页码后按 Enter" inputMode="numeric" value={input.draft} disabled={blocked} onChange={event => setInput({ page: currentPage, draft: event.target.value })} onBlur={() => setInput({ page: currentPage, draft: String(currentPage) })} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); jump() } }} />
      <button type="button" className="fouc-action" aria-label="下一页数据" title="下一页" disabled={!page.hasMore || blocked || offset + limit > RELATIONAL_PAGE_LIMITS.offset} onClick={() => onNavigate(offset + limit)}><CaretRight size={13} /></button>
      <button type="button" className="fouc-action" aria-label="末页数据" title="末页" disabled={blocked || !page.hasMore || (total !== null && (lastOffset === null || lastOffset <= offset))} onClick={() => { if (lastOffset === null) void countRows(true); else onNavigate(lastOffset) }}><CaretDoubleRight size={13} /></button>
      <button type="button" className="fouc-action" aria-label="关闭数据表" title="关闭数据表" disabled={blocked} onClick={onClose}><X size={13} /></button>
    </div>
    <span className={styles.export}>{exportAction}</span>
  </footer>
}
