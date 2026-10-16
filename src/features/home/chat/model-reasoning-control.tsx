'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Brain } from '@phosphor-icons/react';
import type { ModelCatalogEntry, ModelReasoningLevel } from '@fouc/shared/model-catalog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ChatText } from './chat-messages';
import { reasoningLabels } from './chat-reasoning';
import styles from './model-reasoning-control.module.css';

export function ModelReasoningControl({ reasoning, value, onChange, t }: {
  reasoning: NonNullable<ModelCatalogEntry['reasoning']>;
  value: ModelReasoningLevel | null;
  onChange: (value: ModelReasoningLevel) => void;
  t: ChatText;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const hintId = useId();
  const { levels, defaultLevel } = reasoning;
  const level = value && levels.includes(value) ? value : defaultLevel;
  const index = levels.indexOf(level);

  useEffect(() => {
    if (!open) return;
    // Radix first focuses the surface; move to the control once its focus scope has mounted.
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" className={styles.trigger} title={t('reasoningEffort')} aria-label={`${t('reasoningEffort')} · ${t(reasoningLabels[level])}`}>
        <Brain size={14} /><span>{t(reasoningLabels[level])}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className={styles.panel} side="top" align="start" sideOffset={8} collisionPadding={12}
      role="dialog" aria-labelledby={titleId}>
      <div className={styles.heading}><span id={titleId}>{t('reasoningEffort')}</span><strong aria-live="polite">{t(reasoningLabels[level])}</strong></div>
      <input ref={input} className={styles.slider} type="range" min={0} max={levels.length - 1} step={1} value={index}
        style={{ '--range-progress': `${index / (levels.length - 1) * 100}%` } as CSSProperties}
        aria-labelledby={titleId} aria-describedby={hintId} aria-valuetext={t(reasoningLabels[level])}
        onKeyDown={event => {
          if (event.key === 'Tab') setOpen(false);
          if (event.key !== 'Escape') event.stopPropagation();
        }}
        onChange={event => onChange(levels[Number(event.target.value)])} />
      <div className={styles.stops} aria-hidden="true">{levels.map((item, i) => <span key={item} data-active={i === index}>{t(reasoningLabels[item])}</span>)}</div>
      <p id={hintId} className={styles.hint}><span>{t('reasoningFaster')}</span><span>{t('reasoningDeeper')}</span></p>
    </DropdownMenuContent>
  </DropdownMenu>;
}
