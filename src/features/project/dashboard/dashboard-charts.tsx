'use client';

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { ArrowClockwise, DotsThree, DownloadSimple } from '@phosphor-icons/react';
import {
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DashboardPeriod, DashboardPersonId } from './dashboard-model';
import { AvatarGroup, IconButton, SegmentedControl } from './dashboard-ui';
import { DashboardMenu as DropdownMenu, DashboardMenuContent as DropdownMenuContent } from './dashboard-menu';
import styles from './dashboard-charts.module.css';

const activityPeriods: readonly DashboardPeriod[] = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
const activityAxes: Record<DashboardPeriod, readonly string[]> = {
  Daily: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
  Weekly: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  Monthly: ['Feb 1', 'Feb 5', 'Feb 9', 'Feb 13', 'Feb 17', 'Feb 21', 'Feb 25', 'Feb 28'],
  Yearly: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov', 'Dec'],
};
interface TimelineTask {
  id: string;
  row: string;
  title: string;
  progress: number;
  people: readonly DashboardPersonId[];
  tone: string;
  start: number;
  duration: number;
}
const timelineTasks: readonly TimelineTask[] = [
  { id: 'brand', row: 'Dashboard Design', title: 'Update Brand Logo Guidelines', progress: 60, people: ['jerome', 'tania', 'cameron'], tone: 'mint', start: 3, duration: 39 },
  { id: 'wireframe', row: 'Mobile App', title: 'Setup Wireframe', progress: 50, people: ['jerome', 'tania'], tone: 'peach', start: 12.6, duration: 29.4 },
  { id: 'abc', row: 'Landing Page', title: 'Update ABC Project', progress: 40, people: ['jerome', 'cameron'], tone: 'lavender', start: 27.3, duration: 28.1 },
  { id: 'meeting', row: 'Meeting', title: 'Dev Sync Meeting', progress: 0, people: ['jerome', 'cameron'], tone: 'purple', start: 65.3, duration: 29.9 },
];
const periodOffsets: Record<DashboardPeriod, number> = { Daily: 0, Weekly: -2, Monthly: 3, Yearly: -1 };

export function ActivityMap({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [period, setPeriod] = useState<DashboardPeriod>('Daily');
  const axes = activityAxes[period];
  return <section className={`${styles.panel} ${styles.activityPanel}`} aria-labelledby="dashboard-activity-map-title">
    <header className={styles.panelHeader}>
      <h2 id="dashboard-activity-map-title">Time-Based Activity Map</h2>
      <SegmentedControl items={activityPeriods} value={period} onChange={setPeriod} label="Activity timeline period" />
    </header>
    <div className={styles.timeline}>
      <div className={styles.timelineRows}>
        {timelineTasks.map(task => <div className={styles.timelineRow} key={task.id}>
          <span className={styles.rowLabel}>{task.row}</span>
          <div className={styles.rowTrack}>
            <button
              type="button"
              className={`fouc-action ${styles.timelineTask} ${styles[task.tone]}`}
              style={{ '--task-start': `${task.start + periodOffsets[period]}%`, '--task-width': `${task.duration}%` } as CSSProperties}
              onClick={() => onOpenTask(task.id)}
              aria-label={`${task.title}, ${task.progress}% complete. Open details`}
              title={`${task.title} · ${task.progress}% complete`}
            >
              <AvatarGroup ids={task.people} size={16} />
              <span className={styles.timelineTaskTitle}>{task.title}</span>
              <strong>{task.progress}%</strong>
            </button>
          </div>
        </div>)}
      </div>
      <div className={styles.currentTime} aria-label={period === 'Daily' ? 'Current time: 01:00 PM' : 'Current period'} />
      <div className={styles.timeAxis} aria-hidden="true">
        {axes.map((label, index) => <span key={label} data-current={index === 4}>{label}</span>)}
      </div>
    </div>
  </section>;
}

type MilestonePeriod = '1 Monts' | '3 Months' | '6 Month' | '1 Year';
interface MilestonePoint { month: string; target: number; actual: number; }
const milestonePeriods: readonly MilestonePeriod[] = ['1 Monts', '3 Months', '6 Month', '1 Year'];
const milestonePoints: readonly MilestonePoint[] = [
  { month: 'Jan', target: 60, actual: 72 },
  { month: 'Feb', target: 41, actual: 25 },
  { month: 'Mar', target: 39, actual: 65 },
  { month: 'Apr', target: 85, actual: 82 },
  { month: 'May', target: 99, actual: 112 },
  { month: 'Jun', target: 85, actual: 50 },
  { month: 'Jul', target: 95, actual: 90 },
  { month: 'Aug', target: 110, actual: 104 },
  { month: 'Sep', target: 102, actual: 97 },
  { month: 'Oct', target: 120, actual: 114 },
  { month: 'Nov', target: 132, actual: 129 },
  { month: 'Dec', target: 140, actual: 136 },
];
const rangeLength: Record<MilestonePeriod, number> = { '1 Monts': 1, '3 Months': 3, '6 Month': 6, '1 Year': 12 };
const monthNames: Record<string, string> = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };

let chartLibrary: Promise<typeof import('echarts/core')> | undefined;
function loadChartLibrary() {
  return chartLibrary ??= Promise.all([
    import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers'),
  ]).then(([core, charts, components, renderers]) => {
    core.use([charts.BarChart, components.GridComponent, renderers.CanvasRenderer]);
    return core;
  }).catch((error: unknown) => { chartLibrary = undefined; throw error; });
}

function milestoneChartOption(points: readonly MilestonePoint[], fontFamily: string): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: -12, right: -12, top: 16, bottom: 42 },
    xAxis: {
      type: 'category', data: points.map(point => point.month),
      axisLine: { show: false }, axisTick: { show: false, alignWithLabel: true },
      axisLabel: { color: '#55555f', fontFamily, fontSize: 12, margin: 26, interval: 0 },
      splitLine: { show: true, alignWithLabel: true, lineStyle: { color: '#e7e7e9', width: 1.5, type: [3, 3] } },
    },
    yAxis: { type: 'value', max: 170, show: false },
    series: [
      { name: 'Target', type: 'bar', data: points.map(point => point.target), barWidth: points.length > 6 ? 8 : 12, barGap: '35%', itemStyle: { color: '#56877e', borderRadius: 4 }, silent: true },
      { name: 'Actual', type: 'bar', data: points.map(point => point.actual), barWidth: points.length > 6 ? 8 : 12, itemStyle: { color: '#f36e16', borderRadius: 4 }, silent: true },
    ],
  };
}

function exportMilestones(points: readonly MilestonePoint[]) {
  const csv = `Month,Target,Actual\r\n${points.map(point => `${point.month} 2027,${point.target},${point.actual}`).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'milestone-tracker.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function MilestoneTracker() {
  const [period, setPeriod] = useState<MilestonePeriod>('6 Month');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const instance = useRef<ECharts | null>(null);
  const controls = useRef<HTMLDivElement>(null);
  const points = milestonePoints.slice(0, rangeLength[period]);
  const activePoint = activeIndex === null ? undefined : points[activeIndex];
  const draw = useEffectEvent(() => {
    if (instance.current && canvas.current) instance.current.setOption(milestoneChartOption(points, getComputedStyle(canvas.current).fontFamily), { notMerge: true });
  });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let core: typeof import('echarts/core') | undefined;
    function initialize() {
      if (disposed || !core || !element || instance.current || !element.clientWidth || !element.clientHeight) return;
      instance.current = core.init(element, undefined, { renderer: 'canvas' });
      draw();
      setStatus('ready');
    }
    const resize = new ResizeObserver(() => { initialize(); instance.current?.resize(); });
    resize.observe(element);
    void loadChartLibrary().then(loaded => { if (!disposed) { core = loaded; initialize(); } })
      .catch(() => { if (!disposed) setStatus('error'); });
    return () => { disposed = true; resize.disconnect(); instance.current?.dispose(); instance.current = null; };
  }, [retry]);

  useEffect(() => { draw(); }, [period]);

  function changePeriod(value: MilestonePeriod) { setPeriod(value); setActiveIndex(null); }
  function focusPoint(index: number) { controls.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus(); }

  return <section className={`${styles.panel} ${styles.milestonePanel}`} aria-labelledby="dashboard-milestone-title">
    <header className={styles.panelHeader}>
      <h2 id="dashboard-milestone-title">Milestone Tracker</h2>
      <div className={styles.milestoneActions}>
        <SegmentedControl items={milestonePeriods} value={period} onChange={changePeriod} label="Milestone date range" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Milestone options"><DotsThree size={18} weight="bold" /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" density="compact">
            <DropdownMenuItem onSelect={() => exportMilestones(points)}><DownloadSimple />Export CSV</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => changePeriod('6 Month')}><ArrowClockwise />Reset view</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <div className={styles.chartWrap}>
      <div className={styles.chartCanvas} ref={canvas} aria-hidden="true" />
      {status === 'ready' ? <div className={styles.chartControls} ref={controls} role="group" aria-label="Milestone target and actual tasks by month" onMouseLeave={() => { if (!controls.current?.contains(document.activeElement)) setActiveIndex(null); }}>
        {points.map((point, index) => <button
          type="button" key={point.month} className={styles.chartPoint} data-active={index === activeIndex}
          aria-label={`${monthNames[point.month]} 2027: target ${point.target} tasks, actual ${point.actual} tasks`}
          aria-describedby={index === activeIndex ? 'milestone-point-tooltip' : undefined}
          onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={event => {
            if (event.key === 'Escape') setActiveIndex(null);
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); focusPoint((index + (event.key === 'ArrowRight' ? 1 : -1) + points.length) % points.length); }
          }}
        />)}
      </div> : null}
      {activePoint && activeIndex !== null ? <div
        className={styles.chartTooltip} id="milestone-point-tooltip" role="tooltip"
        style={{
          '--tooltip-x': `calc(${(activeIndex + .5) / points.length * 100}% + ${(activeIndex + .5) / points.length * 24 - 12}px)`,
          '--tooltip-y': `${Math.max(-8, 16 + (170 - Math.max(activePoint.target, activePoint.actual)) / 170 * 162 - 88)}px`,
        } as CSSProperties}
      >
        <div className={styles.tooltipDate}>{monthNames[activePoint.month]}, 2027</div>
        <div className={styles.tooltipRow}><span className={styles.targetDot} />Target <span>{activePoint.target} Tasks</span></div>
        <div className={styles.tooltipRow}><span className={styles.actualDot} />Actual <span>{activePoint.actual} Tasks</span></div>
      </div> : null}
      {status === 'loading' ? <span className={styles.chartStatus} role="status" aria-label="Loading milestone chart"><span className={styles.loadingDots}><i /><i /><i /></span></span> : null}
      {status === 'error' ? <div className={styles.chartStatus} role="alert"><span>Couldn’t load the chart.</span><button type="button" className="fouc-action" onClick={() => { setStatus('loading'); setRetry(value => value + 1); }}>Try again</button></div> : null}
    </div>
  </section>;
}
