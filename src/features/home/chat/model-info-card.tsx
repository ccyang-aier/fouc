'use client';

import { ArrowSquareOut, Brain, CaretDown, Check, Eye, ImageSquare, Wrench, X } from '@phosphor-icons/react';
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { modelInfoMessages } from './model-info-messages';
import styles from './model-info-card.module.css';

export type ModelInfoSections = { benchmarks: boolean; capabilities: boolean; pricing: boolean };

export function formatModelTokens(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(2))}K`;
  return String(value);
}

function BenchmarkChart({ benchmarks }: { benchmarks: ModelCatalogEntry['benchmarks'] }) {
  const count = benchmarks.length;
  const point = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return [140 + Math.cos(angle) * radius, 105 + Math.sin(angle) * radius];
  };
  const polygon = (radius: number) => benchmarks.map((_, i) => point(i, radius).join(',')).join(' ');
  return <svg viewBox="0 0 280 210" className={styles.radar} aria-hidden="true">
    {[20, 40, 60, 80].map(radius => <polygon key={radius} points={polygon(radius)} className={styles.grid} />)}
    {benchmarks.map((_, index) => <line key={index} x1="140" y1="105" x2={point(index, 80)[0]} y2={point(index, 80)[1]} className={styles.grid} />)}
    <polygon points={benchmarks.map((benchmark, i) => point(i, benchmark.score * 0.8).join(',')).join(' ')} className={styles.result} />
    {benchmarks.map((benchmark, index) => {
      const [x, y] = point(index, 96);
      return <text key={benchmark.name} x={x} y={y + 4} textAnchor="middle" className={styles.chartLabel}>{index + 1}</text>;
    })}
  </svg>;
}

export function ModelInfoCard({ model, expanded, onToggle, onSelect, onClose }: {
  model: ModelCatalogEntry;
  expanded: ModelInfoSections;
  onToggle: (section: keyof ModelInfoSections) => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation(modelInfoMessages);
  const language = locale === 'zh-CN' ? 'zh' : 'en';
  const capabilities = [
    { key: 'vision', Icon: Eye }, { key: 'tools', Icon: Wrench },
    { key: 'reasoning', Icon: Brain }, { key: 'imageGeneration', Icon: ImageSquare },
  ] as const;
  const priceRows = [
    { key: 'input', label: 'input' }, { key: 'output', label: 'outputPrice' },
    { key: 'cacheRead', label: 'cacheRead' }, { key: 'cacheWrite', label: 'cacheWrite' },
  ] as const;
  const priceText = (value: number | null) => value === null ? t('unknown') : `$${value.toLocaleString(locale, { maximumFractionDigits: 4 })}`;
  const header = (section: keyof ModelInfoSections, summary?: React.ReactNode) => <button
    type="button" className={`fouc-action ${styles.sectionHeader}`} aria-label={t(section)} aria-expanded={expanded[section]}
    onClick={() => onToggle(section)}>
    <span>{t(section)}<CaretDown size={12} className={styles.caret} data-open={expanded[section]} /></span>
    {!expanded[section] ? summary : null}
  </button>;

  return <article className={styles.card} aria-label={`${model.name} · ${t('details')}`} onKeyDown={event => {
    // Buttons and links in the detail panel keep their normal keyboard semantics.
    if (event.key !== 'Escape') event.stopPropagation();
  }}>
    <div className={styles.body}>
      <header className={styles.intro}>
        <Button type="button" variant="ghost" size="icon-sm" className={styles.close} aria-label={t('backToModels')} onClick={onClose}><X size={14} /></Button>
        <h2>{model.name}</h2>
        <p>{model.summary[language]}</p>
      </header>
      <section className={styles.section}>
        {header('benchmarks', <span className={styles.compactValue}>{model.benchmarks.length || '—'}</span>)}
        {expanded.benchmarks ? <div className={styles.sectionContent}>
          {model.benchmarks.length ? <>
            {model.benchmarks.length >= 3 ? <BenchmarkChart benchmarks={model.benchmarks} /> : null}
            <ol className={styles.benchmarks}>
              {model.benchmarks.map((benchmark, index) => <li key={benchmark.name}>
                <a href={benchmark.sourceUrl} target="_blank" rel="noreferrer" className={`fouc-action ${styles.benchmarkLink}`} title={benchmark.note[language]}>
                  <span className={styles.metricNumber}>{index + 1}</span><span>{benchmark.name}</span>
                  <strong>{benchmark.score}%</strong><ArrowSquareOut size={12} />
                </a>
              </li>)}
            </ol>
            <p className={styles.note}>{t('benchmarkNote')}</p>
          </> : <p className={styles.empty}>{t('noBenchmarks')}</p>}
        </div> : null}
      </section>
      <dl className={styles.tokenRows}>
        <div><dt>{t('context')}</dt><dd>{model.contextWindow === null ? t('unknown') : `${formatModelTokens(model.contextWindow)} tokens`}</dd></div>
        <div><dt>{t('output')}</dt><dd>{model.maxOutput === null ? t('unknown') : `${formatModelTokens(model.maxOutput)} tokens`}</dd></div>
      </dl>
      <section className={styles.section}>
        {header('capabilities', <span className={styles.capabilityIcons}>
          {capabilities.filter(({ key }) => model.capabilities[key]).map(({ key, Icon }) => <span key={key} title={t(key)}><Icon size={14} /></span>)}
        </span>)}
        {expanded.capabilities ? <dl className={styles.rows}>
          {capabilities.map(({ key, Icon }) => {
            const supported = model.capabilities[key];
            return <div key={key}><dt><Icon size={15} />{t(key)}</dt><dd data-supported={supported}>
              {supported === null ? t('unknown') : <>{supported ? <Check size={13} /> : <X size={13} />}{t(supported ? 'supported' : 'unsupported')}</>}
            </dd></div>;
          })}
        </dl> : null}
      </section>
      <section className={styles.section}>
        {header('pricing', <span className={styles.compactValue} title={t('pricingUnit')} aria-label={t('pricingUnit')}>↑ {priceText(model.pricing.input)} <span>↓ {priceText(model.pricing.output)}</span></span>)}
        {expanded.pricing ? <div className={styles.sectionContent}>
          <p className={styles.unit}>{t('pricingUnit')}</p>
          <dl className={styles.rows}>{priceRows.map(({ key, label }) => <div key={key}><dt>{t(label)}</dt><dd>{priceText(model.pricing[key])}</dd></div>)}</dl>
          {model.pricing.note ? <p className={styles.note}>{model.pricing.note[language]}</p> : null}
        </div> : null}
      </section>
      <footer className={styles.sources}>
        <div><span>{t('sources')}</span><span>{t('verified', { date: model.verifiedAt })}</span></div>
        <div>{model.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowSquareOut size={11} /></a>)}</div>
      </footer>
    </div>
    <div className={styles.actions}><Button type="button" variant="outline" size="sm" onClick={onSelect}>{t('useModel')}</Button></div>
  </article>;
}
