'use client';

import { useId } from 'react';
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { useTranslation } from '@/lib/i18n';
import { modelMetricsMessages } from './model-metrics-messages';
import styles from './model-capability-chart.module.css';

const axes = ['intelligence', 'agentic', 'writing', 'design', 'speed', 'price'] as const;
const center = { x: 184, y: 113 };
const radius = 74;
const labels = [
  { x: 184, y: 23, anchor: 'middle' },
  { x: 269, y: 70, anchor: 'start' },
  { x: 269, y: 163, anchor: 'start' },
  { x: 184, y: 211, anchor: 'middle' },
  { x: 99, y: 163, anchor: 'end' },
  { x: 99, y: 70, anchor: 'end' },
] as const;

function point(index: number, scale: number) {
  const angle = -Math.PI / 2 + index * Math.PI / 3;
  return {
    x: Number((center.x + Math.cos(angle) * radius * scale).toFixed(2)),
    y: Number((center.y + Math.sin(angle) * radius * scale).toFixed(2)),
  };
}

function polygon(scale: number) {
  return axes.map((_, index) => {
    const { x, y } = point(index, scale);
    return `${x},${y}`;
  }).join(' ');
}

export function ModelCapabilityChart({ ratings }: { ratings: ModelCatalogEntry['ratings'] }) {
  const { t, locale } = useTranslation(modelMetricsMessages);
  const id = useId();
  const language = locale === 'zh-CN' ? 'zh' : 'en';
  const values = axes.map(axis => ratings[axis]);
  const complete = values.every(value => value !== null);
  const points = values.map((value, index) => value === null ? null : point(index, value.score / 100));
  const describe = (index: number) => {
    const value = values[index];
    if (!value) return t('dimensionUnsupported', { dimension: t(axes[index]) });
    if (value.kind === 'mock') return `${t('dimensionMock', { dimension: t(axes[index]), score: value.score })}. ${value.note[language]}`;
    return `${t('dimensionScore', { dimension: t(axes[index]), score: value.score })}. ${t('sourceAndMethod', {
      source: value.source.label, note: value.note[language],
    })}`;
  };

  return <figure className={styles.figure}>
    <svg viewBox="0 0 368 230" className={styles.chart} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{t('capabilityProfile')}</title>
      <desc id={`${id}-description`}>{[t('profileScale'), ...axes.map((_, index) => describe(index))].join(' ')}</desc>
      {[.25, .5, .75, 1].map(scale => <polygon key={scale} points={polygon(scale)} className={styles.grid} />)}
      {axes.map((axis, index) => {
        const end = point(index, 1);
        return <line key={axis} x1={center.x} y1={center.y} x2={end.x} y2={end.y} className={styles.grid} />;
      })}
      {complete ? <polygon points={points.map(value => `${value!.x},${value!.y}`).join(' ')} className={styles.result} /> : <g className={styles.partial}>
        {points.map((start, index) => {
          const end = points[(index + 1) % axes.length];
          return start && end ? <line key={axes[index]} x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null;
        })}
        {points.map((value, index) => value ? <circle key={axes[index]} cx={value.x} cy={value.y} r="2.4" /> : null)}
      </g>}
      {axes.map((axis, index) => <g key={axis}>
        <title>{describe(index)}</title>
        <text x={labels[index].x} y={labels[index].y} textAnchor={labels[index].anchor} className={styles.label}>
          {t(axis)}<tspan className={styles.score} dx="4">{values[index]?.score ?? '—'}</tspan>
        </text>
      </g>)}
    </svg>
  </figure>;
}
