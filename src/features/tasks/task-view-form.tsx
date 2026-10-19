'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import type { CreateTaskBoardViewInput, TaskBoardView, TaskViewKind } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { AnchoredPopover } from '@/components/ui/anchored-popover';
import { taskViewIcons } from './task-board-view-switcher';
import { messages } from './task-views.messages';
import styles from './task-view-form.module.css';

export function TaskViewForm({ anchor, view, onSave, onClose }: {
  anchor: HTMLElement; view?: TaskBoardView; onSave: (draft: CreateTaskBoardViewInput) => Promise<boolean>; onClose: () => void;
}) {
  const { t } = useTranslation(messages);
  const groupId = useId();
  const [kind, setKind] = useState<TaskViewKind>(view?.kind ?? 'kanban');
  const [name, setName] = useState(view?.name ?? t('kanban'));
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<'nameRequired' | 'saveFailed' | null>(null);
  function close() { if (!submitting.current) onClose(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!name.trim()) { setError('nameRequired'); return; }
    submitting.current = true; setPending(true); setError(null);
    try { if (await onSave({ name: name.trim(), kind })) onClose(); else setError('saveFailed'); }
    catch { setError('saveFailed'); }
    finally { submitting.current = false; setPending(false); }
  }
  return <AnchoredPopover anchor={anchor} width={284} label={t(view ? 'renameView' : 'newView')} onClose={close} className={styles.popover}>
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.body}>
        <label className={styles.field}>{t('viewName')}<input data-autofocus value={name} onChange={event => setName(event.target.value)} maxLength={120} disabled={pending} aria-invalid={error === 'nameRequired'} placeholder={t('viewNamePlaceholder')} /></label>
        {!view && <fieldset className={styles.kindOptions} disabled={pending}><legend>{t('viewKind')}</legend><div>{(['kanban', 'calendar', 'spreadsheet'] as const).map(value => {
          const Icon = taskViewIcons[value];
          return <label key={value} className={styles.kindOption} data-selected={kind === value || undefined}>
            <input type="radio" name={groupId} checked={kind === value} onChange={() => { setKind(value); if (name === t(kind)) setName(t(value)); }} />
            <Icon size={17} /><strong>{t(value)}</strong>
          </label>;
        })}</div></fieldset>}
        {error && <AppAlert tone="error" title={t(error)} />}
      </div>
      <footer className={styles.footer}><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>{t('cancel')}</Button><Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>{t(view ? 'save' : 'create')}</Button></footer>
    </form>
  </AnchoredPopover>;
}
