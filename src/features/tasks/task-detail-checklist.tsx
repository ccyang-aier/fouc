'use client';

import { Plus, Trash, Users } from '@phosphor-icons/react';
import { useRef } from 'react';
import type { BoardTask, TaskBoardMember } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import { TaskSelect } from './task-select';
import { messages } from './task-detail.messages';
import styles from './task-detail.module.css';

export function TaskDetailChecklist({ checklist, members, onChecklist, editable, busy, invalid }: {
  checklist: BoardTask['checklist']; onChecklist: (value: BoardTask['checklist']) => void;
  members: TaskBoardMember[]; editable: boolean; busy: boolean; invalid: boolean;
}) {
  const { t } = useTranslation(messages);
  const focusItem = useRef<string | null>(null);
  const done = checklist.filter(item => item.done).length;
  const assignees = [
    { value: 'unassigned', label: t('unassigned'), icon: <Users size={14} aria-hidden /> },
    ...members.map(member => ({ value: member.userId, label: member.name, keywords: member.email,
      icon: <UserAvatar name={member.name} image={member.image} className={styles.subtaskAvatar} /> })),
  ];
  function update(id: string, patch: Partial<BoardTask['checklist'][number]>) {
    onChecklist(checklist.map(item => item.id === id ? { ...item, ...patch } : item));
  }
  return <div className={styles.checklistSection} data-task-detail-checklist>
    {checklist.length > 0 && <div className={styles.checklistSummary}>{t('checklistProgress', { done, total: checklist.length })}</div>}
    <div className={styles.checklistBody}>
      <ul className={styles.checklist}>
        {checklist.map(item => <li key={item.id} data-done={item.done || undefined}>
          <input type="checkbox" checked={item.done} disabled={!editable || busy} aria-label={item.title || t('checklistItem')} onChange={event => update(item.id, { done: event.target.checked })} />
          <div className={styles.checklistItemContent}>
            {editable ? <input type="text" className={styles.checklistTitle} aria-label={t('checklistItem')} placeholder={t('checklistPlaceholder')} maxLength={240} value={item.title} disabled={busy}
              aria-invalid={(invalid && !item.title.trim()) || undefined}
              ref={input => { if (input && focusItem.current === item.id) { input.focus(); focusItem.current = null; } }}
              onChange={event => update(item.id, { title: event.target.value })} /> : <span className={styles.checklistLabel}>{item.title}</span>}
            <TaskSelect value={item.assigneeId ?? 'unassigned'} options={assignees} onValueChange={value => update(item.id, { assigneeId: value === 'unassigned' ? null : value })}
              ariaLabel={t('chooseSubtaskAssignee', { title: item.title || t('newSubtask') })} searchable searchPlaceholder={t('searchMembers')}
              className={styles.subtaskAssignee} surface="plain" disabled={!editable || busy} />
          </div>
          {editable && <Button type="button" variant="ghost" size="icon-sm" className={styles.removeItem} data-variant="destructive" aria-label={t('removeItem')} disabled={busy} onClick={() => onChecklist(checklist.filter(current => current.id !== item.id))}><Trash size={13} /></Button>}
        </li>)}
      </ul>
      {!checklist.length && <EmptyState label={t('noChecklist')} />}
      {editable && checklist.length < 100 && <Button type="button" variant="ghost" size="sm" className={styles.addItem} disabled={busy} onClick={() => {
        const id = crypto.randomUUID();
        focusItem.current = id;
        onChecklist([...checklist, { id, title: '', done: false, assigneeId: null }]);
      }}><Plus size={14} aria-hidden />{t('addItem')}</Button>}
    </div>
  </div>;
}
