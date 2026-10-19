import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createBoardTaskInputSchema, createTaskBoardInputSchema, createTaskBoardViewInputSchema, createTaskColumnInputSchema, createTaskCommentInputSchema, moveBoardTaskInputSchema,
  reorderTaskColumnsInputSchema, setTaskBoardMemberInputSchema, taskBoardScopeSchema, taskColumnScopeSchema, taskCommentScopeSchema,
  taskProjectScopeSchema, taskScopeSchema, taskBoardViewScopeSchema, TASK_BOARD_VIEW_LIMIT, updateBoardTaskInputSchema, updateTaskBoardInputSchema, updateTaskBoardViewInputSchema, updateTaskColumnInputSchema } from '@fouc/shared/tasks';
import type { TaskBoardPermission, TaskBoardSummary, TaskBoardView, TaskChecklistItem } from '@fouc/shared/tasks';
import { entityIdSchema } from '@fouc/shared/resources';
import { boardTask, projectMember, taskBoard, taskBoardMember, taskColumn, taskComment } from '../../platform/database/resources/schema';
import { withProject } from '../../platform/database/resources/transaction';
import type { FoucIdentity } from '../../platform/identity/identity';
import { parseInput, ResourceRequestError } from '../../platform/resources/errors';
import { boardWhere, requireTaskProject, withTaskBoard } from './access';
import type { TaskBoardContext } from './access';
import { boardSummary, commentsForTask, projectTaskMembers, taskBoardDetail, taskBoardMembers } from './detail';
import { taskRequest } from './input';

const memberScope = taskBoardScopeSchema.extend({ userId: entityIdSchema });
const taskCondition = (context: TaskBoardContext, taskId?: string) => and(eq(boardTask.projectId, context.board.projectId), eq(boardTask.boardId, context.board.id), taskId ? eq(boardTask.id, taskId) : undefined);
const columnCondition = (context: TaskBoardContext, columnId?: string) => and(eq(taskColumn.projectId, context.board.projectId), eq(taskColumn.boardId, context.board.id), columnId ? eq(taskColumn.id, columnId) : undefined);

async function requireColumn(context: TaskBoardContext, columnId: string) {
  const [column] = await context.db.select().from(taskColumn).where(columnCondition(context, columnId));
  if (!column) throw new ResourceRequestError('TASK_COLUMN_NOT_FOUND', '当前看板中不存在此任务列。', 404);
  return column;
}

async function requireTask(context: TaskBoardContext, taskId: string) {
  const [task] = await context.db.select().from(boardTask).where(taskCondition(context, taskId));
  if (!task) throw new ResourceRequestError('TASK_NOT_FOUND', '当前看板中不存在此任务。', 404);
  return task;
}

async function validateAssignees(context: TaskBoardContext, ids: string[]) {
  // Hold live membership before computing the eligible set.
  if (ids.length) {
    const locked = await context.db.select().from(projectMember).where(and(eq(projectMember.projectId, context.board.projectId), inArray(projectMember.userId, ids))).for('share');
    if (locked.length !== new Set(ids).size) throw new ResourceRequestError('INVALID_INPUT', '只能分配给当前项目成员。', 400);
  }
  const members = await taskBoardMembers(context.db, context.board);
  const eligible = new Set(members.map(member => member.userId));
  if (ids.some(id => !eligible.has(id))) throw new ResourceRequestError('INVALID_INPUT', '只能分配给拥有当前看板访问权限的项目成员。', 400);
}

const checklist = (items: z.output<typeof createBoardTaskInputSchema>['checklist']): TaskChecklistItem[] => items.map(item => ({ ...item, id: item.id ?? randomUUID() }));

async function nextTaskPosition(context: TaskBoardContext, columnId: string) {
  const [last] = await context.db.select({ position: boardTask.position }).from(boardTask)
    .where(and(taskCondition(context), eq(boardTask.columnId, columnId))).orderBy(desc(boardTask.position)).limit(1);
  return (last?.position ?? 0) + 1;
}

async function reorderTasks(context: TaskBoardContext, columnId: string, ids: string[]) {
  if (!ids.length) return;
  const values = sql.join(ids.map((id, index) => sql`(${id}::uuid, ${index + 1}::double precision)`), sql`, `);
  await context.db.execute(sql`UPDATE resources.board_task AS t SET column_id = ${columnId}::uuid, position = ordered.position
    FROM (VALUES ${values}) AS ordered(id, position)
    WHERE t.project_id = ${context.board.projectId}::uuid AND t.board_id = ${context.board.id}::uuid AND t.id = ordered.id`);
}

async function saveViews(context: TaskBoardContext, views: TaskBoardView[]) {
  const result = await context.db.execute<{ updated: boolean }>(sql`SELECT resources.update_task_board_views(${context.board.projectId}::uuid, ${context.board.id}::uuid, ${JSON.stringify(views)}::jsonb) AS updated`);
  if (!result.rows[0]?.updated) throw new ResourceRequestError('FORBIDDEN', '当前看板为只读，请联系创建人授予编辑权限。', 403);
  const [board] = await context.db.select().from(taskBoard).where(boardWhere(context.board));
  return taskBoardDetail({ ...context, board: board! });
}

export function createTaskBoardService(pool: Pool) {
  return {
    async list(identity: FoucIdentity, input: unknown) {
      const { projectId } = parseInput(taskProjectScopeSchema, input);
      return withProject(pool, projectId, identity.sessionId, async db => {
        await requireTaskProject(db, identity, projectId);
        const rows = await db.select({ board: taskBoard,
          permission: sql<TaskBoardPermission>`resources.task_board_permission(${taskBoard.projectId}, ${taskBoard.id})`,
          taskCount: sql<number>`(SELECT count(*)::int FROM resources.board_task t WHERE t.project_id = task_board.project_id AND t.board_id = task_board.id)`,
          completedCount: sql<number>`(SELECT count(*)::int FROM resources.board_task t JOIN resources.task_column c ON c.project_id=t.project_id AND c.board_id=t.board_id AND c.id=t.column_id WHERE t.project_id=task_board.project_id AND t.board_id=task_board.id AND c.is_done)`,
          activityAt: sql<Date>`greatest(${taskBoard.updatedAt}, (SELECT max(t.updated_at) FROM resources.board_task t WHERE t.project_id=task_board.project_id AND t.board_id=task_board.id))`,
        }).from(taskBoard).where(eq(taskBoard.projectId, projectId)).orderBy(desc(taskBoard.updatedAt), asc(taskBoard.id));
        const items: TaskBoardSummary[] = rows.map(({ board, permission, taskCount, completedCount, activityAt }) => boardSummary(board, permission, taskCount, completedCount, activityAt));
        return { items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) };
      });
    },
    async projectMembers(identity: FoucIdentity, input: unknown) {
      const { projectId } = parseInput(taskProjectScopeSchema, input);
      return withProject(pool, projectId, identity.sessionId, async db => {
        await requireTaskProject(db, identity, projectId);
        return { items: await projectTaskMembers(db, projectId) };
      });
    },
    async create(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskProjectScopeSchema, createTaskBoardInputSchema, input);
      return withProject(pool, scope.projectId, identity.sessionId, async db => {
        const actor = await requireTaskProject(db, identity, scope.projectId, true);
        const id = randomUUID();
        await db.insert(taskBoard).values({ ...data, id, projectId: scope.projectId, ownerId: actor.userId });
        const [board] = await db.select().from(taskBoard).where(and(eq(taskBoard.projectId, scope.projectId), eq(taskBoard.id, id)));
        await db.insert(taskColumn).values([
          { name: '待处理', color: 'slate' as const, isDone: false }, { name: '进行中', color: 'blue' as const, isDone: false },
          { name: '待审核', color: 'amber' as const, isDone: false }, { name: '已完成', color: 'green' as const, isDone: true },
        ].map((column, index) => ({ ...column, id: randomUUID(), projectId: scope.projectId, boardId: id, position: index + 1 })));
        return taskBoardDetail({ db, board: board!, userId: actor.userId, permission: 'owner' });
      });
    },
    async get(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskBoardScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'read', taskBoardDetail);
    },
    async update(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardScopeSchema, updateTaskBoardInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'owner', async context => {
        const [board] = await context.db.update(taskBoard).set({ ...data, updatedAt: new Date() }).where(boardWhere(context.board)).returning();
        // Private has one reader; discard assignments that would expose no work to their assignees.
        if (data.visibility === 'private') {
          await context.db.delete(taskBoardMember).where(and(eq(taskBoardMember.projectId, scope.projectId), eq(taskBoardMember.boardId, scope.boardId)));
          await context.db.execute(sql`UPDATE resources.board_task SET assignee_ids = ARRAY(SELECT a FROM unnest(assignee_ids) a WHERE a=${context.userId}::uuid) WHERE project_id=${scope.projectId}::uuid AND board_id=${scope.boardId}::uuid`);
        }
        if (data.visibility === 'invited' && context.board.visibility === 'project') {
          const members = await taskBoardMembers(context.db, board!);
          const eligible = members.map(member => member.userId);
          await context.db.execute(sql`UPDATE resources.board_task SET assignee_ids = ARRAY(SELECT a FROM unnest(assignee_ids) a WHERE a=ANY(${eligible}::uuid[])) WHERE project_id=${scope.projectId}::uuid AND board_id=${scope.boardId}::uuid`);
        }
        return taskBoardDetail({ ...context, board: board! });
      });
    },
    async remove(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskBoardScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'owner', async context => {
        await context.db.delete(taskBoard).where(boardWhere(context.board));
        return { removed: true as const };
      });
    },
    async setMember(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardScopeSchema, setTaskBoardMemberInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'owner', async context => {
        if (context.board.visibility === 'private') throw new ResourceRequestError('INVALID_INPUT', '请先将看板调整为项目可见或受邀成员可见。', 400);
        if (data.userId === context.board.ownerId) throw new ResourceRequestError('INVALID_INPUT', '创建人的权限不能变更。', 400);
        const [member] = await context.db.select().from(projectMember).where(and(eq(projectMember.projectId, scope.projectId), eq(projectMember.userId, data.userId))).for('share');
        if (!member) throw new ResourceRequestError('MEMBER_NOT_FOUND', '只能邀请当前项目中的成员。', 404);
        await context.db.insert(taskBoardMember).values({ ...scope, ...data }).onConflictDoUpdate({ target: [taskBoardMember.projectId, taskBoardMember.boardId, taskBoardMember.userId], set: { role: data.role } });
        return taskBoardDetail(context);
      });
    },
    async removeMember(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(memberScope, input);
      return withTaskBoard(pool, identity, scope, 'owner', async context => {
        if (scope.userId === context.board.ownerId) throw new ResourceRequestError('INVALID_INPUT', '不能移除看板创建人。', 400);
        const [removed] = await context.db.delete(taskBoardMember).where(and(eq(taskBoardMember.projectId, scope.projectId), eq(taskBoardMember.boardId, scope.boardId), eq(taskBoardMember.userId, scope.userId))).returning();
        if (!removed) throw new ResourceRequestError('MEMBER_NOT_FOUND', '该成员没有单独授予的看板权限。', 404);
        if (context.board.visibility === 'invited') await context.db.execute(sql`UPDATE resources.board_task SET assignee_ids=array_remove(assignee_ids, ${scope.userId}::uuid) WHERE project_id=${scope.projectId}::uuid AND board_id=${scope.boardId}::uuid`);
        return taskBoardDetail(context);
      });
    },
    async createView(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardScopeSchema, createTaskBoardViewInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        if (context.board.views.length >= TASK_BOARD_VIEW_LIMIT) throw new ResourceRequestError('INVALID_INPUT', `一个看板最多可创建 ${TASK_BOARD_VIEW_LIMIT} 个视图。`, 400);
        const views = [...context.board.views, { ...data, id: randomUUID() }];
        return saveViews(context, views);
      });
    },
    async updateView(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardViewScopeSchema, updateTaskBoardViewInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        if (!context.board.views.some(view => view.id === scope.viewId)) throw new ResourceRequestError('TASK_VIEW_NOT_FOUND', '当前看板中不存在此视图。', 404);
        const views = context.board.views.map(view => view.id === scope.viewId ? { ...view, name: data.name } : view);
        return saveViews(context, views);
      });
    },
    async removeView(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskBoardViewScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        if (!context.board.views.some(view => view.id === scope.viewId)) throw new ResourceRequestError('TASK_VIEW_NOT_FOUND', '当前看板中不存在此视图。', 404);
        const views = context.board.views.filter(view => view.id !== scope.viewId);
        return saveViews(context, views);
      });
    },
    async createColumn(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardScopeSchema, createTaskColumnInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        const columns = await context.db.select().from(taskColumn).where(columnCondition(context)).orderBy(desc(taskColumn.position));
        if (columns.length >= 24) throw new ResourceRequestError('INVALID_INPUT', '一个看板最多可创建 24 列。', 400);
        await context.db.insert(taskColumn).values({ ...scope, ...data, id: randomUUID(), position: (columns[0]?.position ?? 0) + 1 });
        return taskBoardDetail(context);
      });
    },
    async updateColumn(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskColumnScopeSchema, updateTaskColumnInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        await requireColumn(context, scope.columnId);
        await context.db.update(taskColumn).set(data).where(columnCondition(context, scope.columnId));
        return taskBoardDetail(context);
      });
    },
    async reorderColumns(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardScopeSchema, reorderTaskColumnsInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        const columns = await context.db.select({ id: taskColumn.id }).from(taskColumn).where(columnCondition(context));
        if (columns.length !== data.columnIds.length || columns.some(column => !data.columnIds.includes(column.id))) throw new ResourceRequestError('INVALID_INPUT', '列排序必须包含当前看板中的全部列。', 400);
        const values = sql.join(data.columnIds.map((id, index) => sql`(${id}::uuid, ${index + 1}::double precision)`), sql`, `);
        await context.db.execute(sql`UPDATE resources.task_column AS c SET position=ordered.position FROM (VALUES ${values}) AS ordered(id,position) WHERE c.project_id=${scope.projectId}::uuid AND c.board_id=${scope.boardId}::uuid AND c.id=ordered.id`);
        return taskBoardDetail(context);
      });
    },
    async removeColumn(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskColumnScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        await requireColumn(context, scope.columnId);
        const columns = await context.db.select({ id: taskColumn.id }).from(taskColumn).where(columnCondition(context));
        if (columns.length === 1) throw new ResourceRequestError('INVALID_INPUT', '看板至少需要保留一列。', 400);
        const [task] = await context.db.select({ id: boardTask.id }).from(boardTask).where(and(taskCondition(context), eq(boardTask.columnId, scope.columnId))).limit(1);
        if (task) throw new ResourceRequestError('TASK_COLUMN_NOT_EMPTY', '请先移动或删除此列中的任务。', 409);
        await context.db.delete(taskColumn).where(columnCondition(context, scope.columnId));
        return taskBoardDetail(context);
      });
    },
    async createTask(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskBoardScopeSchema, createBoardTaskInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        await requireColumn(context, data.columnId);
        await validateAssignees(context, data.assigneeIds);
        const allocated = await context.db.execute<{ number: number }>(sql`SELECT resources.allocate_task_number(${scope.projectId}::uuid, ${scope.boardId}::uuid) AS number`);
        const number = allocated.rows[0]!.number;
        await context.db.insert(boardTask).values({ ...scope, ...data, id: randomUUID(), number, checklist: checklist(data.checklist), assigneeIds: [...new Set(data.assigneeIds)], labels: [...new Set(data.labels)], position: await nextTaskPosition(context, data.columnId), createdBy: context.userId });
        return taskBoardDetail(context);
      });
    },
    async updateTask(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskScopeSchema, updateBoardTaskInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        const task = await requireTask(context, scope.taskId);
        if (data.columnId) await requireColumn(context, data.columnId);
        if (data.assigneeIds) await validateAssignees(context, data.assigneeIds);
        const { checklist: items, ...fields } = data;
        await context.db.update(boardTask).set({ ...fields, updatedAt: new Date(),
          ...(data.assigneeIds ? { assigneeIds: [...new Set(data.assigneeIds)] } : {}),
          ...(data.labels ? { labels: [...new Set(data.labels)] } : {}),
          ...(items ? { checklist: checklist(items) } : {}),
          ...(data.columnId && data.columnId !== task.columnId ? { position: await nextTaskPosition(context, data.columnId) } : {}),
        }).where(taskCondition(context, scope.taskId));
        return taskBoardDetail(context);
      });
    },
    async moveTask(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskScopeSchema, moveBoardTaskInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        const task = await requireTask(context, scope.taskId);
        await requireColumn(context, data.columnId);
        const tasks = await context.db.select({ id: boardTask.id }).from(boardTask).where(and(taskCondition(context), eq(boardTask.columnId, data.columnId))).orderBy(asc(boardTask.position), asc(boardTask.id));
        if (data.beforeTaskId === task.id && task.columnId === data.columnId) return taskBoardDetail(context);
        const ids = tasks.map(task => task.id).filter(id => id !== scope.taskId);
        const index = data.beforeTaskId ? ids.indexOf(data.beforeTaskId) : ids.length;
        if (index < 0) throw new ResourceRequestError('INVALID_INPUT', '目标任务不属于当前目标列。', 400);
        ids.splice(index, 0, task.id);
        await reorderTasks(context, data.columnId, ids);
        await context.db.update(boardTask).set({ updatedAt: new Date() }).where(taskCondition(context, task.id));
        return taskBoardDetail(context);
      });
    },
    async removeTask(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        await requireTask(context, scope.taskId);
        await context.db.delete(boardTask).where(taskCondition(context, scope.taskId));
        return taskBoardDetail(context);
      });
    },
    async comments(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'read', async context => {
        await requireTask(context, scope.taskId);
        return { items: await commentsForTask(context.db, scope) };
      });
    },
    async createComment(identity: FoucIdentity, input: unknown) {
      const { scope, data } = taskRequest(taskScopeSchema, createTaskCommentInputSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        await requireTask(context, scope.taskId);
        const id = randomUUID();
        await context.db.insert(taskComment).values({ ...scope, ...data, id, authorId: context.userId });
        await context.db.update(boardTask).set({ updatedAt: new Date() }).where(taskCondition(context, scope.taskId));
        return (await commentsForTask(context.db, scope)).find(comment => comment.id === id)!;
      });
    },
    async removeComment(identity: FoucIdentity, input: unknown) {
      const scope = parseInput(taskCommentScopeSchema, input);
      return withTaskBoard(pool, identity, scope, 'edit', async context => {
        await requireTask(context, scope.taskId);
        const condition = and(eq(taskComment.projectId, scope.projectId), eq(taskComment.boardId, scope.boardId), eq(taskComment.taskId, scope.taskId), eq(taskComment.id, scope.commentId));
        const [comment] = await context.db.select().from(taskComment).where(condition);
        if (!comment) throw new ResourceRequestError('TASK_NOT_FOUND', '评论不存在。', 404);
        if (context.permission !== 'owner' && comment.authorId !== context.userId) throw new ResourceRequestError('FORBIDDEN', '只能删除自己的评论。', 403);
        await context.db.delete(taskComment).where(condition);
        await context.db.update(boardTask).set({ updatedAt: new Date() }).where(taskCondition(context, scope.taskId));
        return { removed: true as const };
      });
    },
  };
}

export type TaskBoardService = ReturnType<typeof createTaskBoardService>;
