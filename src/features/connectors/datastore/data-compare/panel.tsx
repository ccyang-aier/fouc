'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowsLeftRight, CaretDown, CaretLeft, CaretRight, Code, Copy, MagnifyingGlass, Play, SpinnerGap, Stop, WarningCircle } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared'
import { compareDataResults } from './compare'
import { CompareEntryDetail } from './entry-detail'
import { CompareMappingEditor } from './mapping-editor'
import { compareCellAt, inferCompareKeys, inferCompareMappings, type DataCompareColumnMapping, type DataCompareEntry, type DataCompareKind, type DataCompareProgress, type DataCompareResult, type DataCompareSqlPreview, type DataCompareTarget } from './model'
import { buildDataCompareSqlPreview } from './sql-preview'
import { compareCellText } from './values'
import styles from './compare.module.css'

export type { DataCompareColumnMapping, DataCompareResult, DataCompareTarget } from './model'
export type DataComparePanelProps = { left: DatabaseQueryResult; right: DatabaseQueryResult; leftLabel: string; rightLabel: string; provider?: RelationalProvider; target?: DataCompareTarget; leftPrimaryKeys?: readonly string[]; initialMapping?: readonly DataCompareColumnMapping[]; initialKeyColumns?: readonly string[]; scopeKey?: string; onNotice?: (message: string) => void; onSqlPreview?: (sql: string) => void }

const PAGE_SIZE = 50
const kindNames: Record<DataCompareKind, string> = { added: '新增候选', removed: '删除候选', modified: '修改', unchanged: '一致', conflict: '冲突' }
const objectKeys = new WeakMap<DatabaseQueryResult, number>(); let nextObjectKey = 0
function objectKey(value: DatabaseQueryResult): number { let key = objectKeys.get(value); if (key === undefined) { key = ++nextObjectKey; objectKeys.set(value, key) } return key }
function selectable(entry: DataCompareEntry) { return entry.kind === 'added' || entry.kind === 'removed' || entry.kind === 'modified' }
function matchesSearch(entry: DataCompareEntry, comparison: DataCompareResult, query: string): boolean {
  if (!query) return true
  if (entry.keyValues.some((value) => compareCellText(value).toLowerCase().includes(query)) || entry.reasons.some((reason) => reason.toLowerCase().includes(query))) return true
  for (const side of ['left', 'right'] as const) for (const row of entry[side === 'left' ? 'leftRows' : 'rightRows']) for (const mapping of comparison.mapping) if (compareCellText(compareCellAt(comparison[side].rows[row], mapping[side])).toLowerCase().includes(query)) return true
  return false
}

/** The parent supplies actual results from its current connection; this panel never reads another source. */
export function DataComparePanel(props: DataComparePanelProps) {
  return <DataCompareContent key={`${props.scopeKey ?? ''}:${props.provider ?? ''}:${objectKey(props.left)}:${objectKey(props.right)}`} {...props} />
}

function DataCompareContent({ left, right, leftLabel, rightLabel, provider, target, leftPrimaryKeys = [], initialMapping, initialKeyColumns, onNotice, onSqlPreview }: DataComparePanelProps) {
  const [configuration, setConfiguration] = useState(() => { const mapping = initialMapping ? [...initialMapping] : inferCompareMappings(left.columns, right.columns); return { mapping, keys: initialKeyColumns ? [...initialKeyColumns] : inferCompareKeys(left, mapping, leftPrimaryKeys) } })
  const [comparison, setComparison] = useState<DataCompareResult | null>(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState<DataCompareProgress | null>(null), [error, setError] = useState(''), [feedback, setFeedback] = useState('')
  const [mappingOpen, setMappingOpen] = useState(true), [filter, setFilter] = useState<'changes' | 'all' | DataCompareKind>('changes'), [query, setQuery] = useState(''), [page, setPage] = useState(0), [activeId, setActiveId] = useState<string | null>(null), [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [sqlOpen, setSqlOpen] = useState(false), [sqlPreview, setSqlPreview] = useState<DataCompareSqlPreview | null>(null), [sqlError, setSqlError] = useState(''), [sqlBusy, setSqlBusy] = useState(false), [sqlProvider, setSqlProvider] = useState<RelationalProvider | ''>(provider ?? ''), [targetTable, setTargetTable] = useState(target?.table ?? ''), [targetSchema, setTargetSchema] = useState(target?.schema ?? '')
  const controller = useRef<AbortController | null>(null), sqlRun = useRef(0), mounted = useRef(true), search = useDeferredValue(query.trim().toLowerCase())
  const filtered = useMemo(() => comparison?.entries.filter((entry) => (filter === 'all' || filter === 'changes' ? filter === 'all' || entry.kind !== 'unchanged' : entry.kind === filter) && matchesSearch(entry, comparison, search)) ?? [], [comparison, filter, search])
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)), visible = filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE), active = comparison?.entries.find((entry) => entry.id === activeId)
  const eligible = filtered.filter(selectable), allSelected = eligible.length > 0 && eligible.every((entry) => selected.has(entry.id)), partial = left.hasMore || left.truncated || right.hasMore || right.truncated
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort() } }, [])
  function notice(message: string) { setFeedback(message); onNotice?.(message) }
  function clearSql() { sqlRun.current++; setSqlPreview(null); setSqlError(''); setSqlBusy(false) }
  function changeConfiguration(mapping: DataCompareColumnMapping[], keys: string[]) { controller.current?.abort(); setConfiguration({ mapping, keys }); setComparison(null); setSelected(new Set()); setActiveId(null); setError(''); setFeedback(''); clearSql() }
  async function run() {
    controller.current?.abort(); const runController = new AbortController(); controller.current = runController
    setBusy(true); setProgress(null); setError(''); setFeedback(''); setComparison(null); setSelected(new Set()); setActiveId(null); clearSql()
    try {
      const next = await compareDataResults(left, right, { mapping: configuration.mapping, keyColumns: configuration.keys, provider }, { signal: runController.signal, onProgress: (value) => { if (!runController.signal.aborted && mounted.current) setProgress(value) } })
      if (!runController.signal.aborted && mounted.current) { setComparison(next); setMappingOpen(false); setPage(0); notice(`比较完成 · ${next.counts.added + next.counts.removed + next.counts.modified} 个差异键 · ${next.counts.conflict} 个冲突键`) }
    } catch (reason) { if (mounted.current) { if (runController.signal.aborted) setFeedback('比较已取消'); else setError(reason instanceof Error ? reason.message : String(reason)) } }
    finally { if (mounted.current && controller.current === runController) setBusy(false) }
  }
  function changeSelected(next: ReadonlySet<string>) { setSelected(next); clearSql() }
  function toggleRow(id: string) { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); changeSelected(next) }
  function selectFiltered() { const next = new Set(selected); for (const entry of eligible) { if (allSelected) next.delete(entry.id); else next.add(entry.id) } changeSelected(next) }
  async function generateSql() {
    if (!comparison || !sqlProvider || !targetTable.trim() || !selected.size) return
    const runId = ++sqlRun.current; setSqlBusy(true); setSqlError(''); setSqlPreview(null)
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (runId !== sqlRun.current || !mounted.current) return
      const output = buildDataCompareSqlPreview(comparison, selected, sqlProvider, { table: targetTable, schema: targetSchema || undefined, columns: target?.table === targetTable && (target.schema ?? '') === targetSchema ? target.columns : undefined })
      if (runId === sqlRun.current && mounted.current) setSqlPreview(output)
    } catch (reason) { if (runId === sqlRun.current && mounted.current) setSqlError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (runId === sqlRun.current && mounted.current) setSqlBusy(false) }
  }
  async function copySql() {
    if (!sqlPreview?.sql) return
    try { await navigator.clipboard.writeText(sqlPreview.sql); notice(`已复制 ${sqlPreview.statements} 条 SQL 审查候选`) } catch { notice('复制失败，请检查剪贴板权限') }
  }
  return <div className={styles.panel}>
    <div className={styles.sourceBar}><div><span>左侧参考</span><strong title={leftLabel}>{leftLabel}</strong><small>{left.rows.length.toLocaleString()} 行 · {left.columns.length} 列{left.truncated || left.hasMore ? ' · 部分结果' : ''}</small></div><ArrowRight size={18} /><div><span>右侧目标</span><strong title={rightLabel}>{rightLabel}</strong><small>{right.rows.length.toLocaleString()} 行 · {right.columns.length} 列{right.truncated || right.hasMore ? ' · 部分结果' : ''}</small></div></div>
    <div className={`${styles.scopeNotice} ${partial ? styles.partial : ''}`}>{partial && <WarningCircle size={14} />}<span>仅比较这两份已加载结果。{partial ? '输入包含截断或更多数据；当前范围独有不代表完整表缺失。' : '比较结果描述当前查询或表页范围。'}</span></div>
    <div className={styles.compareToolbar}><button type="button" className={styles.mappingToggle} disabled={busy} aria-expanded={mappingOpen} onClick={() => setMappingOpen(!mappingOpen)}><ArrowsLeftRight size={14} />{configuration.mapping.length} 对列 · {configuration.keys.length} 个匹配键<CaretDown size={12} /></button><span>左侧 → 右侧审查</span>{busy ? <button type="button" onClick={() => controller.current?.abort()}><Stop size={13} />取消比较</button> : <button type="button" className={styles.primary} disabled={!configuration.mapping.length || !configuration.keys.length} onClick={() => void run()}><Play size={13} />{comparison ? '重新比较' : '开始比较'}</button>}</div>
    <div className={styles.body}>
      {mappingOpen && <CompareMappingEditor left={left} right={right} mapping={configuration.mapping} keys={configuration.keys} primaryKeys={leftPrimaryKeys} disabled={busy} onChange={changeConfiguration} />}
      {error && <p role="alert" className={styles.error}><WarningCircle size={14} />{error}</p>}
      {busy && <div className={styles.progress} role="status"><div><SpinnerGap size={15} className={styles.spinner} /><strong>{progress?.phase === 'left' ? '索引左侧结果' : progress?.phase === 'right' ? '索引右侧结果' : '比较匹配行'}</strong><span>{progress ? `${Math.round(progress.completed / Math.max(1, progress.total) * 100)}%` : '准备中'}</span></div><progress max={progress?.total || 1} value={progress?.completed ?? 0} /><p>最多比较 10,000 行与 1,000,000 个单元格，可随时取消。</p></div>}
      {!busy && !comparison && !error && <div className={styles.empty}><ArrowsLeftRight size={25} /><strong>{configuration.keys.length ? '准备比较已加载结果' : '请选择匹配键'}</strong><p>选择一列或多列唯一匹配行，再审查新增、删除、修改和键冲突。数字文本保留原始精度，缺失值与 NULL 分开处理。</p></div>}
      {comparison && <><nav className={styles.kindTabs} aria-label="比较结果分类">{(['changes', 'all', 'added', 'removed', 'modified', 'conflict', 'unchanged'] as const).map((kind) => <button type="button" key={kind} aria-pressed={filter === kind} onClick={() => { setFilter(kind); setPage(0); setActiveId(null) }} data-kind={kind}>{kind === 'changes' ? '差异' : kind === 'all' ? '全部' : kindNames[kind]}<b>{kind === 'changes' ? comparison.entries.length - comparison.counts.unchanged : kind === 'all' ? comparison.entries.length : comparison.counts[kind]}</b></button>)}</nav>
        <div className={styles.resultsToolbar}><label><MagnifyingGlass size={14} /><input aria-label="搜索比较结果的键和原始值" placeholder="搜索键或原始值…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); setActiveId(null) }} /></label><button type="button" disabled={!eligible.length} onClick={selectFiltered}>{allSelected ? '取消当前筛选选择' : '选择当前筛选'}</button><span>{selected.size} 个建议已选择</span>{selected.size > 0 && <button type="button" onClick={() => changeSelected(new Set())}>清空</button>}</div>
        <div className={styles.resultsLayout}><div className={styles.matrix}><table><thead><tr><th><input type="checkbox" aria-label="选择当前筛选差异" checked={allSelected} disabled={!eligible.length} onChange={selectFiltered} /></th><th>状态</th><th>匹配键</th><th>左侧行</th><th>右侧行</th><th>变化</th></tr></thead><tbody>{visible.map((entry) => <tr key={entry.id} data-active={activeId === entry.id || undefined} onClick={() => setActiveId(entry.id)}><td><input type="checkbox" aria-label={`选择 ${entry.keyValues.map((value) => compareCellText(value)).join(' / ')} 的建议`} disabled={!selectable(entry)} checked={selected.has(entry.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleRow(entry.id)} /></td><td><span className={styles.kind} data-kind={entry.kind}>{kindNames[entry.kind]}</span></td><td><button type="button" title={entry.keyValues.map((value) => compareCellText(value)).join(' / ')} onClick={() => setActiveId(entry.id)}>{entry.keyValues.map((value) => compareCellText(value)).join(' / ')}</button></td><td>{entry.leftRows.length ? entry.leftRows.length > 1 ? `${entry.leftRows.length} 行重复` : entry.leftRows[0] + 1 : '—'}</td><td>{entry.rightRows.length ? entry.rightRows.length > 1 ? `${entry.rightRows.length} 行重复` : entry.rightRows[0] + 1 : '—'}</td><td>{entry.kind === 'conflict' ? '需处理' : entry.changes.length || '—'}</td></tr>)}</tbody></table>{!visible.length && <div className={styles.resultsEmpty}>{query ? '没有匹配的键或原始值' : filter === 'changes' ? '当前映射与匹配键下，没有发现差异' : '当前分类没有记录'}</div>}<footer className={styles.pagination}><span>{filtered.length ? `${pageIndex * PAGE_SIZE + 1}–${Math.min((pageIndex + 1) * PAGE_SIZE, filtered.length)} / ${filtered.length}` : '0 个匹配键'}</span><button type="button" disabled={pageIndex === 0} aria-label="上一页比较结果" onClick={() => setPage(pageIndex - 1)}><CaretLeft size={13} /></button><button type="button" disabled={(pageIndex + 1) * PAGE_SIZE >= filtered.length} aria-label="下一页比较结果" onClick={() => setPage(pageIndex + 1)}><CaretRight size={13} /></button></footer></div>
          {active ? <CompareEntryDetail key={active.id} entry={active} comparison={comparison} provider={provider} leftLabel={leftLabel} rightLabel={rightLabel} /> : <div className={styles.detailPlaceholder}><Code size={20} /><span>点击匹配键查看两侧原始值</span></div>}</div>
      </>}
      {sqlOpen && comparison && <section className={styles.sqlReview} aria-label="SQL 修改建议预览"><div className={styles.sectionHead}><strong>SQL 修改建议</strong><span>仅为当前明确选择的差异生成审查候选</span></div><div className={styles.sqlTarget}><label>目标表<input aria-label="SQL 建议目标表" value={targetTable} onChange={(event) => { setTargetTable(event.target.value); clearSql() }} placeholder="提供真实目标表名" /></label><label>Schema<input aria-label="SQL 建议目标 schema" value={targetSchema} onChange={(event) => { setTargetSchema(event.target.value); clearSql() }} placeholder="可选" /></label>{!provider && <label>SQL 方言<select aria-label="SQL 建议数据库类型" value={sqlProvider} onChange={(event) => { setSqlProvider(event.target.value as RelationalProvider | ''); clearSql() }}><option value="">请选择</option><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="sqlite">SQLite</option></select></label>}<button type="button" disabled={!selected.size || !targetTable.trim() || !sqlProvider || sqlBusy} onClick={() => void generateSql()}>{sqlBusy ? <SpinnerGap size={13} className={styles.spinner} /> : <Code size={13} />}生成预览</button></div>{sqlError && <p role="alert" className={styles.error}>{sqlError}</p>}{sqlPreview && <>{sqlPreview.warnings.map((warning) => <p className={styles.sqlWarning} key={warning}>{warning}</p>)}{sqlPreview.skipped.length > 0 && <details className={styles.skipped}><summary>{sqlPreview.skipped.length} 个建议未生成 SQL</summary>{sqlPreview.skipped.map((item) => <p key={item.entryId}>{item.entryId} · {item.reason}</p>)}</details>}<textarea readOnly spellCheck={false} aria-label="SQL 修改建议预览内容" value={sqlPreview.sql || '当前选择没有可生成的 SQL 候选。'} /><div className={styles.sqlActions}><span>{sqlPreview.statements} 条候选</span><button type="button" disabled={!sqlPreview.sql} onClick={() => void copySql()}><Copy size={13} />复制 SQL</button>{onSqlPreview && <button type="button" disabled={!sqlPreview.sql} onClick={() => onSqlPreview(sqlPreview.sql)}>放入 SQL 编辑器审查<ArrowRight size={13} /></button>}</div></>}</section>}
    </div>
    <footer className={styles.footer}><span>{feedback || '范围：当前已加载结果 · 匹配键需要显式确认'}{comparison ? ` · ${Math.round(comparison.elapsedMs)} ms` : ''}</span>{comparison && <button type="button" aria-expanded={sqlOpen} onClick={() => setSqlOpen(!sqlOpen)}><Code size={14} />SQL 建议{selected.size ? ` · ${selected.size}` : ''}</button>}</footer>
  </div>
}
