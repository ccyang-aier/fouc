'use client';

import { useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Kanban, LockSimple, Plus, Users } from '@phosphor-icons/react';
import type { BoardTask, TaskBoardDetail, TaskBoardSummary, TaskColumn, TaskSchedule } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { useIdentity } from '@/features/identity/identity-provider';
import { useProjectResources } from '@/features/project/project-resources';
import { usePageSessionState } from '@/lib/page-session-state';
import { usePageVisible } from '@/lib/page-visibility';
import { useTranslation } from '@/lib/i18n';
import { createTaskBoardClient, TaskBoardError, type TaskDraft } from './task-board-client';
import { emptyTaskFilters, hasTaskFilters, selectTasks, type TaskFilters, type TaskSort } from './task-board-model';
import { TaskBoardPicker } from './task-board-picker';
import { TaskBoardToolbar } from './task-board-toolbar';
import { KanbanBoard } from './kanban-board';
import { TaskBoardForm, TaskColumnForm, TaskConfirm } from './task-board-dialogs';
import { TaskBoardMembers } from './task-board-members';
import { TaskDetail } from './task-detail';
import { TaskCalendar } from './calendar/task-calendar';
import { TaskTable } from './table/task-table';
import { scheduleTaskPatch } from './calendar/calendar-model';
import type { TaskBoardView } from './task-board-view-switcher';
import { messages } from './task-board.messages';
import styles from './task-board.module.css';

export function TaskBoardsPage() {
  const { t } = useTranslation(messages);
  const { selectedProject, scopeKey } = useProjectResources();
  const { session, openSignIn } = useIdentity();
  if (selectedProject?.source !== 'server' || session.status !== 'authenticated') return <section className={styles.page} aria-label={t('tasks')}>
    <div className={styles.empty}><EmptyBoardIllustration /><h1>{t('teamProject')}</h1><p>{t(session.status === 'authenticated' ? 'localDescription' : 'signInDescription')}</p>{session.status !== 'authenticated' && <Button size="sm" onClick={openSignIn}>{t('signIn')}</Button>}</div>
  </section>;
  return <TaskBoardScope key={scopeKey} projectId={selectedProject.id} actorId={session.user.id} />;
}

function TaskBoardScope({ projectId, actorId }: { projectId: string; actorId: string }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }));
  return <QueryClientProvider client={client}><TaskBoardsContent projectId={projectId} actorId={actorId} /></QueryClientProvider>;
}

type Confirmation = { kind: 'board' | 'task' | 'column'; boardId: string; id: string; name: string };
type BoardDialog = { kind: 'create' } | { kind: 'settings'; boardId: string };
function TaskBoardsContent({ projectId, actorId }: { projectId: string; actorId: string }) {
  const { t } = useTranslation(messages);
  const { notify } = useAppAlert();
  const visible = usePageVisible();
  const query = useQueryClient();
  const client = useMemo(() => createTaskBoardClient(projectId), [projectId]);
  const [selectedId, setSelectedId] = usePageSessionState<string | null>('tasks:board', null);
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const [column, setColumn] = useState<{ boardId: string; value: TaskColumn | null } | null>(null);
  const [detail, setDetail] = useState<{ boardId: string; taskId: string | null; columnId: string } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const boardsQuery = useQuery({ queryKey: ['task-boards'], queryFn: ({ signal }) => client.list(signal), enabled: visible, refetchInterval: visible && !busy ? 15_000 : false });
  const boards = boardsQuery.data ?? [];
  const selected = boards.find(board => board.id === selectedId) ?? boards[0];
  const boardQuery = useQuery({ queryKey: ['task-board', selected?.id], queryFn: ({ signal }) => client.get(selected!.id, signal), enabled: Boolean(selected) && visible, refetchInterval: visible && !busy ? 15_000 : false });
  const accessRevoked = boardQuery.error instanceof TaskBoardError && [401, 403, 404].includes(boardQuery.error.status);
  const board = accessRevoked ? undefined : boardQuery.data;
  const loadFailed = (boardsQuery.isError && !boardsQuery.data) || accessRevoked || (boardQuery.isError && !boardQuery.data);
  const backgroundFailed = !loadFailed && (boardsQuery.isError || boardQuery.isError);

  function publish(next: TaskBoardDetail) {
    void query.cancelQueries({ queryKey: ['task-board', next.id] });
    query.setQueryData(['task-board', next.id], next);
    const summary: TaskBoardSummary = { id: next.id, projectId: next.projectId, name: next.name, description: next.description, visibility: next.visibility, ownerId: next.ownerId, permission: next.permission, taskCount: next.taskCount, completedCount: next.completedCount, createdAt: next.createdAt, updatedAt: next.updatedAt };
    query.setQueryData<TaskBoardSummary[]>(['task-boards'], current => current?.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? summary : item) : [...(current ?? []), summary]);
  }
  function failure(cause: unknown) {
    notify('error', cause instanceof TaskBoardError && [403, 404].includes(cause.status) ? t('accessChanged') : t('mutationFailed'));
    if (cause instanceof TaskBoardError && [403, 404].includes(cause.status)) void query.invalidateQueries({ queryKey: ['task-boards'] });
  }
  async function mutate(operation: () => Promise<TaskBoardDetail>, success: 'saved' | 'moved' | 'deleted' = 'saved') {
    if (pending.current) return false;
    pending.current = true; setBusy(true);
    await query.cancelQueries({ queryKey: ['task-board'] });
    await query.cancelQueries({ queryKey: ['task-boards'] });
    try { publish(await operation()); notify('success', t(success)); return true; }
    catch (cause) { failure(cause); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  async function removeConfirmed() {
    if (!confirmation) return false;
    if (confirmation.kind === 'task') return mutate(() => client.removeTask(confirmation.boardId, confirmation.id), 'deleted');
    if (confirmation.kind === 'column') return mutate(() => client.removeColumn(confirmation.boardId, confirmation.id), 'deleted');
    if (pending.current) return false;
    pending.current = true; setBusy(true);
    await query.cancelQueries({ queryKey: ['task-board'] });
    await query.cancelQueries({ queryKey: ['task-boards'] });
    try {
      await client.remove(confirmation.boardId);
      query.removeQueries({ queryKey: ['task-board', confirmation.boardId] });
      query.setQueryData<TaskBoardSummary[]>(['task-boards'], current => current?.filter(item => item.id !== confirmation.boardId));
      setSelectedId(null); notify('success', t('deleted')); return true;
    } catch (cause) { failure(cause); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  function refresh() { void query.invalidateQueries({ queryKey: ['task-boards'] }); void query.invalidateQueries({ queryKey: ['task-board'] }); }
  function saveTask(draft: TaskDraft, taskId?: string) { return mutate(() => taskId ? client.updateTask(board!.id, taskId, draft) : client.addTask(board!.id, draft)); }
  function saveCalendarTask(draft: TaskDraft, original?: BoardTask) {
    if (!original) return saveTask(draft);
    const patch = scheduleTaskPatch(original, draft);
    return Object.keys(patch).length ? mutate(() => client.updateTask(board!.id, original.id, patch)) : Promise.resolve(true);
  }
  async function moveTableTasks(taskIds: string[], columnId: string) {
    const targets = board!.tasks.filter(task => taskIds.includes(task.id) && task.columnId !== columnId);
    if (!targets.length) return true;
    const ok = await mutate(async () => {
      let next = board!;
      for (const task of targets) next = await client.moveTask(board!.id, task.id, columnId, null);
      return next;
    }, 'moved');
    // If a later request failed, reload any moves already accepted by the server.
    if (!ok) refresh();
    return ok;
  }
  return <section className={styles.page} aria-label={t('tasks')}>
    <header className={styles.header}>
      <div className={styles.titleRow}><div className={styles.titleIdentity}><TaskBoardPicker boards={boards} selected={selected} onSelect={id => { setSelectedId(id); setDetail(null); setColumn(null); setConfirmation(null); setDialog(null); }} onCreate={() => setDialog({ kind: 'create' })} />
        {selected && <span className={styles.visibility}>{selected.visibility === 'private' ? <LockSimple size={12} /> : <Users size={12} />}{t(selected.visibility)}</span>}
      </div>
      <div className={styles.headerActions}>
        {board && <TaskBoardMembers key={board.id} board={board} client={client} onChanged={publish} onEditSettings={() => setDialog({ kind: 'settings', boardId: board.id })} />}
        {!selected && <Button size="sm" onClick={() => setDialog({ kind: 'create' })}><Plus size={15} />{t('createBoard')}</Button>}
      </div></div>
    </header>
    {backgroundFailed && <div className={styles.syncError}><AppAlert tone="warning" title={t('syncFailed')} action={<button type="button" onClick={refresh}>{t('retry')}</button>} /></div>}
    {boardsQuery.isPending || (selected && boardQuery.isPending) ? <BoardSkeleton />
      : loadFailed ? <div className={styles.loadError}><AppAlert tone="error" title={t('failed')} action={<button type="button" onClick={refresh}>{t('retry')}</button>} /></div>
      : board ? <TaskBoardWorkspace key={board.id} board={board} actorId={actorId} busy={busy} onSaveTask={saveCalendarTask} onMoveTasks={moveTableTasks} onSchedule={(task, schedule) => mutate(() => client.updateTask(board.id, task.id, { schedule }))} refreshing={boardQuery.isFetching} onRefresh={refresh} onSettings={() => setDialog({ kind: 'settings', boardId: board.id })} onRemoveBoard={() => setConfirmation({ kind: 'board', boardId: board.id, id: board.id, name: board.name })} onOpen={task => setDetail({ boardId: board.id, taskId: task.id, columnId: task.columnId })} onCreate={columnId => setDetail({ boardId: board.id, taskId: null, columnId })} onRemove={task => setConfirmation({ kind: 'task', boardId: board.id, id: task.id, name: task.title })} onMove={(taskId, columnId, beforeTaskId) => { void mutate(() => client.moveTask(board.id, taskId, columnId, beforeTaskId), 'moved'); }} onColumn={value => setColumn({ boardId: board.id, value: value ?? null })} onRemoveColumn={value => setConfirmation({ kind: 'column', boardId: board.id, id: value.id, name: value.name })} onReorderColumns={ids => mutate(() => client.reorderColumns(board.id, ids))} />
      : <div className={styles.empty}><EmptyBoardIllustration /><h2>{t('noBoards')}</h2><p>{t('emptyDescription')}</p><Button size="sm" onClick={() => setDialog({ kind: 'create' })}><Plus size={15} />{t('createBoard')}</Button><span className={styles.emptyPrivacy}><LockSimple size={12} />{t('privateDefault')}</span></div>}
    {dialog?.kind === 'create' && <TaskBoardForm onClose={() => setDialog(null)} onSubmit={async draft => { const ok = await mutate(async () => { const next = await client.create(draft); setSelectedId(next.id); return next; }); return ok; }} />}
    {dialog?.kind === 'settings' && board && dialog.boardId === board.id && <TaskBoardForm key={`settings:${board.id}`} board={board} onClose={() => setDialog(null)} onSubmit={draft => mutate(() => client.update(dialog.boardId, draft))} />}
    {column && board && column.boardId === board.id && <TaskColumnForm key={column.value?.id ?? `${column.boardId}:new`} column={column.value ?? undefined} onClose={() => setColumn(null)} onSubmit={draft => mutate(() => column.value ? client.updateColumn(column.boardId, column.value.id, draft) : client.addColumn(column.boardId, draft))} />}
    {detail && board && detail.boardId === board.id && (!detail.taskId || board.tasks.some(task => task.id === detail.taskId)) && <TaskDetail key={`${board.id}:${detail.taskId ?? `new:${detail.columnId}`}`} board={board} task={board.tasks.find(task => task.id === detail.taskId) ?? null} columnId={detail.columnId} actorId={actorId} client={client} onClose={() => setDetail(null)} onSave={saveTask} onDelete={taskId => mutate(() => client.removeTask(detail.boardId, taskId), 'deleted')} onCommentsChanged={refresh} />}
    {confirmation && confirmation.boardId === board?.id && <TaskConfirm title={t(confirmation.kind === 'board' ? 'removeBoard' : confirmation.kind === 'task' ? 'removeTask' : 'removeColumn')} description={t(confirmation.kind === 'board' ? 'removeBoardDescription' : confirmation.kind === 'task' ? 'removeTaskDescription' : 'removeColumnDescription', { name: confirmation.name })} onConfirm={removeConfirmed} onClose={() => setConfirmation(null)} />}
  </section>;
}

function TaskBoardWorkspace({ board, actorId, onSettings, onRemoveBoard, onSaveTask, onSchedule, onMoveTasks, ...actions }: { board: TaskBoardDetail; actorId: string; refreshing: boolean; onRefresh: () => void; onSettings: () => void; onRemoveBoard: () => void; onSaveTask: (draft: TaskDraft, original?: BoardTask) => Promise<boolean>; onSchedule: (task: BoardTask, schedule: TaskSchedule | null) => Promise<boolean>; onMoveTasks: (taskIds: string[], columnId: string) => Promise<boolean> } & Omit<React.ComponentProps<typeof KanbanBoard>, 'board' | 'tasks' | 'canDrag'>) {
  const { t } = useTranslation(messages);
  const [filters, setFilters] = usePageSessionState<TaskFilters>(`tasks:${board.id}:filters`, emptyTaskFilters);
  const [sort, setSort] = usePageSessionState<TaskSort>(`tasks:${board.id}:sort`, 'manual');
  const [view, setView] = usePageSessionState<TaskBoardView>(`tasks:${board.id}:view`, 'kanban');
  const tasks = selectTasks(board, filters, sort, actorId);
  const filtered = hasTaskFilters(filters);
  const canDrag = board.permission !== 'viewer' && !filtered && sort === 'manual';
  return <>
    <TaskBoardToolbar board={board} actorId={actorId} filters={filters} onFilters={setFilters} sort={sort} onSort={setSort} onRefresh={actions.onRefresh} refreshing={actions.refreshing} busy={actions.busy} onCreate={() => actions.onCreate(board.columns[0].id)} onCreateColumn={() => actions.onColumn()} onSettings={onSettings} onRemoveBoard={onRemoveBoard} view={view} onView={setView} />
    {board.permission === 'viewer' && <p className={styles.permissionNote}><LockSimple size={12} />{t('readOnlyDescription')}</p>}
    {filtered && <div className={styles.resultCount}>{t('visibleCount', { count: tasks.length, total: board.tasks.length })}{tasks.length === 0 && <strong>{t('noMatches')}</strong>}</div>}
    {view === 'calendar' ? <TaskCalendar board={board} tasks={tasks} busy={actions.busy} onSave={onSaveTask} onSchedule={onSchedule} onDetails={actions.onOpen} />
      : view === 'spreadsheet' ? <TaskTable board={board} tasks={tasks} busy={actions.busy} onOpen={actions.onOpen} onCreate={actions.onCreate} onRemove={actions.onRemove} onMoveTasks={onMoveTasks} />
      : <KanbanBoard board={board} tasks={tasks} canDrag={canDrag} {...actions} />}
    {view === 'kanban' && board.permission !== 'viewer' && !canDrag && <p className={styles.dragNote}>{t('filteredDrag')}</p>}
  </>;
}

function EmptyBoardIllustration() {
  return <div className={styles.emptyIllustration} aria-hidden>{['slate', 'blue', 'green'].map((color, index) => <div key={color}><span className={styles.statusDot} data-color={color} /><i /><span className={styles.illustrationCard}><Kanban size={index === 1 ? 21 : 17} weight="duotone" /><i /><i /></span>{index !== 2 && <span className={styles.illustrationCard}><i /><i /></span>}</div>)}</div>;
}
function BoardSkeleton() {
  const { t } = useTranslation(messages);
  return <div className={styles.skeleton} role="status" aria-label={t('loading')}>{[0, 1, 2, 3].map(index => <div key={index}><i /><span /><span /></div>)}</div>;
}
