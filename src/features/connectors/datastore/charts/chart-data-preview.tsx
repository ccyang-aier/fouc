"use client"

import { useState } from 'react'
import type { QueryChartData } from './transform'
import styles from './query-chart.module.css'

export function ChartDataPreview({ data }: { data: QueryChartData }) {
  const [page, setPage] = useState(0), pages = Math.max(1, Math.ceil(data.categories.length / 40)), current = Math.min(page, pages - 1), start = current * 40
  return <div className={styles.dataPreview}>
    <div className={styles.previewHead}><span>绘图数据 · 数值文本保留精度</span><div><button type="button" className="fouc-action" disabled={!current} onClick={() => setPage(current - 1)}>上一页</button><small>{current + 1} / {pages}</small><button type="button" className="fouc-action" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>下一页</button></div></div>
    <div className={styles.previewScroll}><table><thead><tr><th>分类</th>{data.series.map((series) => <th key={series.key}>{series.label}</th>)}</tr></thead><tbody>{data.categories.slice(start, start + 40).map((category, offset) => <tr key={category.key}><th>{category.label}</th>{data.series.map((series) => { const point = series.data[start + offset]; return <td key={series.key} title={point ? `来源 ${point.sourceRows} 行` : '未绘制：NULL、缺失或精度限制'}><code>{point?.exact ?? '—'}</code></td> })}</tr>)}</tbody></table></div>
  </div>
}
