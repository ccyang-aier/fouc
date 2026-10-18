import { and, eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import type { TaskBoardPermission } from '@fouc/shared/tasks';
import { projectMember, taskBoard, taskBoardMember } from '../../platform/database/resources/schema';
import type { ResourceTransaction } from '../../platform/database/resources/transaction';
import { withProject } from '../../platform/database/resources/transaction';
import type { FoucIdentity } from '../../platform/identity/identity';
import { currentIdentity } from '../../platform/resources/context';
import { ResourceRequestError } from '../../platform/resources/errors';

export type TaskBoardRecord = typeof taskBoard.$inferSelect;
export interface TaskBoardContext {
  db: ResourceTransaction;
  board: TaskBoardRecord;
  userId: string;
  permission: TaskBoardPermission;
}

export async function requireTaskProject(db: ResourceTransaction, identity: FoucIdentity, projectId: string, lock = false) {
  const actor = await currentIdentity(db, identity, lock);
  const query = db.select().from(projectMember).where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, actor.userId)));
  const [member] = await (lock ? query.for('share') : query);
  if (!member) throw new ResourceRequestError('PROJECT_NOT_FOUND', '当前项目不可访问。', 404);
  return actor;
}

export async function permissionFor(db: ResourceTransaction, board: TaskBoardRecord, userId: string): Promise<TaskBoardPermission> {
  if (board.ownerId === userId) return 'owner';
  const [member] = await db.select().from(taskBoardMember).where(and(eq(taskBoardMember.projectId, board.projectId), eq(taskBoardMember.boardId, board.id), eq(taskBoardMember.userId, userId)));
  return member?.role === 'editor' && board.visibility !== 'private' ? 'editor' : 'viewer';
}

/** Board writes serialize on one lock, including ACL changes and task moves.
 * Re-checking after the lock prevents a waiting editor from using revoked access.
 */
export async function withTaskBoard<T>(pool: Pool, identity: FoucIdentity, scope: { projectId: string; boardId: string }, mode: 'read' | 'edit' | 'owner', operation: (context: TaskBoardContext) => Promise<T>) {
  return withProject(pool, scope.projectId, identity.sessionId, async db => {
    const actor = await requireTaskProject(db, identity, scope.projectId, mode !== 'read');
    if (mode !== 'read') await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope.projectId}:${scope.boardId}`}, 0))`);
    const [board] = await db.select().from(taskBoard).where(and(eq(taskBoard.projectId, scope.projectId), eq(taskBoard.id, scope.boardId)));
    if (!board) throw new ResourceRequestError('TASK_BOARD_NOT_FOUND', '看板不存在或你没有访问权限。', 404);
    const permission = await permissionFor(db, board, actor.userId);
    if (mode === 'owner' && permission !== 'owner') throw new ResourceRequestError('FORBIDDEN', '只有看板创建人可以管理看板设置与成员。', 403);
    if (mode === 'edit' && permission === 'viewer') throw new ResourceRequestError('FORBIDDEN', '当前看板为只读，请联系创建人授予编辑权限。', 403);
    return operation({ db, board, userId: actor.userId, permission });
  });
}

export const boardWhere = (board: Pick<TaskBoardRecord, 'projectId' | 'id'>) => and(eq(taskBoard.projectId, board.projectId), eq(taskBoard.id, board.id));
