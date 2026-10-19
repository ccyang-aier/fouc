'use client';

import { useState } from 'react';
import { CalendarDots, PencilSimple, PlusCircle, SquaresFour, Table, Trash } from '@phosphor-icons/react';
import { TASK_BOARD_VIEW_LIMIT, type TaskBoardView, type TaskViewKind } from '@fouc/shared/tasks';
import { AnchoredPopover, type PopoverAnchor } from '@/components/ui/anchored-popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-views.messages';
import styles from './task-board.module.css';

export const taskViewIcons = { kanban: SquaresFour, calendar: CalendarDots, spreadsheet: Table } satisfies Record<TaskViewKind, typeof SquaresFour>;

export function TaskBoardViewSwitcher({ views, value, onChange, editable, busy, creating, onCreate, onRename, onRemove }: {
  views: TaskBoardView[]; value: string | null; onChange: (id: string) => void; editable: boolean; busy: boolean; creating?: boolean;
  onCreate: (anchor: HTMLElement) => void; onRename: (view: TaskBoardView, anchor: HTMLElement) => void; onRemove: (view: TaskBoardView) => void;
}) {
  const { t } = useTranslation(messages);
  const [context, setContext] = useState<{ viewId: string; anchor: PopoverAnchor; trigger: HTMLElement } | null>(null);
  const contextView = views.find(view => view.id === context?.viewId);
  return <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
    {views.map(view => {
      const Icon = taskViewIcons[view.kind];
      return <div key={view.id} className={styles.viewTab} data-active={value === view.id || undefined}>
        <button type="button" className={`fouc-action ${styles.viewSegment}`} data-surface="plain" aria-pressed={value === view.id} onClick={() => onChange(view.id)} title={view.name}
          aria-haspopup={editable ? 'menu' : undefined} onContextMenu={event => {
            if (!editable || busy) return;
            event.preventDefault();
            setContext({ viewId: view.id, trigger: event.currentTarget, anchor: { left: event.clientX, right: event.clientX, top: event.clientY, bottom: event.clientY } });
          }} onKeyDown={event => {
            if (!editable || busy || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
            event.preventDefault();
            setContext({ viewId: view.id, trigger: event.currentTarget, anchor: event.currentTarget });
          }}><Icon size={18} /><span>{view.name}</span></button>
      </div>;
    })}
    {editable && <Tooltip><TooltipTrigger asChild><span className={styles.newViewTrigger}><button type="button" className={`fouc-action ${styles.createButton}`} data-surface="plain" onClick={event => onCreate(event.currentTarget)} disabled={busy || views.length >= TASK_BOARD_VIEW_LIMIT} aria-expanded={creating} aria-haspopup="dialog" aria-label={t('newView')}><PlusCircle size={20} /></button></span></TooltipTrigger><TooltipContent>{t(views.length >= TASK_BOARD_VIEW_LIMIT ? 'viewLimit' : 'newView')}</TooltipContent></Tooltip>}
    {context && contextView && editable && !busy && <AnchoredPopover anchor={context.anchor} restoreFocusTo={context.trigger} role="menu" width={164} label={t('viewActions', { name: contextView.name })} onClose={() => setContext(null)}>
      <button type="button" role="menuitem" className={`fouc-menu-item ${styles.contextAction}`} disabled={busy} onClick={() => { setContext(null); onRename(contextView, context.trigger); }}><PencilSimple size={16} />{t('renameView')}</button>
      <button type="button" role="menuitem" className={`fouc-menu-item ${styles.contextAction}`} data-variant="destructive" disabled={busy} onClick={() => { setContext(null); onRemove(contextView); }}><Trash size={16} />{t('removeView')}</button>
    </AnchoredPopover>}
  </div>;
}
