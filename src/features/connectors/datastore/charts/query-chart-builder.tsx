"use client"

import { useMemo, useState } from 'react'
import { ChartBar, ChartLine, WarningCircle } from '@phosphor-icons/react'
import { useAppAlert } from '@/components/app-alert-provider'
import type { DatabaseQueryResult } from '@fouc/shared'
import { QueryChartCanvas } from './chart-canvas'
import { ChartToolbar } from './chart-toolbar'
import { ChartSettingsDialog } from './chart-settings-dialog'
import { ChartDataPreview } from './chart-data-preview'
import { useStoredChartConfig } from './config-storage'
import { defaultQueryChartConfig, queryChartFields, type ChartField, type QueryChartConfig } from './model'
import { transformQueryChart } from './transform'
import styles from './query-chart.module.css'

export type QueryChartBuilderProps = { result: DatabaseQueryResult; /** Stable connection / document identity, supplied by the resource owner. */ scopeKey?: string }
function ChartBuilderContent({ result, fields, initial, initialSaved, save, persistent }: { result: DatabaseQueryResult; fields: ChartField[]; initial: QueryChartConfig; initialSaved: boolean; save: (config: QueryChartConfig) => boolean; persistent: boolean }) {
  const [config, setConfig] = useState(initial), [savedSignature, setSavedSignature] = useState<string | null>(initialSaved ? JSON.stringify(initial) : null), [settings, setSettings] = useState(false), [preview, setPreview] = useState(false)
  const { notify } = useAppAlert()
  const data = useMemo(() => transformQueryChart(result, config, fields), [result, config, fields]), dirty = JSON.stringify(config) !== savedSignature, xLabel = fields.find(field => field.key === config.x)?.label ?? '结果行号'
  const drawable = data.series.some(series => series.data.some(point => point && (config.type !== 'pie' || point.value > 0)))
  function change(next: Partial<QueryChartConfig>) { setConfig(current => ({ ...current, ...next })) }
  function saveSettings() {
    if (save(config)) { setSavedSignature(JSON.stringify(config)); notify('success', '图表设置已保存') }
    else notify('error', '图表设置未能保存，当前设置仍可用')
  }
  return <section className={styles.builder} aria-label="查询图表构建器">
    <ChartToolbar config={config} fields={fields} onChange={change} onSettings={() => setSettings(true)} onReset={() => { setConfig(defaultQueryChartConfig(fields)); notify('info', '已恢复默认图表设置') }} onSave={saveSettings} onPreview={() => setPreview(value => !value)} preview={preview} canPreview={!data.error && data.categories.length > 0} canSave={!data.error && dirty} persistent={persistent} />
    <div className={styles.visual}>
      {data.error ? <div className={styles.empty} role="alert"><WarningCircle size={26} /><strong>调整图表设置</strong><p>{data.error}</p><button type="button" className="fouc-action" onClick={() => setSettings(true)}>查看设置</button></div>
        : !result.rows.length ? <div className={styles.empty}><ChartBar size={28} /><strong>没有可绘制的记录</strong><p>当前已加载结果为空。</p></div>
        : !drawable ? <div className={styles.empty}><ChartLine size={28} /><strong>没有可安全绘制的数值</strong><p>请选择其他指标或使用 COUNT(*)。</p><button type="button" className="fouc-action" onClick={() => setSettings(true)}>调整指标</button></div>
        : <QueryChartCanvas data={data} config={config} xLabel={xLabel} />}
      {preview && !data.error && data.categories.length > 0 && <ChartDataPreview data={data} />}
    </div>
    {(data.partial || data.diagnostics.length > 0 || data.approximate > 0 || data.limited) && <details className={styles.diagnostics}><summary><WarningCircle size={13} /><span>{data.partial ? '仅绘制已加载范围' : '绘图数据提示'}</span></summary><div>
      {data.partial && <p>仅反映已加载的 {result.rows.length.toLocaleString()} 行。</p>}{data.limited && <p>显示 {data.categories.length.toLocaleString()} / {data.totalCategories.toLocaleString()} 个分类，已应用分类上限。</p>}
      {data.diagnostics.map(diagnostic => <p key={diagnostic.code}><strong>{diagnostic.count.toLocaleString()} 项</strong> · {diagnostic.message}{diagnostic.examples.length > 0 && <small>{diagnostic.examples.join('；')}</small>}</p>)}
      {!!data.approximate && <p>无法有限表达的平均值以 ≈ 标记；悬停与绘图数据保留精确合计和有效值数量。</p>}
    </div></details>}
    {settings && <ChartSettingsDialog config={config} fields={fields} onChange={change} onClose={() => setSettings(false)} />}
  </section>
}

export function QueryChartBuilder({ result, scopeKey }: QueryChartBuilderProps) {
  const fields = useMemo(() => queryChartFields(result), [result]), store = useStoredChartConfig(scopeKey)
  if (store.saved === undefined) return <div className={styles.loading} role="status">正在读取图表设置…</div>
  return <ChartBuilderContent key={scopeKey ?? '$local'} result={result} fields={fields} initial={store.saved ?? defaultQueryChartConfig(fields)} initialSaved={store.saved !== null} save={store.save} persistent={!!scopeKey} />
}
