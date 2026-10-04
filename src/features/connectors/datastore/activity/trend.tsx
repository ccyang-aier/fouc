import { databaseActivityMetrics, type DatabaseActivitySnapshot } from '@fouc/shared/database-activity';
import styles from './activity.module.css';

export function ActivityTrend({ samples, metricId, label }: { samples: DatabaseActivitySnapshot[]; metricId: string; label: string }) {
  const points = samples.map((sample, index) => {
    const metric = databaseActivityMetrics(sample, samples[index - 1]).find(item => item.id === metricId);
    return { at: sample.capturedAt, value: typeof metric?.value === 'number' && Number.isFinite(metric.value) ? metric.value : null };
  });
  const valid = points.filter((point): point is { at: number; value: number } => point.value !== null);
  if (!valid.length) return <div className={styles.trendEmpty}>等待第二个有效样本以计算 {label}</div>;
  const max = Math.max(1, ...valid.map(point => point.value));
  const start = points[0].at, range = Math.max(1, points.at(-1)!.at - start);
  let path = '', gap = true;
  for (const point of points) {
    if (point.value === null) { gap = true; continue; }
    const x = 8 + (point.at - start) / range * 584;
    const y = 105 - point.value / max * 90;
    path += `${gap ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `;
    gap = false;
  }
  const last = valid.at(-1)!;
  return <div className={styles.trend}>
    <div><strong>{label}</strong><span>{valid.length} 个有效速率样本 · {new Date(start).toLocaleTimeString()} — {new Date(points.at(-1)!.at).toLocaleTimeString()}</span></div>
    <svg viewBox="0 0 600 120" role="img" aria-label={`${label}，最新 ${last.value.toFixed(3)}，按真实采样时间绘制；缺失或重置的速率断开显示`}>
      {[15, 60, 105].map(y => <line key={y} x1="8" y1={y} x2="592" y2={y} className={styles.chartGrid}/>)}
      <path d={path} className={styles.chartLine}/>
      <circle cx={8 + (last.at - start) / range * 584} cy={105 - last.value / max * 90} r="3" className={styles.chartDot}/>
    </svg>
    <small>刻度上限 {max.toLocaleString(undefined, { maximumFractionDigits: 3 })} /s · 0 /s</small>
  </div>;
}
