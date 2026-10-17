'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Brain } from '@phosphor-icons/react';
import type { ModelCatalogEntry, ModelReasoningLevel } from '@fouc/shared/model-catalog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StarfieldSlider } from '@/components/ui/starfield-slider';
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
      <Button type="button" variant="outline" className={styles.trigger} title={t('reasoningEffort')} aria-label={`${t('reasoningEffort')} · ${t(reasoningLabels[level])}`}>
        <Brain size={14} /><span>{t(reasoningLabels[level])}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className={styles.panel} side="top" align="start" sideOffset={8} collisionPadding={12}
      role="dialog" aria-labelledby={titleId}>
      <StarfieldSlider ref={input} max={levels.length - 1} value={index} titleId={titleId}
        heading={t('reasoningEffort')} label={t(reasoningLabels[level])}
        startLabel={t('reasoningFaster')} endLabel={t('reasoningSmarter')}
        aria-label={t('reasoningEffort')} aria-valuetext={t(reasoningLabels[level])}
        onKeyDown={event => {
          if (event.key === 'Tab') setOpen(false);
          if (event.key !== 'Escape') event.stopPropagation();
        }}
        onValueChange={value => onChange(levels[value])} />
    </DropdownMenuContent>
  </DropdownMenu>;
}
