'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LockSimple, UserPlus, UsersThree, X } from '@phosphor-icons/react';
import type { TaskBoardDetail, TaskBoardVisibility, TaskColumn, TaskColumnColor } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { usePageVisible } from '@/lib/page-visibility';
import type { BoardDraft, ColumnDraft } from './task-board-client';
import { messages } from './task-board-dialogs.messages';
import styles from './task-board-dialogs.module.css';

/** Native top-layer dialogs share focus containment and the workbench footer. */
export function TaskDialog({ title, description, children, onClose, busy = false, alert = false, wide = false }: {
  title: string; description?: string; children: ReactNode; onClose: () => void;
  busy?: boolean; alert?: boolean; wide?: boolean;
}) {
  const { t } = useTranslation(messages);
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = usePageVisible();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const node = dialog.current;
    if (!node || !visible) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    node.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    return () => {
      if (node.open) node.close();
      if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
    };
  }, [visible]);

  return <dialog
    ref={dialog}
    className={styles.dialog}
    data-wide={wide || undefined}
    role={alert ? 'alertdialog' : undefined}
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}
  >
    <header className={styles.header}>
      <div>
        <h2 id={titleId}>{title}</h2>
        {description ? <p id={descriptionId}>{description}</p> : null}
      </div>
      <Button type="button" variant="ghost" size="icon-sm" className={styles.close} aria-label={t('close')} onClick={onClose} disabled={busy}>
        <X size={16} />
      </Button>
    </header>
    {children}
  </dialog>;
}

function useDialogSubmit(onClose: () => void) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  async function submit(action: () => Promise<boolean>) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFailed(false);
    try {
      if (await action()) onClose();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return { pending, failed, submit };
}

const visibilityOptions = [
  { value: 'private', description: 'privateDescription', icon: LockSimple },
  { value: 'project', description: 'projectDescription', icon: UsersThree },
  { value: 'invited', description: 'invitedDescription', icon: UserPlus },
] as const;

export function TaskBoardForm({ board, onSubmit, onClose }: {
  board?: TaskBoardDetail; onSubmit: (draft: BoardDraft) => Promise<boolean>; onClose: () => void;
}) {
  const { t } = useTranslation(messages);
  const [name, setName] = useState(board?.name ?? '');
  const [description, setDescription] = useState(board?.description ?? '');
  const [visibility, setVisibility] = useState<TaskBoardVisibility>(board?.visibility ?? 'private');
  const mutation = useDialogSubmit(onClose);
  const fieldId = useId();

  return <TaskDialog title={t(board ? 'boardSettings' : 'newBoard')} onClose={onClose} busy={mutation.pending}>
    <form className={styles.form} onSubmit={event => {
      event.preventDefault();
      if (name.trim()) void mutation.submit(() => onSubmit({ name: name.trim(), description: description.trim(), visibility }));
    }}>
      <div className={styles.body}>
        <label className={styles.field} htmlFor={`${fieldId}-name`}>
          <span>{t('boardName')}</span>
          <input id={`${fieldId}-name`} data-autofocus autoFocus required maxLength={120} value={name} placeholder={t('boardNamePlaceholder')} onChange={event => setName(event.target.value)} disabled={mutation.pending} />
        </label>
        <label className={styles.field} htmlFor={`${fieldId}-description`}>
          <span>{t('description')} <small>{t('optional')}</small></span>
          <textarea id={`${fieldId}-description`} rows={3} maxLength={12000} value={description} placeholder={t('descriptionPlaceholder')} onChange={event => setDescription(event.target.value)} disabled={mutation.pending} />
        </label>
        <fieldset className={styles.scope} disabled={mutation.pending}>
          <legend>{t('visibility')}</legend>
          {visibilityOptions.map(option => <label key={option.value} className={`fouc-action ${styles.scopeChoice}`} data-selected={visibility === option.value}>
            <input type="radio" name={`${fieldId}-visibility`} value={option.value} checked={visibility === option.value} onChange={() => setVisibility(option.value)} />
            <option.icon size={20} aria-hidden />
            <span className={styles.scopeCopy}><strong>{t(option.value)}</strong><small>{t(option.description)}</small></span>
            <span className={styles.radio} aria-hidden />
          </label>)}
          {visibility !== 'private' ? <p className={styles.hint}>{t('editingAccess')}</p> : null}
        </fieldset>
        {mutation.failed ? <AppAlert tone="error" title={t('failed')} /> : null}
      </div>
      <footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.pending}>{t('cancel')}</Button>
        <Button type="submit" loading={mutation.pending} disabled={!name.trim()}>{t(board ? 'save' : 'createBoard')}</Button>
      </footer>
    </form>
  </TaskDialog>;
}

const columnColors: TaskColumnColor[] = ['slate', 'blue', 'amber', 'green', 'violet', 'rose'];

export function TaskColumnForm({ column, onSubmit, onClose }: {
  column?: TaskColumn; onSubmit: (draft: ColumnDraft) => Promise<boolean>; onClose: () => void;
}) {
  const { t } = useTranslation(messages);
  const [name, setName] = useState(column?.name ?? '');
  const [color, setColor] = useState<TaskColumnColor>(column?.color ?? 'slate');
  const [isDone, setIsDone] = useState(column?.isDone ?? false);
  const mutation = useDialogSubmit(onClose);
  const fieldId = useId();

  return <TaskDialog title={t(column ? 'editColumn' : 'newColumn')} onClose={onClose} busy={mutation.pending}>
    <form className={styles.form} onSubmit={event => {
      event.preventDefault();
      if (name.trim()) void mutation.submit(() => onSubmit({ name: name.trim(), color, isDone }));
    }}>
      <div className={styles.body}>
        <label className={styles.field} htmlFor={`${fieldId}-name`}>
          <span>{t('columnName')}</span>
          <input id={`${fieldId}-name`} data-autofocus autoFocus required maxLength={60} value={name} placeholder={t('columnNamePlaceholder')} onChange={event => setName(event.target.value)} disabled={mutation.pending} />
        </label>
        <fieldset className={styles.palette} disabled={mutation.pending}>
          <legend>{t('columnColor')}</legend>
          <div>{columnColors.map(value => <label key={value} className={`fouc-action ${styles.colorChoice}`} data-color={value} data-selected={color === value}>
            <input type="radio" name={`${fieldId}-color`} value={value} checked={color === value} onChange={() => setColor(value)} />
            <span aria-hidden />{t(value)}
          </label>)}</div>
        </fieldset>
        <label className={styles.completed}>
          <input type="checkbox" checked={isDone} onChange={event => setIsDone(event.target.checked)} disabled={mutation.pending} />
          <span><strong>{t('completed')}</strong><small>{t('completedDescription')}</small></span>
        </label>
        {mutation.failed ? <AppAlert tone="error" title={t('failed')} /> : null}
      </div>
      <footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.pending}>{t('cancel')}</Button>
        <Button type="submit" loading={mutation.pending} disabled={!name.trim()}>{t(column ? 'save' : 'addColumn')}</Button>
      </footer>
    </form>
  </TaskDialog>;
}

export function TaskConfirm({ title, description, onConfirm, onClose }: {
  title: string; description: string; onConfirm: () => Promise<boolean>; onClose: () => void;
}) {
  const { t } = useTranslation(messages);
  const mutation = useDialogSubmit(onClose);
  return <TaskDialog title={title} description={description} onClose={onClose} busy={mutation.pending} alert>
    {mutation.failed ? <div className={styles.confirmError}><AppAlert tone="error" title={t('failed')} /></div> : null}
    <footer>
      <Button type="button" variant="outline" data-autofocus autoFocus onClick={onClose} disabled={mutation.pending}>{t('cancel')}</Button>
      <Button type="button" variant="outline" className={styles.danger} data-variant="destructive" loading={mutation.pending} onClick={() => void mutation.submit(onConfirm)}>{t('delete')}</Button>
    </footer>
  </TaskDialog>;
}
