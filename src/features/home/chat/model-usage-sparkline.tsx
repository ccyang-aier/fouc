'use client';

import { useId } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { modelMetricsMessages } from './model-metrics-messages';
import { getMockModelUsage, type UsageSeries } from './model-usage-data';
import styles from './model-usage-sparkline.module.css';

function usagePath(values: number[]) {
  if (!values.length) return 'M1,10 L51,10';
  // Preserve the week's broad trend rather than drawing each noisy usage bucket.
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

export function ModelUsageSparkline({ modelId, series, descriptionId }: { modelId: string; series?: UsageSeries; descriptionId?: string }) {
  const { t, locale } = useTranslation(modelMetricsMessages);
  const id = useId();
  const usage = series ?? getMockModelUsage(modelId);
  const period = t(usage.source === 'mock' ? 'usageMock' : 'usageLive');
  const calls = usage.calls.toLocaleString(locale);
  const tokens = usage.totalTokens.toLocaleString(locale);
  const description = `${period}. ${t('usageCalls')}: ${calls}. ${t('usageTokens')}: ${tokens}.`;
  return <Tooltip delayDuration={260}>
    <TooltipTrigger asChild>
      <span className={styles.sparkline} role="img" aria-label={description} data-usage-source={usage.source}
        onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <svg viewBox="0 0 52 20" aria-hidden="true"><title>{period}</title><path d={usagePath(usage.points)} /></svg>
        <span id={descriptionId ?? id} className="sr-only">{description}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent className={styles.tooltip} side="top" sideOffset={8} collisionPadding={12}>
      <dl>
        <div><dt>{t('usageCalls')}</dt><dd>{calls}</dd></div>
        <div><dt>{t('usageTokens')}</dt><dd>{tokens}</dd></div>
      </dl>
    </TooltipContent>
  </Tooltip>;
}
