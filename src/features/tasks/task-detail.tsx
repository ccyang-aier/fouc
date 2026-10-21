'use client';

import { taskScheduleSchema, type BoardTask, type TaskBoardDetail } from '@fouc/shared/tasks';
import { CalendarBlank, CaretDown, CheckSquare, Circle, Flag, LockSimple, Plus, Tag, TextAlignLeft, Trash, Users, Warning, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AppAlert } from '@/components/app-alert';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSearch, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import { usePageVisible } from '@/lib/page-visibility';
import type { TaskBoardClient, TaskDraft } from './task-board-client';
import { taskReference } from './task-board-model';
import { TaskDetailChecklist } from './task-detail-checklist';
import { TaskComments } from './task-comments';
import { TaskLabelsEditor, collectTaskLabels } from './task-labels';
import { TaskPriorityIcon } from './task-priority-icon';
import { TaskSelect } from './task-select';
import { TaskStatusIcon } from './task-status-icon';
import { TaskDateInput } from './task-date-input';
import { TaskScheduleSection } from './calendar/task-schedule-section';
import { messages } from './task-detail.messages';
import { useTaskDetailDrag } from './use-task-detail-drag';
import styles from './task-detail.module.css';

export type TaskDetailProps = {
  board: TaskBoardDetail;
  task: BoardTask | null;
  columnId: string;
  actorId: string;
  onClose: () => void;
  onSave: (draft: TaskDraft, taskId?: string) => Promise<boolean>;
  onDelete: (taskId: string) => Promise<boolean>;
  client: TaskBoardClient;
  onCommentsChanged: () => void;
};

function initialDraft(task: BoardTask | null, columnId: string): TaskDraft {
  return {
    columnId: task?.columnId ?? columnId,
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'medium',
    assigneeIds: task ? [...task.assigneeIds] : [],
    labels: task ? [...task.labels] : [],
    dueDate: task?.dueDate ?? null,
    schedule: task?.schedule ?? null,
    checklist: task ? task.checklist.map((item) => ({ ...item })) : [],
  };
}

export function TaskDetail({ board, task, columnId, actorId, onClose, onSave, onDelete, client, onCommentsChanged }: TaskDetailProps) {
  const { t } = useTranslation(messages);
  const visible = usePageVisible();
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const titleInput = useRef<HTMLTextAreaElement>(null);
  const statusInput = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState(() => initialDraft(task, columnId));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialDraft(task, columnId)));
  const [memberQuery, setMemberQuery] = useState('');
  const [activePane, setActivePane] = useState<'details' | 'comments'>('details');
  const [commentDirty, setCommentDirty] = useState(false);
  const commentDirtyRef = useRef(false);
  const changeCommentDirty = useCallback((value: boolean) => { commentDirtyRef.current = value; setCommentDirty(value); }, []);
  const [confirmation, setConfirmation] = useState<'discard' | 'delete' | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<'saveFailed' | 'deleteFailed' | null>(null);
  const [fieldError, setFieldError] = useState<'titleRequired' | 'statusRequired' | 'labelsLimit' | 'checklistTitleRequired' | 'scheduleInvalid' | null>(null);
  const canEdit = board.permission === 'owner' || board.permission === 'editor';
  const dirty = JSON.stringify(draft) !== baseline || commentDirty;
  const currentColumn = board.columns.find((column) => column.id === draft.columnId);
  const selectedMembers = board.members.filter((member) => draft.assigneeIds.includes(member.userId));
  const matchingMembers = board.members.filter((member) => `${member.name} ${member.email}`.toLocaleLowerCase().includes(memberQuery.trim().toLocaleLowerCase()));
  const drag = useTaskDetailDrag(dialog, visible && !confirmation);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    titleInput.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (previousFocus?.isConnected && document.activeElement === document.body) previousFocus.focus({ preventScroll: true });
    };
  }, [visible]);

  useLayoutEffect(() => {
    const input = titleInput.current;
    if (!input || !visible) return;
    const fitTitle = () => {
      input.style.height = '0px';
      input.style.height = `${input.scrollHeight + 2}px`;
    };
    fitTitle();
    window.addEventListener('resize', fitTitle);
    return () => window.removeEventListener('resize', fitTitle);
  }, [draft.title, visible]);

  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldError(null);
  }

  function requestClose() {
    if (busy) return;
    if (dirty && canEdit) setConfirmation('discard');
    else onClose();
  }

  async function save() {
    if (busy || !canEdit) return;
    const next: TaskDraft = {
      ...draft,
      title: draft.title.trim(),
      labels: draft.labels.map(label => ({ ...label, name: label.name.trim() })),
      assigneeIds: draft.assigneeIds.filter((id) => board.members.some((member) => member.userId === id)),
      checklist: draft.checklist.map((item) => ({ ...item, title: item.title.trim() })),
    };
    if (!next.title) {
      setFieldError('titleRequired');
      titleInput.current?.focus();
      return;
    }
    if (!currentColumn) {
      setFieldError('statusRequired');
      statusInput.current?.focus();
      return;
    }
    if (next.labels.length > 20 || next.labels.some(label => !label.name || label.name.length > 40)) {
      setFieldError('labelsLimit');
      return;
    }
    if (next.checklist.some((item) => !item.title)) {
      setFieldError('checklistTitleRequired');
      return;
    }
    if (next.schedule && !taskScheduleSchema.safeParse(next.schedule).success) {
      setFieldError('scheduleInvalid');
      return;
    }
    setError(null);
    setFieldError(null);
    setBusy('save');
    try {
      const saved = await onSave(next, task?.id);
      if (!active.current) return;
      if (saved) {
        if (commentDirtyRef.current) {
          setDraft(next);
          setBaseline(JSON.stringify(next));
        } else onClose();
      } else setError('saveFailed');
    } catch {
      if (active.current) setError('saveFailed');
    } finally {
      if (active.current) setBusy(null);
    }
  }

  async function remove() {
    if (!task || busy) return;
    setBusy('delete');
    setError(null);
    try {
      const removed = await onDelete(task.id);
      if (!active.current) return;
      if (removed) onClose();
      else setError('deleteFailed');
    } catch {
      if (active.current) setError('deleteFailed');
    } finally {
      if (active.current) {
        setBusy(null);
        setConfirmation(null);
      }
    }
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} data-dragging={drag.dragging || undefined} {...drag.dialogProps}
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onKeyDown={(event) => {
        if (!confirmation && event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !(event.target instanceof Element && event.target.closest('[data-task-comments]'))) {
          event.preventDefault();
          void save();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
      }}>
      <h2 id={titleId} className={styles.srOnly}>{t(task ? 'taskDetails' : 'newTask')}</h2>
      <div className={styles.surface}>
        <div className={styles.titleArea} {...drag.handleProps}>
          <span className={styles.reference} role="button" tabIndex={0} aria-label={t('moveDetails')} aria-describedby={`${titleId}-move-hint`}
            onKeyDown={drag.onKeyDown}>{task ? taskReference(task) : t('newTask')}</span>
          <span id={`${titleId}-move-hint`} className={styles.srOnly}>{t('moveDetailsHint')}</span>
          <Button type="button" variant="ghost" size="icon-sm" className={styles.iconButton} aria-label={t('close')} onClick={requestClose} disabled={Boolean(busy)}><X size={16} /></Button>
          {canEdit ? <textarea ref={titleInput} className={styles.titleInput} aria-label={t('title')} placeholder={t('titlePlaceholder')}
            rows={1} maxLength={240} value={draft.title} disabled={Boolean(busy)} aria-invalid={fieldError === 'titleRequired'}
            onChange={(event) => update('title', event.target.value.replace(/\n/g, ' '))} /> : <h3 className={styles.title}>{draft.title}</h3>}
        </div>
        <div className={styles.paneSwitch} role="group" aria-label={t('detailsPane')}>
          <button type="button" className="fouc-action" data-surface="plain" data-detail-pane="details" aria-pressed={activePane === 'details'} onClick={() => setActivePane('details')}>{t('detailsPane')}</button>
          <button type="button" className="fouc-action" data-surface="plain" data-detail-pane="comments" aria-pressed={activePane === 'comments'} onClick={() => setActivePane('comments')}>{t('comments')}</button>
        </div>
        <div className={styles.body}>
          <section className={styles.mainPanel} aria-label={t('detailsPane')} hidden={activePane !== 'details'} data-task-detail-main>
            {!canEdit && <div className={styles.readonly}><LockSimple size={13} />{t('readonly')}</div>}
            <fieldset className={styles.fields} disabled={!canEdit || Boolean(busy)}>
              <div className={styles.fieldRow}>
                <label htmlFor={`${titleId}-status`}><Circle size={14} />{t('status')}</label>
                <TaskSelect triggerRef={statusInput} id={`${titleId}-status`} ariaLabel={t('status')} value={currentColumn ? draft.columnId : ''}
                  className={styles.propertyControl} surface="muted" disabled={!canEdit || Boolean(busy)} searchable searchPlaceholder={t('searchStatuses')} placeholder={t('chooseStatus')}
                  onValueChange={value => update('columnId', value)} options={board.columns.map(column => ({ value: column.id, label: column.name, icon: <TaskStatusIcon column={column} /> }))} />
              </div>
              <div className={styles.fieldRow}>
                <label htmlFor={`${titleId}-priority`}><Flag size={14} />{t('priority')}</label>
                <TaskSelect id={`${titleId}-priority`} ariaLabel={t('priority')} value={draft.priority} className={styles.propertyControl} surface="muted" disabled={!canEdit || Boolean(busy)}
                  onValueChange={value => update('priority', value)} options={(['low', 'medium', 'high', 'urgent'] as const).map(priority => ({ value: priority, label: t(priority), icon: <TaskPriorityIcon priority={priority} size={14} /> }))} />
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}><Users size={14} />{t('assignees')}</span>
                <DropdownMenu onOpenChange={open => { if (open) setMemberQuery(''); }}>
                  <DropdownMenuTrigger type="button" data-surface="muted" disabled={!canEdit || Boolean(busy)} className={styles.assigneeTrigger} aria-label={t('chooseAssignees')}>
                    {selectedMembers.length ? <><span className={styles.avatars}>{selectedMembers.slice(0, 2).map(member => <UserAvatar key={member.userId} name={member.name} image={member.image} />)}</span><span className={styles.memberNames}>{selectedMembers.map(member => member.name).join(', ')}</span></> : <span className={styles.emptyValue}>{t('unassigned')}</span>}
                    {canEdit && <CaretDown size={11} />}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className={styles.memberMenu} align="start" density="compact">
                    <DropdownMenuSearch value={memberQuery} onValueChange={setMemberQuery} placeholder={t('searchMembers')} clearLabel={t('clearSearch')} />
                    <div className={styles.memberOptions}>{matchingMembers.map(member => <DropdownMenuCheckboxItem indicator="none" key={member.userId} checked={draft.assigneeIds.includes(member.userId)}
                      onSelect={event => event.preventDefault()}
                      onCheckedChange={checked => update('assigneeIds', checked ? [...draft.assigneeIds, member.userId] : draft.assigneeIds.filter(id => id !== member.userId))}>
                      <UserAvatar name={member.name} image={member.image} className={styles.menuAvatar} /><span className={styles.memberIdentity}>{member.name}</span>
                    </DropdownMenuCheckboxItem>)}
                    {!matchingMembers.length && <p className={styles.noResults}>{t('noResults')}</p>}</div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className={styles.fieldRow}>
                <label htmlFor={`${titleId}-due`}><CalendarBlank size={14} />{t('dueDate')}</label>
                {canEdit || draft.dueDate ? <TaskDateInput id={`${titleId}-due`} type="date" value={draft.dueDate ?? ''} onChange={event => update('dueDate', event.currentTarget.value || null)}
                  clearLabel={t('clearDate')} onClear={canEdit ? () => update('dueDate', null) : undefined} /> : <span className={styles.emptyValue}>{t('noDueDate')}</span>}
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}><Tag size={14} />{t('labels')}</span>
                <div className={styles.labelsField}>{!canEdit && !draft.labels.length ? <span className={styles.emptyValue}>{t('noLabels')}</span> : <TaskLabelsEditor labels={draft.labels} availableLabels={collectTaskLabels(board.tasks)} disabled={!canEdit || Boolean(busy)} onChange={labels => update('labels', labels)} />}</div>
              </div>
            </fieldset>
            {fieldError && <p role="alert" className={styles.fieldError}>{t(fieldError)}</p>}
            {error && <AppAlert tone="error" title={t(error)} onClose={() => setError(null)} />}
            <div className={styles.schedule}><TaskScheduleSection value={draft.schedule} disabled={!canEdit || Boolean(busy)} onChange={value => update('schedule', value)} /></div>
            <div className={`${styles.fieldRow} ${styles.descriptionRow}`}>
              <label htmlFor={`${titleId}-description`}><TextAlignLeft size={14} aria-hidden />{t('description')}</label>
              {canEdit ? <textarea id={`${titleId}-description`} className={styles.description} aria-label={t('description')} rows={4} maxLength={12000} placeholder={t('descriptionPlaceholder')} value={draft.description} disabled={Boolean(busy)} onChange={event => update('description', event.target.value)} /> : <p className={styles.descriptionText} data-empty={!draft.description || undefined}>{draft.description || t('noDescription')}</p>}
            </div>
            <TaskDetailChecklist checklist={draft.checklist} onChecklist={value => update('checklist', value)} editable={canEdit} busy={Boolean(busy)} />
          </section>
          <aside className={styles.commentsPanel} aria-label={t('comments')} hidden={activePane !== 'comments'} data-task-comments>
            <div className={styles.commentsBody}>{task ? <TaskComments board={board} taskId={task.id} actorId={actorId} client={client} onChanged={onCommentsChanged} onDirtyChange={changeCommentDirty} /> : <p className={styles.emptyText}>{t('commentsAfterCreate')}</p>}</div>
          </aside>
        </div>
        <footer className={styles.footer}>
          {canEdit && task && <Button type="button" variant="ghost" className={styles.deleteTask} data-variant="destructive" disabled={Boolean(busy)} onClick={() => setConfirmation('delete')}><Trash size={14} />{t('delete')}</Button>}
          <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={requestClose}>{t(canEdit ? 'cancel' : 'close')}</Button>
          {canEdit && <Button type="button" loading={busy === 'save'} disabled={busy === 'delete'} onClick={() => void save()}>{task ? <CheckSquare size={14} /> : <Plus size={14} />}{t(task ? 'save' : 'create')}</Button>}
        </footer>
      </div>
      {confirmation && <TaskConfirmation kind={confirmation} busy={busy === 'delete'} taskTitle={draft.title}
        onClose={() => { if (!busy) setConfirmation(null); }}
        onConfirm={() => { if (confirmation === 'discard') onClose(); else void remove(); }} />}
    </dialog>
  );
}

function TaskConfirmation({ kind, taskTitle, busy, onClose, onConfirm }: {
  kind: 'discard' | 'delete'; taskTitle: string; busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const { t } = useTranslation(messages);
  const visible = usePageVisible();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = ref.current;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [visible]);
  return <dialog ref={ref} className={styles.confirmDialog} role="alertdialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <div className={styles.confirmContent}>
      <Warning size={25} weight="duotone" className={styles.warningIcon} />
      <h2 id={titleId}>{t(kind === 'delete' ? 'deleteTitle' : 'discardTitle')}</h2>
      {kind === 'delete' && taskTitle && <strong className={styles.confirmTaskTitle}>{taskTitle}</strong>}
      <p>{t(kind === 'delete' ? 'deleteDescription' : 'discardDescription')}</p>
    </div>
    <footer><Button variant="outline" disabled={busy} onClick={onClose}>{t(kind === 'delete' ? 'cancel' : 'continueEditing')}</Button><Button variant="ghost" className={styles.confirmDanger} data-variant="destructive" loading={busy} onClick={onConfirm}>{t(kind === 'delete' ? 'confirmDelete' : 'discard')}</Button></footer>
  </dialog>;
}
