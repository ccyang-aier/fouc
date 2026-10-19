'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CalendarPlus, Circle, Flag, NotePencil, Plus, TextAlignLeft, Users, X } from '@phosphor-icons/react';
import { taskScheduleSchema, type BoardTask, type TaskBoardDetail, type TaskSchedule } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSearch, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { AppAlert } from '@/components/app-alert';
import { useTranslation } from '@/lib/i18n';
import { usePageVisible } from '@/lib/page-visibility';
import type { TaskDraft } from '../task-board-client';
import { TaskPriorityIcon } from '../task-priority-icon';
import { TaskSelect } from '../task-select';
import { TaskStatusIcon } from '../task-status-icon';
import { ScheduleFields } from './calendar-fields';
import { messages } from './calendar.messages';
import styles from './calendar.module.css';

export interface ScheduleEditor {
  task: BoardTask | null;
  schedule: TaskSchedule;
  anchor: { x: number; y: number };
}

export function CalendarScheduleForm({ editor, board, onSave, onClose, onDetails, onUnschedule }: {
  editor: ScheduleEditor; board: TaskBoardDetail;
  onSave: (draft: TaskDraft, original?: BoardTask) => Promise<boolean>;
  onClose: () => void; onDetails: (task: BoardTask) => void;
  onUnschedule: (task: BoardTask) => Promise<boolean>;
}) {
  const { t } = useTranslation(messages);
  const visible = usePageVisible();
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const { task } = editor;
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    title: task?.title ?? '', description: task?.description ?? '', columnId: task?.columnId ?? board.columns[0].id,
    priority: task?.priority ?? 'medium', assigneeIds: task?.assigneeIds ?? [], labels: task?.labels ?? [],
    dueDate: task?.dueDate ?? null, checklist: task?.checklist ?? [], schedule: editor.schedule,
  }));
  const [baseline] = useState(() => JSON.stringify(draft));
  const [memberQuery, setMemberQuery] = useState('');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<'titleRequired' | 'invalidTime' | 'invalidLink' | 'saveFailed' | null>(null);
  const [discard, setDiscard] = useState<'close' | 'details' | 'unschedule' | null>(null);
  const [position, setPosition] = useState({ left: editor.anchor.x, top: editor.anchor.y });
  const dirty = JSON.stringify(draft) !== baseline;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { (discard ? continueRef : titleRef).current?.focus({ preventScroll: true }); }, [discard]);

  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    function place() {
      const bounds = dialog.getBoundingClientRect();
      const left = editor.anchor.x + bounds.width + 16 <= window.innerWidth ? editor.anchor.x + 10 : editor.anchor.x - bounds.width - 10;
      setPosition({ left: Math.max(12, Math.min(left, window.innerWidth - bounds.width - 12)), top: Math.max(12, Math.min(editor.anchor.y, window.innerHeight - bounds.height - 12)) });
    }
    const observer = new ResizeObserver(place); observer.observe(dialog);
    window.addEventListener('resize', place); place();
    titleRef.current?.focus({ preventScroll: true });
    return () => { observer.disconnect(); window.removeEventListener('resize', place); dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [visible, editor.anchor.x, editor.anchor.y]);

  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) { setDraft(current => ({ ...current, [key]: value })); setError(null); }
  function requestClose() { if (saving.current) return; if (discard) { setDiscard(null); return; } if (dirty) setDiscard('close'); else onClose(); }
  function confirmDiscard() { if (discard === 'details' && task) onDetails(task); else if (discard === 'unschedule') void unschedule(); else onClose(); }
  async function submit() {
    if (saving.current || discard) return;
    if (!draft.title.trim()) { setError('titleRequired'); titleRef.current?.focus(); return; }
    const parsed = taskScheduleSchema.safeParse(draft.schedule);
    if (!parsed.success) { setError(parsed.error.issues.some(issue => issue.path[0] === 'url') ? 'invalidLink' : 'invalidTime'); return; }
    saving.current = true; setBusy('save'); setError(null);
    try {
      const ok = await onSave({ ...draft, title: draft.title.trim(), schedule: parsed.data }, task ?? undefined);
      if (active.current) { if (ok) onClose(); else setError('saveFailed'); }
    } catch { if (active.current) setError('saveFailed'); }
    finally { saving.current = false; if (active.current) setBusy(null); }
  }
  async function unschedule() {
    if (!task || saving.current) return;
    saving.current = true; setBusy('remove');
    try { const ok = await onUnschedule(task); if (active.current) { if (ok) onClose(); else setError('saveFailed'); } }
    catch { if (active.current) setError('saveFailed'); }
    finally { saving.current = false; if (active.current) setBusy(null); }
  }
  const members = board.members.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase().includes(memberQuery.trim().toLocaleLowerCase()));
  return <dialog ref={ref} className={styles.schedulePopover} style={position} aria-labelledby={id} onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose(); } }}
    onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); } }}>
    <form noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      <header className={styles.formHeader}><span className={styles.formIcon}><CalendarPlus size={21} /></span><h2 id={id}>{t(task ? 'editSchedule' : 'newSchedule')}</h2></header>
      <fieldset className={styles.formFields} disabled={Boolean(busy) || Boolean(discard)}>
        <label className={styles.formRow}><span><NotePencil size={16} />{t('title')}</span><input ref={titleRef} autoComplete="off" aria-label={t('title')} placeholder={t('titlePlaceholder')} value={draft.title} maxLength={240} aria-invalid={error === 'titleRequired'} onChange={event => update('title', event.target.value)} /></label>
        <label className={styles.formRow}><span><TextAlignLeft size={16} />{t('description')}</span><textarea rows={2} aria-label={t('description')} placeholder={t('descriptionPlaceholder')} value={draft.description} maxLength={12000} onChange={event => update('description', event.target.value)} /></label>
        <ScheduleFields value={draft.schedule!} onChange={value => update('schedule', value)} />
        <div className={styles.formRow}><span><Users size={16} />{t('assignees')}</span><div className={styles.assigneeChips}>
          {board.members.filter(member => draft.assigneeIds.includes(member.userId)).map(member => <span key={member.userId} className={styles.assigneeChip}><UserAvatar name={member.name} image={member.image} /><span>{member.name}</span><button type="button" className="fouc-action" aria-label={`${t('remove')} ${member.name}`} onClick={() => update('assigneeIds', draft.assigneeIds.filter(id => id !== member.userId))}><X size={11} /></button></span>)}
          <DropdownMenu onOpenChange={open => { if (open) setMemberQuery(''); }}><DropdownMenuTrigger className={styles.addAssignee} aria-label={t('chooseAssignees')}><Plus size={14} /></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact" className={styles.memberMenu}><DropdownMenuSearch value={memberQuery} onValueChange={setMemberQuery} placeholder={t('searchMembers')} clearLabel={t('clearSearch')} /><div className={styles.memberOptions}>
            {members.map(member => <DropdownMenuCheckboxItem key={member.userId} indicator="none" checked={draft.assigneeIds.includes(member.userId)} onSelect={event => event.preventDefault()} onCheckedChange={checked => update('assigneeIds', checked ? [...draft.assigneeIds, member.userId] : draft.assigneeIds.filter(id => id !== member.userId))}><UserAvatar name={member.name} image={member.image} className={styles.menuAvatar} /><span>{member.name}</span></DropdownMenuCheckboxItem>)}
            {!members.length && <p className={styles.menuEmpty}>{t('noResults')}</p>}
          </div></DropdownMenuContent></DropdownMenu>
        </div></div>
        <div className={styles.formRow}><span><Circle size={16} />{t('status')}</span><TaskSelect ariaLabel={t('status')} value={draft.columnId} onValueChange={value => update('columnId', value)}
          disabled={Boolean(busy) || Boolean(discard)} searchable options={board.columns.map(column => ({ value: column.id, label: column.name, icon: <TaskStatusIcon column={column} /> }))} /></div>
        <div className={styles.formRow}><span><Flag size={16} />{t('priority')}</span><TaskSelect ariaLabel={t('priority')} value={draft.priority} onValueChange={value => update('priority', value)}
          disabled={Boolean(busy) || Boolean(discard)} options={(['low', 'medium', 'high', 'urgent'] as const).map(priority => ({ value: priority, label: t(priority), icon: <TaskPriorityIcon priority={priority} size={14} /> }))} /></div>
      </fieldset>
      {error === 'saveFailed' ? <div className={styles.formError}><AppAlert tone="error" title={t(error)} /></div> : error && <p className={styles.formError} role="alert">{t(error)}</p>}
      {discard ? <div className={styles.discardPrompt}><p>{t('unsaved')}</p><Button type="button" ref={continueRef} variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => setDiscard(null)}>{t('keepEditing')}</Button><Button type="button" variant="ghost" size="sm" className={styles.discardDanger} data-variant="destructive" loading={busy === 'remove'} onClick={confirmDiscard}>{t('discard')}</Button></div>
        : <footer className={styles.formFooter}>{task && <Button type="button" variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => { if (dirty) { setDiscard('details'); return; } onDetails(task); }}>{t('details')}</Button>}<div /><Button type="button" variant="outline" size="sm" disabled={Boolean(busy)} onClick={requestClose}>{t('cancel')}</Button><Button type="submit" size="sm" loading={busy === 'save'} disabled={busy === 'remove'}>{t(task ? 'save' : 'create')}</Button></footer>}
      {task?.schedule && !discard && <button type="button" className={`fouc-action ${styles.unscheduleAction}`} disabled={Boolean(busy)} onClick={() => { if (dirty) setDiscard('unschedule'); else void unschedule(); }}>{t('removeSchedule')}</button>}
    </form>
  </dialog>;
}
