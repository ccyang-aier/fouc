'use client';

import { useTranslation } from '@/lib/i18n';
import { fixtureField, translateFixed } from '../i18n/display';
import { messages } from './i18n/dashboard-modal';

import { X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './dashboard-actions.module.css';
import { dashboardPeople, type DashboardPersonId } from './dashboard-model';
import { Avatar, IconButton } from './dashboard-ui';

export function DashboardModal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation(messages);

  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea')
      ?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-wide={wide || undefined}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className={styles.modalSurface}>
        <header className={styles.modalHeader}>
          <h2 id={titleId}>{title}</h2>
          <IconButton label={t('Close dialog')} onClick={onClose}>
            <X size={17} />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function DashboardMemberPicker({
  selected,
  onChange,
  ids = Object.values(dashboardPeople).map((person) => person.id),
  fixedIds = [],
}: {
  selected: DashboardPersonId[];
  onChange: (ids: DashboardPersonId[]) => void;
  ids?: DashboardPersonId[];
  fixedIds?: DashboardPersonId[];
}) {
  const { locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  return (
    <div className={styles.memberList}>
      {ids.map((id) => {
        const person = dashboardPeople[id];
        return (
          <label key={id} className={styles.memberRow}>
            <Avatar id={id} size={30} />
            <span>
              <strong>{fixtureField(person, 'name', locale)}</strong>
              <small>{uiLabel(person.role)}</small>
            </span>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              disabled={fixedIds.includes(id)}
              onChange={(event) =>
                onChange(
                  event.currentTarget.checked
                    ? [...selected, id]
                    : selected.filter((current) => current !== id),
                )
              }
            />
          </label>
        );
      })}
    </div>
  );
}
