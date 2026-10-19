'use client';

import { useState } from 'react';
import { LockSimple, Plus, SquaresFour } from '@phosphor-icons/react';
import type { BoardTask, CreateTaskBoardViewInput, TaskBoardView, TaskSchedule } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { PageSessionNamespace, usePageSessionState } from '@/lib/page-session-state';
import { useTranslation } from '@/lib/i18n';
import type { TaskDraft } from './task-board-client';
import { emptyTaskFilters, hasTaskFilters, selectTasks, type TaskFilters, type TaskSort } from './task-board-model';
import { TaskBoardToolbar } from './task-board-toolbar';
import { TaskViewForm } from './task-view-form';
import { KanbanBoard } from './kanban-board';
import { TaskCalendar } from './calendar/task-calendar';
import { TaskTable } from './table/task-table';
import { messages } from './task-board.messages';
import { messages as viewMessages } from './task-views.messages';
import styles from './task-board.module.css';

type WorkspaceProps = Omit<React.ComponentProps<typeof KanbanBoard>, 'tasks' | 'canDrag'> & {
  actorId: string; refreshing: boolean; onRefresh: () => void; onSettings: () => void; onRemoveBoard: () => void;
  onSaveTask: (draft: TaskDraft, original?: BoardTask) => Promise<boolean>;
  onSchedule: (task: BoardTask, schedule: TaskSchedule | null) => Promise<boolean>;
  onMoveTasks: (taskIds: string[], columnId: string) => Promise<boolean>;
  onCreateView: (draft: CreateTaskBoardViewInput) => Promise<TaskBoardView | null>;
  onRenameView: (view: TaskBoardView, name: string) => Promise<boolean>;
  onRemoveView: (view: TaskBoardView) => void;
};

export function TaskBoardWorkspace({ onCreateView, onRenameView, ...props }: WorkspaceProps) {
  const [selectedId, setSelectedId] = usePageSessionState<string | null>(`tasks:${props.board.id}:active-view`, null);
  const [editing, setEditing] = useState<{ view: TaskBoardView | null } | null>(null);
  const active = props.board.views.find(view => view.id === selectedId) ?? props.board.views[0] ?? null;
  return <PageSessionNamespace name={`task-view:${active?.id ?? 'empty'}`}>
    <TaskBoardViewContent key={active?.id ?? 'empty'} {...props} view={active} onSelectView={setSelectedId} onNewView={() => setEditing({ view: null })} onRequestRenameView={view => setEditing({ view })} />
    {editing && props.board.permission !== 'viewer' && (!editing.view || props.board.views.some(view => view.id === editing.view!.id)) && <TaskViewForm key={`edit-view:${editing.view?.id ?? 'new'}`} view={editing.view ?? undefined} onClose={() => setEditing(null)} onSave={async draft => {
      if (editing.view) return onRenameView(editing.view, draft.name);
      const created = await onCreateView(draft);
      if (created) setSelectedId(created.id);
      return Boolean(created);
    }} />}
  </PageSessionNamespace>;
}

function TaskBoardViewContent({ board, actorId, view, onSelectView, onNewView, onRequestRenameView, onRemoveView, onSettings, onRemoveBoard, onSaveTask, onSchedule, onMoveTasks, ...actions }: Omit<WorkspaceProps, 'onCreateView' | 'onRenameView'> & {
  view: TaskBoardView | null; onSelectView: (id: string) => void; onNewView: () => void; onRequestRenameView: (view: TaskBoardView) => void;
}) {
  const { t } = useTranslation(messages);
  const { t: viewText } = useTranslation(viewMessages);
  const [filters, setFilters] = usePageSessionState<TaskFilters>(`tasks:${board.id}:filters`, emptyTaskFilters);
  const [sort, setSort] = usePageSessionState<TaskSort>(`tasks:${board.id}:sort`, 'manual');
  const tasks = selectTasks(board, filters, sort, actorId);
  const filtered = hasTaskFilters(filters);
  const canDrag = board.permission !== 'viewer' && !filtered && sort === 'manual';
  return <>
    <TaskBoardToolbar board={board} actorId={actorId} filters={filters} onFilters={setFilters} sort={sort} onSort={setSort} onRefresh={actions.onRefresh} refreshing={actions.refreshing} busy={actions.busy} onCreate={() => actions.onCreate(board.columns[0].id)} onCreateColumn={() => actions.onColumn()} onSettings={onSettings} onRemoveBoard={onRemoveBoard} view={view} onView={onSelectView} onCreateView={onNewView} onRenameView={onRequestRenameView} onRemoveView={onRemoveView} />
    {board.permission === 'viewer' && <p className={styles.permissionNote}><LockSimple size={12} />{t('readOnlyDescription')}</p>}
    {!view ? <div className={styles.emptyView}><SquaresFour size={28} /><h2>{viewText(board.permission === 'viewer' ? 'empty' : 'firstView')}</h2>{board.permission === 'viewer' ? <p>{viewText('emptyReadOnly')}</p> : <Button size="sm" disabled={actions.busy} onClick={onNewView}><Plus size={14} />{viewText('newView')}</Button>}</div>
      : <>{filtered && <div className={styles.resultCount}>{t('visibleCount', { count: tasks.length, total: board.tasks.length })}{tasks.length === 0 && <strong>{t('noMatches')}</strong>}</div>}
        {view.kind === 'calendar' ? <TaskCalendar board={board} tasks={tasks} busy={actions.busy} onSave={onSaveTask} onSchedule={onSchedule} onDetails={actions.onOpen} />
          : view.kind === 'spreadsheet' ? <TaskTable board={board} tasks={tasks} busy={actions.busy} onOpen={actions.onOpen} onCreate={actions.onCreate} onRemove={actions.onRemove} onMoveTasks={onMoveTasks} />
          : <KanbanBoard board={board} tasks={tasks} canDrag={canDrag} {...actions} />}
        {view.kind === 'kanban' && board.permission !== 'viewer' && !canDrag && <p className={styles.dragNote}>{t('filteredDrag')}</p>}
      </>}
  </>;
}
