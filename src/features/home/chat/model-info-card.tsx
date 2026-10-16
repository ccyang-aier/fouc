'use client';

import type { ReactNode } from 'react';
import { ArrowSquareOut, Brain, CaretDown, Check, DownloadSimple, Eye, ImageSquare, SignIn, SignOut, UploadSimple, Wrench, X } from '@phosphor-icons/react';
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/lib/i18n';
import { modelInfoMessages } from './model-info-messages';
import { ModelBenchmarkChart } from './model-benchmark-chart';
import styles from './model-info-card.module.css';

export type ModelInfoSections = { benchmarks: boolean; capabilities: boolean; pricing: boolean };

export function formatModelTokens(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(2))}K`;
  return String(value);
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
    { key: 'input', label: 'input', Icon: SignIn }, { key: 'output', label: 'outputPrice', Icon: SignOut },
    { key: 'cacheRead', label: 'cacheRead', Icon: DownloadSimple }, { key: 'cacheWrite', label: 'cacheWrite', Icon: UploadSimple },
  ] as const;
  const priceNumber = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 4 });
  const priceText = (value: number | null) => value === null ? t('unknown') : `$${priceNumber(value)}`;
  const header = (section: keyof ModelInfoSections, summary?: ReactNode) => <button
    type="button" className={`fouc-action ${styles.sectionHeader}`} data-variant="collapsible" data-section={section} aria-label={t(section)} aria-expanded={expanded[section]}
    title={section === 'benchmarks' ? t('benchmarkNote') : undefined}
    onClick={() => onToggle(section)}>
    <span>{t(section)}<CaretDown size={12} className={styles.caret} data-open={expanded[section]} /></span>
    {!expanded[section] ? summary : null}
  </button>;

  return <article className={styles.card} aria-label={`${model.name} · ${t('details')}`} onKeyDown={event => {
    // Buttons and links in the detail panel keep their normal keyboard semantics.
    if (event.key !== 'Escape') event.stopPropagation();
  }}>
    <ScrollArea className={styles.scrollArea} viewportClassName={styles.viewport}>
    <div className={styles.body}>
      <header className={styles.intro}>
        <Button type="button" variant="ghost" size="icon-sm" className={styles.close} aria-label={t('backToModels')} onClick={onClose}><X size={14} /></Button>
        <h2 className="sr-only">{model.name}</h2>
        <p>{model.summary[language]}</p>
      </header>
      <section className={styles.section}>
        {header('benchmarks')}
        {expanded.benchmarks ? <div className={styles.sectionContent}>
          {model.benchmarks.length ? <>
            {model.benchmarks.length >= 3 ? <ModelBenchmarkChart benchmarks={model.benchmarks} /> : <ul className={styles.benchmarks}>
              {model.benchmarks.map(benchmark => <li key={benchmark.name}>
                <a href={benchmark.sourceUrl} target="_blank" rel="noreferrer" className={`fouc-action ${styles.benchmarkLink}`} title={benchmark.note[language]}>
                  <span>{benchmark.name}</span>
                  <strong>{benchmark.score}%</strong><ArrowSquareOut size={12} />
                </a>
              </li>)}
            </ul>}
          </> : <p className={styles.empty}>{t('noBenchmarks')}</p>}
        </div> : null}
      </section>
      <dl className={styles.tokenRows}>
        <div><dt data-section="context">{t('context')}</dt><dd>
          <strong title={`${t('output')}: ${model.maxOutput === null ? t('unknown') : `${formatModelTokens(model.maxOutput)} tokens`}`}>
            {model.contextWindow === null ? t('unknown') : `${formatModelTokens(model.contextWindow)} tokens`}
          </strong>
          <span className="sr-only">{t('output')} · {model.maxOutput === null ? t('unknown') : formatModelTokens(model.maxOutput)}</span>
        </dd></div>
      </dl>
      <section className={styles.section}>
        {header('capabilities', <span className={styles.capabilityIcons}>
          {capabilities.filter(({ key }) => model.capabilities[key]).map(({ key, Icon }) => <span key={key} data-capability={key} title={t(key)}><Icon size={14} /></span>)}
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
        {header('pricing', <span className={styles.compactPrice} title={t('pricingUnit')}>
          {priceRows.filter(({ key }) => key !== 'cacheWrite' && (key !== 'cacheRead' || model.pricing.cacheRead !== null)).map(({ key, label, Icon }) =>
            <span key={key} data-price={key} title={`${t(label)} · ${t('pricingUnit')}`}><Icon size={13} /><strong>{priceText(model.pricing[key])}</strong></span>)}
        </span>)}
        {expanded.pricing ? <div className={styles.sectionContent}>
          <p className={styles.unit}>{t('pricingUnit')}</p>
          <dl className={styles.priceRows}>{priceRows.map(({ key, label, Icon }) => <div key={key} data-price={key}>
            <dt><span className={styles.priceIcon}><Icon size={15} /></span>{t(label)}</dt>
            <dd data-published={model.pricing[key] !== null}>{model.pricing[key] === null ? t('unknown') :
              <span className={styles.priceAmount}><span className={styles.currency}>$</span><strong>{priceNumber(model.pricing[key])}</strong></span>}
            </dd>
          </div>)}</dl>
          {model.pricing.note ? <p className={styles.note}>{model.pricing.note[language]}</p> : null}
        </div> : null}
      </section>
    </div>
    </ScrollArea>
    <div className={styles.actions}><Button type="button" variant="outline" size="sm" onClick={onSelect}>{t('useModel')}</Button></div>
  </article>;
}
