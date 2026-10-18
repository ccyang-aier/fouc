import { and, asc, eq, sql } from 'drizzle-orm';
import type { BoardTask, ProjectTaskMember, TaskBoardDetail, TaskBoardMember, TaskBoardPermission, TaskBoardSummary, TaskComment } from '@fouc/shared/tasks';
import { authUser } from '../../platform/database/identity/schema';
import { boardTask, projectMember, taskBoardMember, taskColumn, taskComment } from '../../platform/database/resources/schema';
import type { ResourceTransaction } from '../../platform/database/resources/transaction';
import type { TaskBoardContext, TaskBoardRecord } from './access';

export async function projectTaskMembers(db: ResourceTransaction, projectId: string): Promise<ProjectTaskMember[]> {
  return db.select({ userId: authUser.id, name: authUser.name, email: authUser.email, image: authUser.image }).from(projectMember)
    .innerJoin(authUser, eq(authUser.id, projectMember.userId)).where(eq(projectMember.projectId, projectId)).orderBy(asc(authUser.name), asc(authUser.id));
}

export async function taskBoardMembers(db: ResourceTransaction, board: TaskBoardRecord): Promise<TaskBoardMember[]> {
  const members = await projectTaskMembers(db, board.projectId);
  const explicit = await db.select().from(taskBoardMember).where(and(eq(taskBoardMember.projectId, board.projectId), eq(taskBoardMember.boardId, board.id)));
  const roles = new Map(explicit.map(member => [member.userId, member.role]));
  return members.filter(member => member.userId === board.ownerId || board.visibility === 'project' || (board.visibility === 'invited' && roles.has(member.userId)))
    .map(member => ({ ...member, role: member.userId === board.ownerId ? 'owner' : roles.get(member.userId) ?? 'viewer' }));
}

export function boardSummary(board: TaskBoardRecord, permission: TaskBoardPermission, taskCount: number, completedCount: number, updatedAt = board.updatedAt): TaskBoardSummary {
  return { id: board.id, projectId: board.projectId, name: board.name, description: board.description, visibility: board.visibility, ownerId: board.ownerId,
    permission, taskCount, completedCount, createdAt: board.createdAt.toISOString(), updatedAt: new Date(updatedAt).toISOString() };
}

export async function taskBoardDetail({ db, board, permission }: TaskBoardContext): Promise<TaskBoardDetail> {
  const condition = and(eq(taskColumn.projectId, board.projectId), eq(taskColumn.boardId, board.id));
  const columns = await db.select({ id: taskColumn.id, name: taskColumn.name, color: taskColumn.color, isDone: taskColumn.isDone, position: taskColumn.position })
    .from(taskColumn).where(condition).orderBy(asc(taskColumn.position), asc(taskColumn.id));
  const rows = await db.select().from(boardTask).where(and(eq(boardTask.projectId, board.projectId), eq(boardTask.boardId, board.id)))
    .orderBy(asc(boardTask.position), asc(boardTask.id));
  const counts = await db.select({ taskId: taskComment.taskId, count: sql<number>`count(*)::int` }).from(taskComment)
    .where(and(eq(taskComment.projectId, board.projectId), eq(taskComment.boardId, board.id))).groupBy(taskComment.taskId);
  const commentCounts = new Map(counts.map(row => [row.taskId, row.count]));
  const members = await taskBoardMembers(db, board);
  const eligible = new Set(members.map(member => member.userId));
  const done = new Set(columns.filter(column => column.isDone).map(column => column.id));
  const tasks: BoardTask[] = rows.map(row => ({ id: row.id, number: row.number, columnId: row.columnId, title: row.title, description: row.description,
    priority: row.priority, assigneeIds: row.assigneeIds.filter(id => eligible.has(id)), labels: row.labels, dueDate: row.dueDate, checklist: row.checklist,
    position: row.position, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), commentCount: commentCounts.get(row.id) ?? 0 }));
  const updatedAt = new Date(Math.max(board.updatedAt.getTime(), ...rows.map(row => row.updatedAt.getTime())));
  return { ...boardSummary(board, permission, tasks.length, tasks.filter(task => done.has(task.columnId)).length, updatedAt), columns, tasks, members };
}

export async function commentsForTask(db: ResourceTransaction, scope: { projectId: string; boardId: string; taskId: string }): Promise<TaskComment[]> {
  const rows = await db.select({ comment: taskComment, authorName: authUser.name, authorImage: authUser.image }).from(taskComment)
    .innerJoin(authUser, eq(authUser.id, taskComment.authorId))
    .where(and(eq(taskComment.projectId, scope.projectId), eq(taskComment.boardId, scope.boardId), eq(taskComment.taskId, scope.taskId)))
    .orderBy(asc(taskComment.createdAt), asc(taskComment.id));
  return rows.map(({ comment, authorName, authorImage }) => ({ id: comment.id, taskId: comment.taskId, authorId: comment.authorId, authorName, authorImage,
    body: comment.body, createdAt: comment.createdAt.toISOString() }));
}
