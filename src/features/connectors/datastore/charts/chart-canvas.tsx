"use client"

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ECharts } from 'echarts/core'
import { SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { queryChartOption, type QueryChartTheme } from './options'
import type { QueryChartConfig } from './model'
import type { QueryChartData } from './transform'
import styles from './query-chart.module.css'

let library: Promise<typeof import('echarts/core')> | undefined
function loadChartLibrary() {
  return library ??= Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')]).then(([core, charts, components, renderers]) => {
    core.use([charts.BarChart, charts.LineChart, charts.ScatterChart, charts.PieChart, components.GridComponent, components.TooltipComponent, components.LegendComponent, components.DataZoomComponent, renderers.SVGRenderer])
    return core
  }).catch((error: unknown) => { library = undefined; throw error })
}
function theme(element: HTMLElement): QueryChartTheme {
  const computed = getComputedStyle(element), color = (name: string, fallback: string) => computed.getPropertyValue(name).trim() || fallback
  return { ink: color('--ink-soft', '#3f4249'), muted: color('--muted-strong', '#81858d'), line: color('--line', '#e8e9ed'), panel: color('--panel', '#fff'), accent: color('--chart-series-primary', '#5470c6'), font: computed.fontFamily }
}
export function QueryChartCanvas({ data, config, xLabel }: { data: QueryChartData; config: QueryChartConfig; xLabel: string }) {
  const container = useRef<HTMLDivElement>(null), instance = useRef<ECharts | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [retry, setRetry] = useState(0)
  const draw = useEffectEvent(() => { if (instance.current && container.current) instance.current.setOption(queryChartOption(data, config, theme(container.current), xLabel), { notMerge: true }) })
  useEffect(() => {
    let disposed = false
    const element = container.current
    if (!element) return
    let core: typeof import('echarts/core') | undefined
    function initialize() {
      if (disposed || !core || !element || instance.current || !element.clientWidth || !element.clientHeight) return
      instance.current = core.init(element, undefined, { renderer: 'svg' }); draw(); setStatus('ready')
    }
    const resize = new ResizeObserver(() => { initialize(); instance.current?.resize() }), appearance = new MutationObserver(() => draw())
    resize.observe(element); appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-accent'] }); appearance.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-accent'] })
    void loadChartLibrary().then((loaded) => {
      if (disposed) return
      core = loaded; initialize()
    }).catch(() => { if (!disposed) setStatus('error') })
    return () => { disposed = true; resize.disconnect(); appearance.disconnect(); instance.current?.dispose(); instance.current = null }
  }, [retry])
  useEffect(() => { draw() }, [data, config, xLabel])
  return <div className={styles.canvasWrap}>
    <div className={styles.canvas} ref={container} role="img" aria-label={`${xLabel} · ${data.series.map((series) => series.label).join('、')} · ${data.categories.length} 个分类；可在绘图数据中核对原始数值`} />
    {status === 'loading' && <div className={styles.canvasStatus} role="status"><SpinnerGap size={20} className={styles.spin} /><strong>正在加载图表</strong><span>仅在使用图表时加载绘图模块</span></div>}
    {status === 'error' && <div className={styles.canvasStatus} role="alert"><WarningCircle size={24} /><strong>绘图模块加载失败</strong><span>查询结果与图表设置已保留。</span><button type="button" className="fouc-action" onClick={() => { setStatus('loading'); setRetry((value) => value + 1) }}>重新加载</button></div>}
  </div>
}
