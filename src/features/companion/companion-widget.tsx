'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Candy, Hand, Moon, X } from 'lucide-react';
import { ButtonLoading } from '@/components/ui/button-loading';
import { useTranslation } from '@/lib/i18n/react';
import { CompanionCharacter } from './companion-character';
import { CompanionActionMenu } from './companion-action-menu';
import { CompanionLayer } from './companion-layer';
import { createCompanionRuntime, initialCompanionState, type CompanionRuntime } from './companion-runtime';
import { messages } from './companion.messages';
import { OPEN_COMPANION_EVENT } from './companion-events';
import { useCompanionDrag } from './use-companion-drag';
import styles from './companion-widget.module.css';

export function CompanionWidget() {
  return <CompanionLayer><Companion /></CompanionLayer>;
}

function Companion() {
  const { t } = useTranslation(messages);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initialCompanionState);
  const widgetRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<CompanionRuntime | null>(null);
  const panelId = useId();
  const drag = useCompanionDrag(widgetRef);

  useEffect(() => {
    const controller = createCompanionRuntime(sceneRef.current!, setState);
    runtime.current = controller;
    const summon = () => { setOpen(true); controller.wake(); };
    window.addEventListener(OPEN_COMPANION_EVENT, summon);
    return () => { controller.dispose(); runtime.current = null; window.removeEventListener(OPEN_COMPANION_EVENT, summon); };
  }, []);

  useEffect(() => {
    if (open) widgetRef.current?.querySelector<HTMLButtonElement>('[role="toolbar"] button:not(:disabled)')?.focus({ preventScroll: true });
  }, [open]);

  function collapse() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function interact() { setOpen(current => !current); runtime.current?.interact(); }

  return (
    <section
      ref={widgetRef}
      className={styles.widget}
      aria-label={`Feather · ${t('精灵')}`}
      data-companion
      data-open={open}
      data-companion-state={state.label}
      {...drag}
      onKeyDown={event => {
        if (open && event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); collapse(); }
      }}
    >
      {open ? (
        <div className={styles.rail} id={panelId} role="toolbar" aria-label={t('工具栏')} aria-orientation="vertical">
          <button
            type="button"
            className={`fouc-action ${styles.tool}`}
            disabled={state.busy}
            aria-busy={state.busy && state.label === 'CANDY!'}
            aria-label={t('喂糖')}
            title={t('喂糖')}
            onClick={() => { void runtime.current?.feed(); }}
          >
            {state.busy && state.label === 'CANDY!' ? <ButtonLoading /> : <Candy size={20} strokeWidth={1.65} aria-hidden />}
          </button>
          <span className={styles.divider} role="separator" />
          <button type="button" className={`fouc-action ${styles.tool}`} disabled={state.busy} aria-label={t('抚摸')} title={t('抚摸')} onClick={() => runtime.current?.act('happy')}>
            <Hand size={20} strokeWidth={1.65} aria-hidden />
          </button>
          <CompanionActionMenu group="expression" busy={state.busy} onAction={action => runtime.current?.act(action)} />
          <CompanionActionMenu group="motion" busy={state.busy} onAction={action => runtime.current?.act(action)} />
          <button type="button" className={`fouc-action ${styles.tool}`} disabled={state.busy} aria-label={t('睡眠')} title={t('睡眠')} onClick={() => runtime.current?.act('sleep')}>
            <Moon size={20} strokeWidth={1.65} aria-hidden />
          </button>
        </div>
      ) : null}
      <div
        ref={triggerRef}
        className={styles.trigger}
        role="button"
        tabIndex={0}
        data-companion-drag
        aria-label={t('互动')}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={`Feather · ${t('拖动')}\n${t('心情')} ${Math.round(state.mood)} · ${t('饱腹')} ${Math.round(state.full)}`}
        onClick={interact}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); interact(); }
        }}
      >
        <div className={styles.scene}>
          <CompanionCharacter sceneRef={sceneRef} />
        </div>
      </div>
      {open ? (
        <button type="button" className={`fouc-action ${styles.close}`} aria-label={t('收起')} title={t('收起')} onClick={collapse}><X size={12} aria-hidden /></button>
      ) : null}
    </section>
  );
}
