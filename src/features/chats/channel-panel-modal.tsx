'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { usePageVisible } from '@/lib/page-visibility';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { panelMessages } from './channel-panels.messages';
import styles from './channel-panels.module.css';

export function ChannelPanelModal({ title, children, onClose, busy = false, alert = false, className, headerIcon, metadata }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean; alert?: boolean; className?: string;
  headerIcon?: ReactNode; metadata?: ReactNode;
}) {
  const { t } = useTranslation(panelMessages);
  const ref = useRef<HTMLDialogElement>(null);
  const visible = usePageVisible();
  const id = useId();
  useEffect(() => {
    const node = ref.current;
    if (!node || !visible) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    node.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    return () => {
      node.close();
      if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
    };
  }, [visible]);
  return <dialog ref={ref} className={cn(styles.dialog, className)} aria-labelledby={id} role={alert ? 'alertdialog' : undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.currentTarget.querySelector('[role="menu"][data-state="open"]')) return;
      event.preventDefault(); event.stopPropagation(); if (!busy) onClose();
    }}
    onClick={event => {
      if (busy || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className={styles.dialogHeader}>{headerIcon}{metadata ? <div><h2 id={id}>{title}</h2>{metadata}</div> : <h2 id={id}>{title}</h2>}<Button type="button" variant="ghost" size="icon-sm" data-surface="plain" disabled={busy} aria-label={t('close')} onClick={onClose}><X size={17} /></Button></header>
    {children}
  </dialog>;
}
