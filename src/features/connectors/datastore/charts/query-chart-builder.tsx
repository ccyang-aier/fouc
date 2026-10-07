"use client"

import { useMemo, useState } from 'react'
import { ChartBar, ChartLine, ChartPieSlice, ChartScatter, CheckCircle, FloppyDisk, GearSix, Info, Table, WarningCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import type { DatabaseQueryResult } from '@fouc/shared'
import { QueryChartCanvas } from './chart-canvas'
import { useStoredChartConfig } from './config-storage'
import { defaultQueryChartConfig, queryChartFields, type ChartField, type QueryChartConfig, type QueryChartType } from './model'
import { transformQueryChart, type QueryChartData } from './transform'
import styles from './query-chart.module.css'

export type QueryChartBuilderProps = { result: DatabaseQueryResult; /** Stable connection / document identity, supplied by the resource owner. */ scopeKey?: string }
const types: { id: QueryChartType; label: string; icon: typeof ChartBar }[] = [{ id: 'bar', label: '柱状图', icon: ChartBar }, { id: 'line', label: '折线图', icon: ChartLine }, { id: 'area', label: '面积图', icon: ChartLine }, { id: 'scatter', label: '散点图', icon: ChartScatter }, { id: 'pie', label: '饼图', icon: ChartPieSlice }]
const aggregations = [{ value: 'none', label: '原始值 · 不聚合' }, { value: 'sum', label: '合计 SUM' }, { value: 'avg', label: '平均 AVG' }, { value: 'min', label: '最小 MIN' }, { value: 'max', label: '最大 MAX' }, { value: 'count', label: '行数 COUNT(*)' }] as const
function missingOption(fields: readonly ChartField[], key: string | null) { return key && !fields.some((field) => field.key === key) ? <option value={key}>字段已不存在：{key.split('\u0000')[0]}</option> : null }

function ChartDataPreview({ data }: { data: QueryChartData }) {
  const [page, setPage] = useState(0), pages = Math.max(1, Math.ceil(data.categories.length / 40)), current = Math.min(page, pages - 1), start = current * 40
  return <div className={styles.dataPreview}>
    <div className={styles.previewHead}><span>绘图数据 · 数值文本保留精度</span><div><button disabled={!current} onClick={() => setPage(current - 1)}>上一页</button><small>{current + 1} / {pages}</small><button disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>下一页</button></div></div>
    <div className={styles.previewScroll}><table><thead><tr><th>分类</th>{data.series.map((series) => <th key={series.key}>{series.label}</th>)}</tr></thead><tbody>{data.categories.slice(start, start + 40).map((category, offset) => <tr key={category.key}><th>{category.label}</th>{data.series.map((series) => { const point = series.data[start + offset]; return <td key={series.key} title={point ? `来源 ${point.sourceRows} 行` : '未绘制：NULL、缺失或精度限制'}><code>{point?.exact ?? '—'}</code></td> })}</tr>)}</tbody></table></div>
  </div>
}

function ChartBuilderContent({ result, fields, initial, initialSaved, save, persistent }: { result: DatabaseQueryResult; fields: ChartField[]; initial: QueryChartConfig; initialSaved: boolean; save: (config: QueryChartConfig) => boolean; persistent: boolean }) {
  const [config, setConfig] = useState(initial), [savedSignature, setSavedSignature] = useState<string | null>(initialSaved ? JSON.stringify(initial) : null), [settings, setSettings] = useState(true), [preview, setPreview] = useState(false), [feedback, setFeedback] = useState<string | null>(null)
  const data = useMemo(() => transformQueryChart(result, config, fields), [result, config, fields]), dirty = JSON.stringify(config) !== savedSignature, xLabel = fields.find((field) => field.key === config.x)?.label ?? '结果行号'
  const drawable = data.series.some((series) => series.data.some((point) => point && (config.type !== 'pie' || point.value > 0)))
  function change(next: Partial<QueryChartConfig>) { setConfig((current) => ({ ...current, ...next })); setFeedback(null) }
  function saveSettings() { if (save(config)) { setSavedSignature(JSON.stringify(config)); setFeedback('图表设置已保存，下次打开此查询时恢复') } else setFeedback('浏览器未允许保存；当前图表设置仍然可用') }
  return <section className={styles.builder} aria-label="查询图表构建器">
    <header className={styles.toolbar}>
      <div className={styles.types} role="group" aria-label="图表类型">{types.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={config.type === id} title={label} onClick={() => change({ type: id })}><Icon size={15} /><span>{label}</span></button>)}</div>
      <div className={styles.tools}><button aria-pressed={settings} title="图表设置" onClick={() => setSettings((value) => !value)}><GearSix size={15} /><span>设置</span></button><button aria-pressed={preview} disabled={!!data.error || !data.categories.length} onClick={() => setPreview((value) => !value)}><Table size={15} /><span>绘图数据</span></button><button disabled={!persistent || !!data.error || !dirty} title={persistent ? '保存到当前连接与查询' : '此结果未提供持久资源身份，设置仅在当前视图有效'} onClick={saveSettings}><FloppyDisk size={15} /><span>{!persistent ? '临时设置' : dirty ? '保存设置' : '已保存'}</span></button></div>
    </header>
    <div className={`${styles.body} ${settings ? styles.withSettings : ''}`}>
      {settings && <aside className={styles.settings} aria-label="图表字段与聚合设置">
        <div className={styles.settingsHead}><strong>构建图表</strong><button title="恢复默认图表设置" onClick={() => { setConfig(defaultQueryChartConfig(fields)); setFeedback('已恢复默认设置；保存后将在下次打开时生效') }}><ArrowCounterClockwise size={14} />重置</button></div>
        <label>X 轴 / 分类<select aria-label="图表 X 轴" value={config.x ?? ''} onChange={(event) => change({ x: event.target.value || null })}><option value="">结果行号（1…N）</option>{missingOption(fields, config.x)}{fields.map((field) => <option key={field.key} value={field.key}>{field.label}{!field.scalar ? ' · 对象 / 空列' : ''}</option>)}</select></label>
        <label>数值处理<select aria-label="图表聚合方式" value={config.aggregation} onChange={(event) => change({ aggregation: event.target.value as QueryChartConfig['aggregation'] })}>{aggregations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <fieldset className={styles.metrics} disabled={config.aggregation === 'count'}><legend>Y 轴指标 <small>{config.aggregation === 'count' ? '统计全部来源行' : `${config.ys.length} / 6`}</small></legend>{config.ys.filter((key) => !fields.some((field) => field.key === key)).map((key) => <label key={key} className={styles.missing}><input type="checkbox" checked onChange={() => change({ ys: config.ys.filter((entry) => entry !== key) })} />字段已不存在：{key.split('\u0000')[0]}</label>)}{fields.filter((field) => field.numeric).map((field) => <label key={field.key} title={field.unsafe ? `${field.unsafe} 个值存在精度风险，将明确提示并保留空白` : field.label}><input type="checkbox" checked={config.ys.includes(field.key)} disabled={!config.ys.includes(field.key) && config.ys.length >= 6} onChange={(event) => change({ ys: event.target.checked ? [...config.ys, field.key] : config.ys.filter((key) => key !== field.key) })} /><span>{field.label}</span>{!!field.unsafe && <WarningCircle size={12} />}</label>)}{!fields.some((field) => field.numeric) && <p>没有数值列。可使用 COUNT(*) 统计分类行数。</p>}</fieldset>
        <label>分组<select aria-label="图表分组字段" value={config.group ?? ''} onChange={(event) => change({ group: event.target.value || null })}><option value="">不分组</option>{missingOption(fields, config.group)}{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label>
        <label>排序<select aria-label="图表排序" value={config.sort} onChange={(event) => change({ sort: event.target.value as QueryChartConfig['sort'] })}><option value="source">来源顺序</option><option value="x-asc">X 轴升序</option><option value="x-desc">X 轴降序</option><option value="value-desc">首个系列 · 数值降序</option><option value="value-asc">首个系列 · 数值升序</option></select></label>
        <div className={styles.controlPair}><label>分类上限<input aria-label="图表分类上限" type="number" min={1} max={1000} value={Number.isNaN(config.limit) ? '' : config.limit} onChange={(event) => change({ limit: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label><label>NULL 指标<select aria-label="图表 NULL 处理" value={config.nulls} onChange={(event) => change({ nulls: event.target.value as QueryChartConfig['nulls'] })}><option value="gap">保留空白</option><option value="skip">跳过整行</option><option value="zero">显式按 0</option></select></label></div>
        <p className={styles.settingsNote}><Info size={13} />聚合先处理全部已加载行，再排序并应用分类上限。设置不改变原始结果或导出。</p>
      </aside>}
      <div className={styles.visual}>
        {data.error ? <div className={styles.empty} role="alert"><WarningCircle size={28} /><strong>调整图表设置</strong><p>{data.error}</p><button onClick={() => setSettings(true)}>查看设置</button></div> : !result.rows.length ? <div className={styles.empty}><ChartBar size={30} /><strong>没有可绘制的记录</strong><p>查询已成功；当前已加载结果为空。</p></div> : !drawable ? <div className={styles.empty}><ChartLine size={30} /><strong>没有可安全绘制的数值</strong><p>当前指标可能全部为 NULL、非数值或超出安全精度。请选择其他字段或使用 COUNT(*)。</p><button onClick={() => setSettings(true)}>调整指标</button></div> : <QueryChartCanvas data={data} config={config} xLabel={xLabel} />}
        {preview && !data.error && data.categories.length > 0 && <ChartDataPreview data={data} />}
      </div>
    </div>
    {(data.partial || data.diagnostics.length > 0 || data.approximate > 0) && <details className={styles.diagnostics}><summary><WarningCircle size={13} /><span>{data.partial ? '当前仅绘制已加载范围' : '绘图数据提示'}{data.diagnostics.length ? ` · ${data.diagnostics.reduce((count, item) => count + item.count, 0)} 项值处理记录` : ''}{data.approximate ? ` · ${data.approximate} 个平均值标为近似` : ''}</span></summary><div>{data.partial && <p>查询存在更多结果或已达到返回上限。图表与聚合仅反映当前已加载的 {result.rows.length.toLocaleString()} 行。</p>}{data.diagnostics.map((diagnostic) => <p key={diagnostic.code}><strong>{diagnostic.count.toLocaleString()} 项</strong> · {diagnostic.message}{diagnostic.examples.length > 0 && <small>{diagnostic.examples.join('；')}</small>}</p>)}{!!data.approximate && <p>无法有限表达的平均值以 ≈ 标记；悬停与绘图数据展示精确合计 / 有效值数量。</p>}</div></details>}
    <footer className={styles.footer}><span><i />已加载 {data.sourceRows.toLocaleString()} 行{!data.error && ` · 显示 ${data.categories.length.toLocaleString()} / ${data.totalCategories.toLocaleString()} 个${config.aggregation === 'none' ? '来源点' : '分类'}`}{data.limited && ' · 已应用显示上限'}</span>{feedback ? <span role="status"><CheckCircle size={12} />{feedback}</span> : <small>{persistent ? dirty ? '设置尚未保存' : '当前查询的图表设置' : '设置仅在当前视图有效'}</small>}</footer>
  </section>
}

export function QueryChartBuilder({ result, scopeKey }: QueryChartBuilderProps) {
  const fields = useMemo(() => queryChartFields(result), [result]), store = useStoredChartConfig(scopeKey)
  if (store.saved === undefined) return <div className={styles.loading} role="status">正在读取图表设置…</div>
  return <ChartBuilderContent key={scopeKey ?? '$local'} result={result} fields={fields} initial={store.saved ?? defaultQueryChartConfig(fields)} initialSaved={store.saved !== null} save={store.save} persistent={!!scopeKey} />
}
