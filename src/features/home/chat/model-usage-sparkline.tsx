'use client';

import { useId } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { modelMetricsMessages } from './model-metrics-messages';
import { getMockModelUsage, type UsageSeries } from './model-usage-data';
import { createUsagePaths } from './model-usage-path';
import styles from './model-usage-sparkline.module.css';

export function ModelUsageSparkline({ modelId, series, descriptionId }: { modelId: string; series?: UsageSeries; descriptionId?: string }) {
  const { t, locale } = useTranslation(modelMetricsMessages);
  const id = useId();
  const usage = series ?? getMockModelUsage(modelId);
  const paths = createUsagePaths(usage.points);
  const gradientId = `usage-fill-${id}`;
  const period = t(usage.source === 'mock' ? 'usageMock' : 'usageLive');
  const calls = usage.calls.toLocaleString(locale);
  const tokens = usage.totalTokens.toLocaleString(locale);
  const description = `${period}. ${t('usageCalls')}: ${calls}. ${t('usageTokens')}: ${tokens}.`;
  return <Tooltip delayDuration={260}>
    <TooltipTrigger asChild>
      <span className={styles.sparkline} role="img" aria-label={description} data-usage-source={usage.source}
        onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <svg viewBox="0 0 52 20" aria-hidden="true">
          <title>{period}</title>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop className={styles.fillTop} offset="0%" />
            <stop className={styles.fillBottom} offset="100%" />
          </linearGradient></defs>
          {paths.area && <path d={paths.area} fill={`url(#${gradientId})`} />}
          <path className={styles.line} d={paths.line} />
        </svg>
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
