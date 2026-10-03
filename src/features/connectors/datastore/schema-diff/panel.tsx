'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle, Copy, DownloadSimple, FileCode, Funnel, MagnifyingGlass, Table, Warning, X } from '@phosphor-icons/react'
import type { RelationalProvider } from '@fouc/shared'
import { buildSchemaDiff } from './compare'
import { buildSchemaDiffScript, expandSchemaDiffSelection } from './script'
import { SCHEMA_DIFF_KIND_LABELS, SCHEMA_DIFF_OPERATION_LABELS, type SchemaDiffChange, type SchemaDiffComparison, type SchemaDiffInput, type SchemaDiffOptions } from './model'
import styles from './schema-diff.module.css'

export interface SchemaDiffPanelProps {
  provider: RelationalProvider
  source: SchemaDiffInput
  target: SchemaDiffInput
  title?: string
  sourceLabel?: string
  targetLabel?: string
  className?: string
  options?: SchemaDiffOptions
  onClose?: () => void
}
const providerNames: Record<RelationalProvider, string> = { mysql: 'MySQL', postgres: 'PostgreSQL', sqlite: 'SQLite' }
function message(error: unknown) { return error instanceof Error ? error.message : String(error) }
function DiffDdl({ label, sql, focused }: { label: string; sql: string; focused: SchemaDiffChange | null }) {
  const text = sql.slice(0, 128_000)
  return <div className={styles.ddlSide}><header>{label}<small>{sql.length.toLocaleString()} 字符</small></header><pre tabIndex={0} aria-label={label}>
    {text.split('\n').map((line, index) => <div key={index} data-focused={!!focused && line.includes(focused.name) ? 'true' : undefined}><span>{index + 1}</span><code>{line || ' '}</code></div>)}</pre>
    {sql.length > text.length && <small className={styles.clipped}>预览前 128,000 字符；原始元数据仍完整保留。</small>}</div>
}

export function SchemaDiffPanel({ provider, source, target, title = '结构差异审查', sourceLabel = '源结构', targetLabel = '目标对象', className = '', options: initialOptions, onClose }: SchemaDiffPanelProps) {
  const [options, setOptions] = useState<SchemaDiffOptions>(() => ({ ...initialOptions }))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'selected' | 'destructive'>('all')
  const [tab, setTab] = useState<'details' | 'ddl' | 'script' | 'issues'>('details')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const built = useMemo(() => {
    try { return { comparison: buildSchemaDiff(provider, source, target, options), error: '' } }
    catch (error) { return { comparison: null, error: message(error) } }
  }, [provider, source, target, options])
  const comparison = built.comparison
  const [selection, setSelection] = useState<{ comparison: SchemaDiffComparison | null; ids: string[] }>({ comparison: null, ids: [] })
  const selectedIds = useMemo(() => comparison ? selection.comparison === comparison ? selection.ids : comparison.changes.filter((change) => change.risk !== 'destructive').map((change) => change.id) : [], [comparison, selection])
  const selected = useMemo(() => comparison ? expandSchemaDiffSelection(comparison, selectedIds) : new Set<string>(), [comparison, selectedIds])
  const script = useMemo(() => comparison ? buildSchemaDiffScript(comparison, selectedIds) : null, [comparison, selectedIds])
  const focus = comparison?.changes.find((change) => change.id === focusedId) ?? comparison?.changes[0] ?? null
  const activeTable = comparison?.tables.find((table) => table.id === focus?.tableId) ?? comparison?.tables[0]
  const total = comparison?.changes.length ?? 0
  const destructive = comparison?.changes.filter((change) => change.risk === 'destructive').length ?? 0
  const matching = comparison?.changes.filter((change) => (!query || `${change.name} ${SCHEMA_DIFF_KIND_LABELS[change.kind]}`.toLowerCase().includes(query.toLowerCase())) && (filter === 'all' || filter === 'selected' && selected.has(change.id) || filter === 'destructive' && change.risk === 'destructive')) ?? []
  const manual = script?.issues.filter((issue) => issue.severity === 'unsupported').length ?? 0

  function select(change: SchemaDiffChange, checked: boolean) {
    if (!comparison) return
    setSelection({ comparison, ids: checked ? [...new Set([...selectedIds, change.id])] : selectedIds.filter((id) => id !== change.id) })
    setFeedback(null)
  }
  async function copy() {
    if (!script) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('当前浏览器无法写入剪贴板，请下载脚本。')
      await navigator.clipboard.writeText(script.sql)
      setFeedback({ error: false, text: '已复制完整审查脚本。' })
    } catch (error) { setFeedback({ error: true, text: message(error) }) }
  }
  function download() {
    if (!script) return
    const url = URL.createObjectURL(new Blob([script.sql], { type: 'application/sql;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `fouc-${provider}-schema-diff.sql`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback({ error: false, text: '已下载审查脚本。' })
  }

  return <section className={`${styles.panel} ${className}`} aria-label={title}>
    <header className={styles.head}><div><FileCode size={19} /><h2>{title}</h2><span>{providerNames[provider]}</span></div>{onClose && <button type="button" aria-label="关闭结构差异审查" onClick={onClose}><X size={17} /></button>}</header>
    <div className={styles.direction}><div><small>期望结构</small><strong>{sourceLabel}</strong></div><ArrowRight size={18} /><div><small>变更作用于</small><strong>{targetLabel}</strong></div><p>读取元数据 · 仅生成可审查 DDL</p></div>
    <div className={styles.toolbar}><label className={styles.search}><MagnifyingGlass size={15} /><input aria-label="筛选结构差异" placeholder="搜索表、字段或约束" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className={styles.filter}><Funnel size={14} /><select aria-label="结构差异筛选" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">全部差异（{total}）</option><option value="selected">已选变更（{selected.size}）</option><option value="destructive">数据删除（{destructive}）</option></select></label>
      <label className={styles.option}><input type="checkbox" checked={!!options.ignoreComments} onChange={(event) => setOptions((current) => ({ ...current, ignoreComments: event.target.checked }))} />忽略注释</label>
      <label className={styles.option}><input type="checkbox" checked={!!options.compareColumnOrder} onChange={(event) => setOptions((current) => ({ ...current, compareColumnOrder: event.target.checked }))} />比较字段顺序</label></div>
    {built.error ? <div className={styles.empty} role="alert"><Warning size={26} /><strong>结构比较暂不可用</strong><p>{built.error}</p></div> : <div className={styles.workspace}>
      <aside className={styles.objects} aria-label="结构差异对象"><header><span>{comparison?.tables.length ?? 0} 个表 · {total} 项差异</span><button type="button" onClick={() => { if (comparison) setSelection({ comparison, ids: comparison.changes.map((change) => change.id) }) }}>全选</button><button type="button" onClick={() => { if (comparison) setSelection({ comparison, ids: [] }) }}>清空</button></header>
        {comparison?.tables.map((table) => { const changes = matching.filter((change) => change.tableId === table.id); return changes.length ? <div className={styles.group} key={table.id}><h3><Table size={14} /><span title={table.name}>{table.name}</span><small>{changes.length}</small></h3>{changes.map((change) => <div key={change.id} className={styles.object} data-active={focus?.id === change.id || undefined}>
          <input type="checkbox" aria-label={`选择${SCHEMA_DIFF_KIND_LABELS[change.kind]} ${change.name}`} checked={selected.has(change.id)} onChange={(event) => select(change, event.target.checked)} /><button type="button" onClick={() => { setFocusedId(change.id); setTab('details') }}><span>{change.name}</span><small>{SCHEMA_DIFF_KIND_LABELS[change.kind]}{selected.has(change.id) && !selectedIds.includes(change.id) ? ' · 自动关联' : ''}</small></button><em data-operation={change.operation}>{SCHEMA_DIFF_OPERATION_LABELS[change.operation]}</em></div>)}</div> : null })}
        {!matching.length && <div className={styles.listEmpty}>{total ? '当前筛选没有匹配项' : manual ? '需要补充元数据或手工审查' : '未发现结构差异'}</div>}
      </aside>
      <main className={styles.review}>
        <div className={styles.tabs} role="tablist" aria-label="结构差异审查视图">{([['details', '差异明细'], ['ddl', '原始 DDL'], ['script', `变更脚本 ${script?.steps.length ?? 0}`], ['issues', `影响与限制 ${script?.issues.length ?? 0}`]] as const).map(([value, label]) => <button type="button" key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
        <div className={styles.reviewBody}>
          {tab === 'details' && (focus ? <><div className={styles.detailHead}><div><small>{SCHEMA_DIFF_KIND_LABELS[focus.kind]} · {activeTable?.name}</small><h3>{focus.name}</h3></div><span data-operation={focus.operation}>{SCHEMA_DIFF_OPERATION_LABELS[focus.operation]}</span></div>
            <p className={styles.changeNote}>{focus.operation === 'add' ? '源对象存在，目标缺少此结构。' : focus.operation === 'remove' ? '目标存在，源结构中没有此项。数据删除默认不勾选。' : '将目标属性调整为源结构。'}</p>
            {focus.fields.length ? <table className={styles.fields}><thead><tr><th>属性</th><th>目标当前值</th><th>源期望值</th></tr></thead><tbody>{focus.fields.map((field) => <tr key={field.key}><th>{field.label}</th><td><code>{field.before}</code></td><td><code>{field.after}</code></td></tr>)}</tbody></table>
              : <div className={styles.metadata}><div><strong>目标当前定义</strong><pre>{focus.target === null ? '不存在' : JSON.stringify(focus.target, null, 2)}</pre></div><div><strong>源期望定义</strong><pre>{focus.source === null ? '不存在' : JSON.stringify(focus.source, null, 2)}</pre></div></div>}
            {focus.risk !== 'low' && <p className={styles.impact}><Warning size={15} />{focus.risk === 'destructive' ? '包含数据删除，请核对备份和外部引用后审查脚本。' : '此变更可能检查、转换或重建已有数据。'}</p>}</> : <div className={styles.empty}><CheckCircle size={27} /><strong>{manual ? '当前结构需要补充审查' : '结构一致'}</strong><p>{manual ? '在“影响与限制”查看缺失信息。' : '比较仅涵盖已提供的表及元数据。'}</p></div>)}
          {tab === 'ddl' && <div className={styles.ddlGrid}><DiffDdl label="源原始 DDL" sql={activeTable?.source?.definition.sql ?? '-- 源中不存在此对象'} focused={focus} /><DiffDdl label="目标原始 DDL" sql={activeTable?.target?.definition.sql ?? '-- 目标中不存在此对象'} focused={focus} /></div>}
          {tab === 'script' && <div className={styles.script}><div className={styles.scriptSummary}>{manual ? <Warning size={15} /> : <FileCode size={15} />}<strong>{manual ? `${manual} 项需手工处理` : `${script?.steps.length ?? 0} 个有序步骤`}</strong><small>选择 {selected.size} 项 · 依赖自动排序</small></div><pre tabIndex={0} aria-label="结构变更 SQL 脚本">{script?.sql}</pre></div>}
          {tab === 'issues' && <div className={styles.issues}>{script?.issues.length ? script.issues.map((issue, index) => <div key={index} data-severity={issue.severity}><Warning size={16} /><div><strong>{issue.severity === 'unsupported' ? '需手工处理' : issue.severity === 'warning' ? '影响与前置条件' : '元数据说明'}</strong><p>{issue.message}</p></div></div>) : <div className={styles.empty}><CheckCircle size={27} /><p>当前选择没有额外限制；仍需核对目标数据与权限。</p></div>}</div>}
        </div>
      </main>
    </div>}
    {feedback && <p className={styles.feedback} data-error={feedback.error || undefined} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    <footer className={styles.footer}><span>{selected.size} 项已选{selected.size > selectedIds.length ? ` · ${selected.size - selectedIds.length} 项自动关联` : ''}{manual ? ` · ${manual} 项手工处理` : ''}</span><button type="button" disabled={!script || !script.steps.length} onClick={() => void copy()}><Copy size={15} />复制审查脚本</button><button type="button" className={styles.primary} disabled={!script || !script.steps.length} onClick={download}><DownloadSimple size={15} />下载 DDL</button></footer>
  </section>
}
