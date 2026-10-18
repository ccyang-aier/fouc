import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import type { BoardTask, ProjectTaskMember, TaskBoardDetail, TaskBoardSummary, TaskBoardMember, TaskColumn, TaskComment } from '@fouc/shared/tasks';

export type TaskDraft = Pick<BoardTask, 'columnId' | 'title' | 'description' | 'priority' | 'assigneeIds' | 'labels' | 'dueDate' | 'checklist'>;
export type BoardDraft = Pick<TaskBoardSummary, 'name' | 'description' | 'visibility'>;
export type ColumnDraft = Pick<TaskColumn, 'name' | 'color' | 'isDone'>;

export class TaskBoardError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

/** Only public contracts cross the browser/server boundary; URL owns project scope. */
export function createTaskBoardClient(projectId: string) {
  async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const { origin } = await getFoucApiOrigin();
    const response = await authenticatedFetch(`${origin}/api/projects/${projectId}${path}`, {
      method, signal,
      ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
    });
    const result = await response.json();
    if (!response.ok) throw new TaskBoardError(result.code, result.message, response.status);
    return result as T;
  }
  const base = '/task-boards';
  const board = (id: string) => `${base}/${id}`;
  return {
    async list(signal?: AbortSignal) { return (await request<{ items: TaskBoardSummary[] }>(base, 'GET', undefined, signal)).items; },
    async projectMembers(signal?: AbortSignal) { return (await request<{ items: ProjectTaskMember[] }>('/task-members', 'GET', undefined, signal)).items; },
    get: (id: string, signal?: AbortSignal) => request<TaskBoardDetail>(board(id), 'GET', undefined, signal),
    create: (input: BoardDraft) => request<TaskBoardDetail>(base, 'POST', input),
    update: (id: string, input: Partial<BoardDraft>) => request<TaskBoardDetail>(board(id), 'PATCH', input),
    remove: (id: string) => request<{ removed: true }>(board(id), 'DELETE'),
    setMember: (id: string, userId: string, role: Exclude<TaskBoardMember['role'], 'owner'>) => request<TaskBoardDetail>(`${board(id)}/members`, 'POST', { userId, role }),
    removeMember: (id: string, userId: string) => request<TaskBoardDetail>(`${board(id)}/members/${userId}`, 'DELETE'),
    addColumn: (id: string, input: ColumnDraft) => request<TaskBoardDetail>(`${board(id)}/columns`, 'POST', input),
    updateColumn: (id: string, columnId: string, input: ColumnDraft) => request<TaskBoardDetail>(`${board(id)}/columns/${columnId}`, 'PATCH', input),
    reorderColumns: (id: string, columnIds: string[]) => request<TaskBoardDetail>(`${board(id)}/columns/reorder`, 'POST', { columnIds }),
    removeColumn: (id: string, columnId: string) => request<TaskBoardDetail>(`${board(id)}/columns/${columnId}`, 'DELETE'),
    addTask: (id: string, input: TaskDraft) => request<TaskBoardDetail>(`${board(id)}/tasks`, 'POST', input),
    updateTask: (id: string, taskId: string, input: Partial<TaskDraft>) => request<TaskBoardDetail>(`${board(id)}/tasks/${taskId}`, 'PATCH', input),
    moveTask: (id: string, taskId: string, columnId: string, beforeTaskId: string | null) => request<TaskBoardDetail>(`${board(id)}/tasks/${taskId}/move`, 'POST', { columnId, beforeTaskId }),
    removeTask: (id: string, taskId: string) => request<TaskBoardDetail>(`${board(id)}/tasks/${taskId}`, 'DELETE'),
    async comments(id: string, taskId: string, signal?: AbortSignal) { return (await request<{ items: TaskComment[] }>(`${board(id)}/tasks/${taskId}/comments`, 'GET', undefined, signal)).items; },
    addComment: (id: string, taskId: string, body: string) => request<TaskComment>(`${board(id)}/tasks/${taskId}/comments`, 'POST', { body }),
    removeComment: (id: string, taskId: string, commentId: string) => request<{ removed: true }>(`${board(id)}/tasks/${taskId}/comments/${commentId}`, 'DELETE'),
  };
}
export type TaskBoardClient = ReturnType<typeof createTaskBoardClient>;
