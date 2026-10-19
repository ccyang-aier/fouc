'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import type { CreateTaskBoardViewInput, TaskBoardView, TaskViewKind } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { TaskDialog } from './task-board-dialogs';
import { taskViewIcons } from './task-board-view-switcher';
import { messages } from './task-views.messages';
import styles from './task-view-form.module.css';

export function TaskViewForm({ view, onSave, onClose }: {
  view?: TaskBoardView; onSave: (draft: CreateTaskBoardViewInput) => Promise<boolean>; onClose: () => void;
}) {
  const { t } = useTranslation(messages);
  const groupId = useId();
  const [kind, setKind] = useState<TaskViewKind>(view?.kind ?? 'kanban');
  const [name, setName] = useState(view?.name ?? t('kanban'));
  const baseline = useRef({ name: view?.name ?? t('kanban'), kind: view?.kind ?? 'kanban' });
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<'nameRequired' | 'saveFailed' | null>(null);
  const [discard, setDiscard] = useState(false);
  function close() {
    if (submitting.current) return;
    const dirty = name !== baseline.current.name || kind !== baseline.current.kind;
    if (discard) setDiscard(false);
    else if (dirty) setDiscard(true);
    else onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || discard) return;
    if (!name.trim()) { setError('nameRequired'); return; }
    submitting.current = true; setPending(true); setError(null);
    try { if (await onSave({ name: name.trim(), kind })) onClose(); else setError('saveFailed'); }
    catch { setError('saveFailed'); }
    finally { submitting.current = false; setPending(false); }
  }
  return <TaskDialog title={t(view ? 'renameView' : 'newView')} onClose={close} busy={pending}>
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.body}>
        <label className={styles.field}>{t('viewName')}<input data-autofocus value={name} onChange={event => setName(event.target.value)} maxLength={120} disabled={pending || discard} aria-invalid={error === 'nameRequired'} placeholder={t('viewNamePlaceholder')} /></label>
        {!view && <fieldset className={styles.kindOptions} disabled={pending || discard}><legend>{t('viewKind')}</legend><div>{(['kanban', 'calendar', 'spreadsheet'] as const).map(value => {
          const Icon = taskViewIcons[value];
          return <label key={value} className={styles.kindOption} data-selected={kind === value || undefined}>
            <input type="radio" name={groupId} checked={kind === value} onChange={() => { setKind(value); if (name === t(kind)) setName(t(value)); }} />
            <Icon size={20} /><strong>{t(value)}</strong><span>{t(value === 'kanban' ? 'kanbanHint' : value === 'calendar' ? 'calendarHint' : 'spreadsheetHint')}</span>
          </label>;
        })}</div></fieldset>}
        {error && <AppAlert tone="error" title={t(error)} />}
        {discard && <AppAlert tone="warning" title={t('discardTitle')} description={t('discardDescription')} />}
      </div>
      <footer className="workbench-dialog-footer">{discard ? <><Button type="button" variant="outline" size="sm" onClick={() => setDiscard(false)}>{t('keepEditing')}</Button><Button type="button" variant="outline" size="sm" data-variant="destructive" onClick={onClose}>{t('discard')}</Button></>
        : <><Button type="button" variant="outline" size="sm" disabled={pending} onClick={close}>{t('cancel')}</Button><Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>{t(view ? 'save' : 'create')}</Button></>}</footer>
    </form>
  </TaskDialog>;
}
