"use client"

import { Info } from '@phosphor-icons/react'
import { SqlDialog } from '../sql-library-dialog'
import type { ChartField, QueryChartConfig } from './model'
import styles from './query-chart.module.css'

const aggregations = [{ value: 'none', label: '原始值 · 不聚合' }, { value: 'sum', label: '合计 SUM' }, { value: 'avg', label: '平均 AVG' }, { value: 'min', label: '最小 MIN' }, { value: 'max', label: '最大 MAX' }, { value: 'count', label: '行数 COUNT(*)' }] as const
export function ChartSettingsDialog({ config, fields, onChange, onClose }: { config: QueryChartConfig; fields: readonly ChartField[]; onChange: (next: Partial<QueryChartConfig>) => void; onClose: () => void }) {
  return <SqlDialog title="图表高级设置" className={styles.settingsDialog} onClose={onClose}>
    <div className={styles.settings}>
      <label>图表类型<select aria-label="高级图表类型" value={config.type} onChange={event => onChange({ type: event.target.value as QueryChartConfig['type'] })}><option value="bar">柱状图</option><option value="line">折线图</option><option value="pie">饼图</option><option value="area">面积图</option><option value="scatter">散点图</option></select></label>
      <label>数值处理<select aria-label="图表聚合方式" value={config.aggregation} onChange={event => onChange({ aggregation: event.target.value as QueryChartConfig['aggregation'] })}>{aggregations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>分组<select aria-label="图表分组字段" value={config.group ?? ''} onChange={event => onChange({ group: event.target.value || null })}><option value="">不分组</option>{config.group && !fields.some(field => field.key === config.group) && <option value={config.group}>字段已不存在</option>}{fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label>
      <label>排序<select aria-label="图表排序" value={config.sort} onChange={event => onChange({ sort: event.target.value as QueryChartConfig['sort'] })}><option value="source">来源顺序</option><option value="x-asc">X 轴升序</option><option value="x-desc">X 轴降序</option><option value="value-desc">首个系列 · 数值降序</option><option value="value-asc">首个系列 · 数值升序</option></select></label>
      <div className={styles.controlPair}><label>分类上限<input aria-label="图表分类上限" type="number" min={1} max={1000} value={Number.isNaN(config.limit) ? '' : config.limit} onChange={event => onChange({ limit: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label><label>NULL 指标<select aria-label="图表 NULL 处理" value={config.nulls} onChange={event => onChange({ nulls: event.target.value as QueryChartConfig['nulls'] })}><option value="gap">保留空白</option><option value="skip">跳过整行</option><option value="zero">显式按 0</option></select></label></div>
      <p className={styles.settingsNote}><Info size={14} />聚合处理全部已加载行，设置不改变原始结果或导出。</p>
    </div>
    <footer className={styles.settingsFooter}><button type="button" className="fouc-action" onClick={onClose}>完成</button></footer>
  </SqlDialog>
}
