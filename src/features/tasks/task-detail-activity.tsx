'use client';

import { ChatCircle, ListChecks, Plus, Trash } from '@phosphor-icons/react';
import { useId, useRef, useState, type RefObject } from 'react';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import type { TaskBoardClient } from './task-board-client';
import { TaskComments } from './task-comments';
import { messages } from './task-detail.messages';
import styles from './task-detail.module.css';

export function TaskDetailActivity({ board, task, actorId, client, checklist, onChecklist, newItem, onNewItem, onAddItem, inputRef, editable, busy, onCommentsChanged, onCommentDirtyChange }: {
  board: TaskBoardDetail; task: BoardTask | null; actorId: string; client: TaskBoardClient;
  checklist: BoardTask['checklist']; onChecklist: (value: BoardTask['checklist']) => void;
  newItem: string; onNewItem: (value: string) => void; onAddItem: () => void; inputRef: RefObject<HTMLInputElement | null>;
  editable: boolean; busy: boolean; onCommentsChanged: () => void; onCommentDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation(messages);
  const [tab, setTab] = useState<'checklist' | 'comments'>('checklist');
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const done = checklist.filter(item => item.done).length;
  return <aside className={styles.activity} aria-label={t('activity')}>
    <div className={styles.activityTabs} role="tablist" aria-label={t('activity')}>
      {(['checklist', 'comments'] as const).map((value, index) => {
        const Icon = value === 'checklist' ? ListChecks : ChatCircle;
        return <button key={value} ref={node => { tabs.current[index] = node; }} type="button" role="tab" id={`${id}-${value}-tab`} aria-controls={`${id}-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
          className={`fouc-action ${styles.activityTab}`} data-surface="plain" data-active={tab === value || undefined} onClick={() => setTab(value)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : index === 0 ? 1 : 0;
            setTab(target === 0 ? 'checklist' : 'comments'); tabs.current[target]?.focus();
          }}><Icon size={14} />{t(value === 'checklist' ? 'subtasks' : 'comments')}<span>{value === 'checklist' ? checklist.length : task?.commentCount ?? 0}</span></button>;
      })}
    </div>
    <div className={styles.activityPanel} id={`${id}-checklist`} role="tabpanel" aria-labelledby={`${id}-checklist-tab`} hidden={tab !== 'checklist'}>
      <div className={styles.checklistSummary}><span>{t('checklistProgress', { done, total: checklist.length })}</span><span>{checklist.length ? Math.round(done / checklist.length * 100) : 0}%</span></div>
      <div className={styles.progress} role="progressbar" aria-label={t('checklist')} aria-valuenow={done} aria-valuemin={0} aria-valuemax={Math.max(1, checklist.length)}><span style={{ width: `${checklist.length ? done / checklist.length * 100 : 0}%` }} /></div>
      <ul className={styles.checklist}>
        {checklist.map(item => <li key={item.id} data-done={item.done || undefined}>
          <input type="checkbox" checked={item.done} disabled={!editable || busy} aria-label={item.title || t('checklistItem')} onChange={event => onChecklist(checklist.map(current => current.id === item.id ? { ...current, done: event.target.checked } : current))} />
          {editable ? <input type="text" className={styles.checklistTitle} aria-label={t('checklistItem')} maxLength={240} value={item.title} disabled={busy} onChange={event => onChecklist(checklist.map(current => current.id === item.id ? { ...current, title: event.target.value } : current))} /> : <span className={styles.checklistLabel}>{item.title}</span>}
          {editable && <Button type="button" variant="ghost" size="icon-sm" className={styles.removeItem} data-variant="destructive" aria-label={t('removeItem')} disabled={busy} onClick={() => onChecklist(checklist.filter(current => current.id !== item.id))}><Trash size={13} /></Button>}
        </li>)}
      </ul>
      {!checklist.length && <p className={styles.emptyText}>{t('noChecklist')}</p>}
      {editable && checklist.length < 100 && <div className={styles.addItem}>
        <Plus size={14} aria-hidden /><input ref={inputRef} placeholder={t('checklistPlaceholder')} aria-label={t('checklistPlaceholder')} maxLength={240} value={newItem} disabled={busy} onChange={event => onNewItem(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) { event.preventDefault(); onAddItem(); } }} />
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('addItem')} disabled={!newItem.trim() || busy} onClick={onAddItem}><Plus size={14} /></Button>
      </div>}
    </div>
    <div className={`${styles.activityPanel} ${styles.comments}`} id={`${id}-comments`} role="tabpanel" aria-labelledby={`${id}-comments-tab`} hidden={tab !== 'comments'} data-task-comments>
      {task ? <TaskComments board={board} taskId={task.id} actorId={actorId} client={client} onChanged={onCommentsChanged} onDirtyChange={onCommentDirtyChange} /> : <p className={styles.emptyText}>{t('commentsAfterCreate')}</p>}
    </div>
  </aside>;
}
