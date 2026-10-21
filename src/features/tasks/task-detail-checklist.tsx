'use client';

import { CaretRight, ListChecks, Plus, Trash } from '@phosphor-icons/react';
import { useId, useRef } from 'react';
import type { BoardTask } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-detail.messages';
import styles from './task-detail.module.css';

export function TaskDetailChecklist({ checklist, onChecklist, editable, busy }: {
  checklist: BoardTask['checklist']; onChecklist: (value: BoardTask['checklist']) => void;
  editable: boolean; busy: boolean;
}) {
  const { t } = useTranslation(messages);
  const headingId = useId();
  const focusItem = useRef<string | null>(null);
  const done = checklist.filter(item => item.done).length;
  return <details className={`${styles.section} ${styles.checklistSection}`} aria-labelledby={headingId} data-task-detail-checklist>
    <summary className={`fouc-action ${styles.sectionHeading} ${styles.checklistToggle}`} data-surface="plain"><ListChecks size={15} aria-hidden /><h3 id={headingId}>{t('subtasks')}</h3><span className={styles.sectionCount}>{checklist.length}</span><span className={styles.checklistSummary}>{t('checklistProgress', { done, total: checklist.length })}</span><CaretRight className={styles.checklistChevron} size={13} aria-hidden /></summary>
    <div className={styles.checklistBody}>
      <ul className={styles.checklist}>
        {checklist.map(item => <li key={item.id} data-done={item.done || undefined}>
          <input type="checkbox" checked={item.done} disabled={!editable || busy} aria-label={item.title || t('checklistItem')} onChange={event => onChecklist(checklist.map(current => current.id === item.id ? { ...current, done: event.target.checked } : current))} />
          {editable ? <input type="text" className={styles.checklistTitle} aria-label={t('checklistItem')} placeholder={t('checklistPlaceholder')} maxLength={240} value={item.title} disabled={busy}
            ref={input => { if (input && focusItem.current === item.id) { input.focus(); focusItem.current = null; } }}
            onChange={event => onChecklist(checklist.map(current => current.id === item.id ? { ...current, title: event.target.value } : current))} /> : <span className={styles.checklistLabel}>{item.title}</span>}
          {editable && <Button type="button" variant="ghost" size="icon-sm" className={styles.removeItem} data-variant="destructive" aria-label={t('removeItem')} disabled={busy} onClick={() => onChecklist(checklist.filter(current => current.id !== item.id))}><Trash size={13} /></Button>}
        </li>)}
      </ul>
      {!checklist.length && <p className={styles.emptyText}>{t('noChecklist')}</p>}
      {editable && checklist.length < 100 && <Button type="button" variant="ghost" size="sm" className={styles.addItem} disabled={busy} onClick={() => {
        const id = crypto.randomUUID();
        focusItem.current = id;
        onChecklist([...checklist, { id, title: '', done: false }]);
      }}><Plus size={14} aria-hidden />{t('addItem')}</Button>}
    </div>
  </details>;
}
