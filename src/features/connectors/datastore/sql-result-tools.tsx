'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-result-tools.messages';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Toolbox } from '@phosphor-icons/react';
import styles from './query-result.module.css';
/** Native top-layer popover keeps grid commands mounted and escapes the result pane. */
export function SqlResultTools({
  onTarget,
  disabled,
  extraActions,
}: {
  onTarget: (target: HTMLDivElement | null) => void;
  disabled: boolean;
  extraActions?: ReactNode;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const id = useId(),
    panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState<CSSProperties>({});
  return (
    <>
      <button
        type="button"
        className="fouc-action"
        disabled={disabled}
        aria-label={tConnector('queryResultTools')}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        title={tConnector('copySelectionCellDetailsTranspose')}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(bounds.right - 220, window.innerWidth - 228)),
            top: Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - 248)),
          });
          panel.current?.togglePopover();
        }}
      >
        <Toolbox size={16} />
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={tConnector('queryResultTools')}
        className={styles.toolsPopover}
        style={position}
        onToggle={(event) => setOpen(event.newState === 'open')}
        onClick={(event) => {
          if ((event.target as Element).closest('button')) panel.current?.hidePopover();
        }}
      >
        <div ref={onTarget} className={styles.toolsSlot} />
        {extraActions}
        <p className={styles.toolsEmpty}>{tConnector('switchBackToTheDataTableToUseGridTools')}</p>
      </div>
    </>
  );
}
