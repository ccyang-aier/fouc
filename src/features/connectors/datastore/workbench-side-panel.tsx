'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './workbench-side-panel.messages';
import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { PushPin, X } from '@phosphor-icons/react';
import styles from './workbench-side-panel.module.css';
export function WorkbenchSidePanel({
  label,
  title,
  icon,
  pinned,
  onPin,
  onClose,
  actions,
  children,
  wide = false,
}: {
  label: string;
  title: string;
  icon?: ReactNode;
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const root = useRef<HTMLElement>(null),
    close = useEffectEvent(onClose);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        !pinned &&
        !root.current?.contains(target) &&
        !target.closest('dialog, [data-workbench-panel-trigger], [data-table-query-menu]')
      )
        close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [pinned]);
  function dismiss() {
    const trigger = document.querySelector<HTMLElement>(
      'button[data-workbench-panel-trigger][aria-expanded="true"][title="' + label + '"]',
    );
    onClose();
    trigger?.focus({ preventScroll: true });
  }
  return (
    <aside
      ref={root}
      className={styles.panel}
      data-wide={wide || undefined}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      <header className={styles.header}>
        {icon}
        <strong title={title}>{title}</strong>
        <div>
          {actions}
          <button
            type="button"
            className="fouc-action"
            aria-label={
              pinned
                ? tConnector('unpin', { p0: String(label) })
                : tConnector('pin', { p0: String(label) })
            }
            aria-pressed={pinned}
            onClick={onPin}
          >
            <PushPin size={16} weight={pinned ? 'fill' : 'regular'} />
          </button>
          <button
            type="button"
            className="fouc-action"
            aria-label={tConnector('close', { p0: String(label) })}
            onClick={dismiss}
          >
            <X size={16} />
          </button>
        </div>
      </header>
      {children}
    </aside>
  );
}
