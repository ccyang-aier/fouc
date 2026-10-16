'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { ButtonLoading } from '@/components/ui/button-loading';
import { useTranslation } from '@/lib/i18n/react';
import { CompanionCharacter } from './companion-character';
import { CompanionLayer } from './companion-layer';
import { createCompanionRuntime, initialCompanionState, type CompanionRuntime } from './companion-runtime';
import { companionActions, messages } from './companion.messages';
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
  const sceneRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => { if (open) closeRef.current?.focus({ preventScroll: true }); }, [open]);

  function collapse() {
    setOpen(false);
    sceneRef.current?.querySelector<HTMLElement>('[role="button"]')?.focus({ preventScroll: true });
  }

  return (
    <section
      ref={widgetRef}
      className={styles.widget}
      aria-label={`Feather · ${t('精灵')}`}
      data-companion
      data-open={open}
      {...drag}
      onKeyDown={event => {
        if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); collapse(); }
      }}
    >
      {open ? (
        <header className={styles.header} data-companion-drag title={t('拖动')}>
          <div className={styles.name}><GripVertical size={14} aria-hidden /><span>FEATHER</span></div>
          <span className={styles.state} data-companion-state>{state.label}</span>
          <button ref={closeRef} type="button" className={`fouc-action ${styles.close}`} aria-label={t('收起')} onClick={collapse}>
            <X size={15} aria-hidden />
          </button>
        </header>
      ) : null}
      <div className={styles.scene}>
        <CompanionCharacter sceneRef={sceneRef} open={open} panelId={panelId} onInteract={() => { setOpen(true); runtime.current?.interact(); }} />
      </div>
      {open ? (
        <div className={styles.controls} id={panelId}>
          <div className={styles.stats}>
            <div className={styles.meterLabel}><span>{t('心情')}</span><span>{Math.round(state.mood)}</span></div>
            <div className={styles.meter} role="meter" aria-label={t('心情')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.mood}><div style={{ width: state.mood + '%' }} /></div>
            <div className={styles.meterLabel}><span>{t('饱腹')}</span><span>{Math.round(state.full)}</span></div>
            <div className={styles.meter} role="meter" aria-label={t('饱腹')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.full}><div style={{ width: state.full + '%' }} /></div>
          </div>
          <button
            type="button"
            className={styles.feed}
            disabled={state.busy}
            aria-busy={state.busy && state.label === 'CANDY!'}
            onClick={() => { void runtime.current?.feed(); }}
          >
            <span style={{ visibility: state.busy && state.label === 'CANDY!' ? 'hidden' : undefined }}>{t('喂糖')}</span>
            {state.busy && state.label === 'CANDY!' ? <span className={styles.loading}><ButtonLoading /></span> : null}
          </button>
          <div className={styles.chips}>
            {companionActions.map(([label, action, key]) => (
              <button key={action} type="button" className={styles.chip} disabled={state.busy} aria-label={t(key)} title={t(key)} onClick={() => runtime.current?.act(action)}>{label}</button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
