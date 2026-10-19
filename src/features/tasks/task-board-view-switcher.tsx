'use client';

import { CalendarDots, DotsThree, PencilSimple, PlusCircle, SquaresFour, Table, Trash } from '@phosphor-icons/react';
import { TASK_BOARD_VIEW_LIMIT, type TaskBoardView, type TaskViewKind } from '@fouc/shared/tasks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-views.messages';
import styles from './task-board.module.css';

export const taskViewIcons = { kanban: SquaresFour, calendar: CalendarDots, spreadsheet: Table } satisfies Record<TaskViewKind, typeof SquaresFour>;

export function TaskBoardViewSwitcher({ views, value, onChange, editable, busy, onCreate, onRename, onRemove }: {
  views: TaskBoardView[]; value: string | null; onChange: (id: string) => void; editable: boolean; busy: boolean;
  onCreate: () => void; onRename: (view: TaskBoardView) => void; onRemove: (view: TaskBoardView) => void;
}) {
  const { t } = useTranslation(messages);
  return <div className={styles.viewSwitcher} role="group" aria-label={t('views')}>
    {views.map(view => {
      const Icon = taskViewIcons[view.kind];
      return <div key={view.id} className={styles.viewTab} data-active={value === view.id || undefined}>
        <button type="button" className={`fouc-action ${styles.viewSegment}`} data-surface="plain" aria-pressed={value === view.id} onClick={() => onChange(view.id)} title={view.name}><Icon size={18} /><span>{view.name}</span></button>
        {editable && <DropdownMenu><DropdownMenuTrigger className={styles.viewActions} data-surface="plain" disabled={busy} aria-label={t('viewActions', { name: view.name })}><DotsThree size={15} /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" density="compact"><DropdownMenuItem onSelect={() => onRename(view)}><PencilSimple />{t('renameView')}</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => onRemove(view)}><Trash />{t('removeView')}</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>}
      </div>;
    })}
    {editable && <Tooltip><TooltipTrigger asChild><span className={styles.newViewTrigger}><button type="button" className={`fouc-action ${styles.createButton}`} data-surface="plain" onClick={onCreate} disabled={busy || views.length >= TASK_BOARD_VIEW_LIMIT} aria-label={t('newView')}><PlusCircle size={20} /></button></span></TooltipTrigger><TooltipContent>{t(views.length >= TASK_BOARD_VIEW_LIMIT ? 'viewLimit' : 'newView')}</TooltipContent></Tooltip>}
  </div>;
}
