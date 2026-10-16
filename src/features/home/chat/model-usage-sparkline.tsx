'use client';

import { useTranslation } from '@/lib/i18n';
import { modelMetricsMessages } from './model-metrics-messages';
import styles from './model-usage-sparkline.module.css';

/** Relative usage samples over the preceding 24 hours; live counts share this rendering contract. */
export type UsageSeries = {
  source: 'mock' | 'live';
  points: number[];
};

/** Stable per-model fixtures until sitewide usage aggregation is available. */
export function getMockModelUsage(modelId: string): UsageSeries {
  let seed = 2166136261;
  for (const char of modelId) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const phase = seed % 19;
  const points = Array.from({ length: 24 }, (_, index) => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const variation = (seed >>> 0) / 0xffffffff;
    return Number((45 + Math.sin((index + phase) / 4) * 20 + Math.sin(index / 1.9 + phase) * 9 + variation * 7).toFixed(2));
  });
  return { source: 'mock', points };
}

function usagePath(values: number[]) {
  if (!values.length) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const points = values.map((value, index) => ({
    x: Number((1 + index / Math.max(values.length - 1, 1) * 50).toFixed(2)),
    y: Number((range ? 17 - (value - min) / range * 14 : 10).toFixed(2)),
  }));
  if (points.length === 1) return `M1,10 L51,10`;
  return points.reduce((path, end, index) => {
    if (!index) return `M${end.x},${end.y}`;
    const start = points[index - 1];
    const before = points[Math.max(0, index - 2)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const a = { x: start.x + (end.x - before.x) / 6, y: start.y + (end.y - before.y) / 6 };
    const b = { x: end.x - (after.x - start.x) / 6, y: end.y - (after.y - start.y) / 6 };
    return `${path} C${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)} ${end.x},${end.y}`;
  }, '');
}

export function ModelUsageSparkline({ modelId, series }: { modelId: string; series?: UsageSeries }) {
  const { t } = useTranslation(modelMetricsMessages);
  const usage = series ?? getMockModelUsage(modelId);
  const description = t(usage.source === 'mock' ? 'usageMock' : 'usageLive');
  return <svg viewBox="0 0 52 20" className={styles.sparkline} role="img" aria-label={description} data-usage-source={usage.source}>
    <title>{description}</title>
    <path d={usagePath(usage.points)} />
  </svg>;
}
