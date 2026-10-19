'use client';

import { Plus, X } from '@phosphor-icons/react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { TASK_LABEL_COLORS, type TaskLabel, type TaskLabelColor } from '@fouc/shared/tasks';
import { AnchoredPopover } from '@/components/ui/anchored-popover';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { appendTaskLabel, collectTaskLabels, type TaskLabelIssue } from './task-labels-model';
import { messages } from './task-labels.messages';
import styles from './task-labels.module.css';

export { collectTaskLabels } from './task-labels-model';

export function TaskLabelBadge({ label, className = '', children }: { label: TaskLabel; className?: string; children?: ReactNode }) {
  return <span className={`${styles.color} ${styles.badge} ${className}`} data-label-color={label.color} title={label.name}>
    <span className={styles.badgeText}>{label.name}</span>{children}
  </span>;
}

export function TaskLabelsEditor({ labels, availableLabels, disabled = false, onChange }: {
  labels: TaskLabel[]; availableLabels: TaskLabel[]; disabled?: boolean; onChange: (labels: TaskLabel[]) => void;
}) {
  const { t } = useTranslation(messages);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const atLimit = labels.length >= 20;
  return <div className={styles.editor}>
    <div className={styles.tokens}>{labels.map(label => <TaskLabelBadge key={label.name} label={label} className={styles.editableBadge}>
      {!disabled && <button type="button" className={`fouc-action ${styles.remove}`} data-variant="destructive" aria-label={t('removeLabel', { name: label.name })}
        onClick={() => { onChange(labels.filter(item => item.name !== label.name)); window.requestAnimationFrame(() => addRef.current?.focus({ preventScroll: true })); }}><X size={10} aria-hidden /></button>}
    </TaskLabelBadge>)}</div>
    {!disabled && <button ref={addRef} type="button" className={`fouc-action ${styles.add}`} data-surface="muted" aria-label={t('addLabel')}
      title={atLimit ? t('labelLimit') : t('addLabel')} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} disabled={atLimit}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}><Plus size={13} aria-hidden /></button>}
    {anchor && !disabled && <AnchoredPopover anchor={anchor} onClose={() => setAnchor(null)} label={t('addLabel')} width={238}>
      <TaskLabelPicker labels={labels} availableLabels={availableLabels} onAdd={next => { onChange(next); setAnchor(null); }} />
    </AnchoredPopover>}
  </div>;
}

function TaskLabelPicker({ labels, availableLabels, onAdd }: { labels: TaskLabel[]; availableLabels: TaskLabel[]; onAdd: (labels: TaskLabel[]) => void }) {
  const { t } = useTranslation(messages);
  const [name, setName] = useState('');
  const [color, setColor] = useState<TaskLabelColor>('blue');
  const [error, setError] = useState<TaskLabelIssue | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const nameId = useId(), errorId = useId(), colorsId = useId();
  const normalized = name.trim().toLocaleLowerCase();
  const uniqueLabels = collectTaskLabels([{ labels: availableLabels }]);
  const matches = uniqueLabels.filter(label => !labels.some(selected => selected.name === label.name) && label.name.toLocaleLowerCase().includes(normalized));
  const existing = uniqueLabels.find(label => label.name === name.trim());

  function add(labelName: string, labelColor: TaskLabelColor) {
    const result = appendTaskLabel(labels, uniqueLabels, labelName, labelColor);
    if ('error' in result) setError(result.error); else onAdd(result.labels);
  }
  function navigateOptions(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = [...optionsRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []];
    if (!options.length) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? options.length - 1 : 0) : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
    options[next].focus();
  }
  return <form className={styles.picker} onSubmit={event => { event.preventDefault(); add(name, color); }}>
    <label className={styles.srOnly} htmlFor={nameId}>{t('labelName')}</label>
    <input id={nameId} data-autofocus className={styles.name} value={name} autoComplete="off" maxLength={120}
      placeholder={t('searchOrCreate')} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
      onChange={event => { setName(event.target.value); setError(null); }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') navigateOptions(event); }} />
    {matches.length > 0 && <div ref={optionsRef} className={styles.options} onKeyDown={navigateOptions}>
      {matches.map(label => <button key={label.name} type="button" className={`fouc-menu-item ${styles.option}`} onClick={() => add(label.name, label.color)}>
        <TaskLabelBadge label={label} />
      </button>)}
    </div>}
    {!existing && <fieldset className={styles.colors} aria-labelledby={colorsId}>
      <legend id={colorsId} className={styles.srOnly}>{t('color')}</legend>
      {TASK_LABEL_COLORS.map(option => <label key={option} className={`fouc-action ${styles.color} ${styles.colorSwatch}`} data-label-color={option} title={t(option)}>
        <input className={styles.colorInput} type="radio" name="task-label-color" value={option} checked={color === option} onChange={() => setColor(option)} aria-label={t(option)} />
        <span aria-hidden />
      </label>)}
    </fieldset>}
    {error && <p id={errorId} className={styles.error} role="alert">{t(error)}</p>}
    <Button type="submit" size="sm" className={styles.submit}>{t('addLabel')}</Button>
  </form>;
}
