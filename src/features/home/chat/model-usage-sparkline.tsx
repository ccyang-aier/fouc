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
  // Preserve the day's broad trend rather than drawing each noisy hourly sample.
  const count = Math.min(8, values.length);
  const samples = Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * values.length / count);
    const end = Math.floor((index + 1) * values.length / count);
    let total = 0;
    for (let sample = start; sample < end; sample++) total += values[sample];
    return total / (end - start);
  });
  const min = Math.min(...samples);
  const range = Math.max(...samples) - min;
  if (!range) return 'M1,10 L51,10';
  const points = samples.map((value, index) => ({
    x: 1 + index / (count - 1) * 50,
    y: 16 - (value - min) / range * 12,
  }));
  const first = points[0];
  const last = points[points.length - 1];
  const knots = [first, first, ...points, last, last];
  let path = `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
  // A uniform cubic B-spline keeps slope and curvature continuous at every join.
  for (let index = 0; index < knots.length - 3; index++) {
    const b = knots[index + 1];
    const c = knots[index + 2];
    const d = knots[index + 3];
    const control1 = { x: (2 * b.x + c.x) / 3, y: (2 * b.y + c.y) / 3 };
    const control2 = { x: (b.x + 2 * c.x) / 3, y: (b.y + 2 * c.y) / 3 };
    const end = { x: (b.x + 4 * c.x + d.x) / 6, y: (b.y + 4 * c.y + d.y) / 6 };
    path += ` C${control1.x.toFixed(2)},${control1.y.toFixed(2)} ${control2.x.toFixed(2)},${control2.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
  }
  return path;
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
