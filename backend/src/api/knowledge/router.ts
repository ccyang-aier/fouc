import { pageScopeSchema, permissionLevelSchema, workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import { aiStreamingTaskSelectorSchema, startAiStreamingTaskInputSchema } from '@fouc/shared/knowledge/contracts';
import type { KnowledgeRequestContext } from '../../knowledge/auth';
import { authorizePageAccess } from '../../knowledge/permissions';
import { knowledgeStreamingTasks, toKnowledgeStreamingTrpcError } from '../../knowledge/ai/streaming';
import type { KnowledgeStreamingTasks } from '../../knowledge/ai/streaming';
import { createKnowledgeRouter, knowledgeQuery, knowledgeMutation } from './procedures';
import type { KnowledgeProcedureContext } from './context';

/** Infrastructure plus the P03 page ACL query. Page content and writes arrive with T01+/B01+. */
export const knowledgeApiRouter = createKnowledgeRouter({
  access: knowledgeQuery({
    input: workspaceScopeSchema,
    scopes: ['read'],
    resolve: ({ ctx }) => ({
      workspaceId: ctx.authority.workspaceId,
      userId: ctx.authority.userId,
      role: ctx.authority.role,
      actor: ctx.authority.actor,
      credentialKind: ctx.authority.credential.kind,
      scopes: ctx.authority.scopes,
    }),
  }),
  page: {
    /** One authorization per action. Denied, rebuilding and missing pages share one shape. */
    access: knowledgeQuery({
      input: pageScopeSchema.extend({ action: permissionLevelSchema }),
      scopes: ['read'],
      resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
        const decision = await authorizePageAccess(db, { userId: authority.userId, scope: { workspaceId: input.workspaceId, pageId: input.pageId }, required: input.action });
        if (decision.decision !== 'allow') return { workspaceId: input.workspaceId, pageId: input.pageId, authorized: false, level: null };
        return { workspaceId: input.workspaceId, pageId: input.pageId, authorized: true, level: decision.level };
      }),
    }),
  },
  /**
   * J04 逐块流式 AI 任务（§9.3）。流式内容不经本边界传输——块写入共享 Y.Doc，
   * 客户端经协作通道实时看到逐块出现；这里只承载任务的发起、撤销与状态查询。
   * 服务实例由组合根装配并绑定（`bindKnowledgeStreamingTasks`），未绑定时
   * 返回 SERVICE_UNAVAILABLE。
   */
  aiTask: {
    start: knowledgeMutation({
      input: startAiStreamingTaskInputSchema,
      scopes: ['read', 'write'],
      resolve: ({ ctx, input }) => runStreamingTask(ctx.authority, (tasks) => tasks.start(ctx.authority, input)),
    }),
    cancel: knowledgeMutation({
      input: aiStreamingTaskSelectorSchema,
      scopes: ['read'],
      resolve: ({ ctx, input }) => runStreamingTask(ctx.authority, (tasks) => tasks.cancel(ctx.authority, input)),
    }),
    get: knowledgeQuery({
      input: aiStreamingTaskSelectorSchema,
      scopes: ['read'],
      resolve: ({ ctx, input }) => runStreamingTask(ctx.authority, (tasks) => tasks.get(ctx.authority, input)),
    }),
    revoke: knowledgeMutation({
      input: aiStreamingTaskSelectorSchema,
      scopes: ['read', 'write'],
      resolve: ({ ctx, input }) => runStreamingTask(ctx.authority, (tasks) => tasks.revoke(ctx.authority, input)),
    }),
  },
});

async function runStreamingTask<T>(authority: KnowledgeRequestContext, operation: (tasks: KnowledgeStreamingTasks) => Promise<T>): Promise<T> {
  try {
    return await operation(knowledgeStreamingTasks());
  } catch (error) {
    throw toKnowledgeStreamingTrpcError(error);
  }
}

export type KnowledgeApiRouter = typeof knowledgeApiRouter;
