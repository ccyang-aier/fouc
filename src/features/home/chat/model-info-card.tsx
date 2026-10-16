'use client';

import type { ReactNode } from 'react';
import { CaretDown, X } from '@phosphor-icons/react';
import { ArrowDownToDot, ArrowUpFromDot, Atom, CircleFadingArrowUp, Eye, Image as ImageIcon, Video, Wrench } from 'lucide-react';
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/lib/i18n';
import { modelInfoMessages } from './model-info-messages';
import { ModelCapabilityChart } from './model-capability-chart';
import styles from './model-info-card.module.css';

export type ModelInfoSections = { ratings: boolean; capabilities: boolean; pricing: boolean };

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
    { key: 'vision', Icon: Eye, yes: 'visionSupported', no: 'visionUnsupported' },
    { key: 'tools', Icon: Wrench, yes: 'toolsSupported', no: 'toolsUnsupported' },
    { key: 'reasoning', Icon: Atom, yes: 'reasoningSupported', no: 'reasoningUnsupported' },
    { key: 'imageGeneration', Icon: ImageIcon, yes: 'imageSupported', no: 'imageUnsupported' },
    { key: 'videoGeneration', Icon: Video, yes: 'videoSupported', no: 'videoUnsupported' },
  ] as const;
  const priceRows = [
    { key: 'input', label: 'input', Icon: ArrowUpFromDot }, { key: 'output', label: 'outputPrice', Icon: ArrowDownToDot },
    { key: 'cacheRead', label: 'cacheRead', Icon: CircleFadingArrowUp }, { key: 'cacheWrite', label: 'cacheWrite', Icon: CircleFadingArrowUp },
  ] as const;
  const priceNumber = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 4 });
  const priceText = (value: number | null) => value === null ? t('unknown') : `$${priceNumber(value)}`;
  const header = (section: keyof ModelInfoSections, summary?: ReactNode) => <button
    type="button" className={`fouc-action ${styles.sectionHeader}`} data-variant="collapsible" data-section={section} aria-label={t(section)} aria-expanded={expanded[section]}
    onClick={() => onToggle(section)}>
    <span>{t(section)}<CaretDown size={10} weight="fill" className={styles.caret} data-open={expanded[section]} /></span>
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
        {header('ratings')}
        {expanded.ratings ? <div className={styles.sectionContent}>
          <ModelCapabilityChart ratings={model.ratings} />
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
          {capabilities.map(({ key, Icon, yes, no }) => {
            const supported = model.capabilities[key];
            return <div key={key}><dt><Icon size={14} /><span>{t(key)}</span></dt><dd>
              {supported === null ? t('unknown') : t(supported ? yes : no)}
            </dd></div>;
          })}
        </dl> : null}
      </section>
      <section className={styles.section}>
        {header('pricing', <span className={styles.compactPrice} title={t('pricingUnit')}>
          {model.pricing.cacheRead !== null ? <span title={t('cacheRead')} data-price="cacheRead"><CircleFadingArrowUp size={15} /><strong>{priceText(model.pricing.cacheRead)}</strong></span> : null}
          <span title={t('input')}><ArrowUpFromDot size={15} /><strong>{priceText(model.pricing.input)}</strong></span>
          <span title={t('outputPrice')}><ArrowDownToDot size={15} /><strong>{priceText(model.pricing.output)}</strong></span>
        </span>)}
        {expanded.pricing ? <div className={styles.sectionContent}>
          <dl className={styles.rows}>{priceRows.map(({ key, label, Icon }) => <div key={key}>
            <dt><Icon size={14} className={key === 'input' || key === 'output' ? styles.priceArrow : undefined} /><span>{t(label)}</span></dt>
            <dd>{model.pricing[key] === null ? t('unknown') : t('priceAmount', { value: priceNumber(model.pricing[key]) })}
            </dd>
          </div>)}</dl>
        </div> : null}
      </section>
    </div>
    </ScrollArea>
    <div className={styles.actions}><Button type="button" variant="outline" size="sm" onClick={onSelect}>{t('useModel')}</Button></div>
  </article>;
}
