import { workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import { createKnowledgeRouter, knowledgeQuery } from './procedures';

/** Infrastructure only. Page operations must add P03's page ACL before exposing content or writes. */
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
});

export type KnowledgeApiRouter = typeof knowledgeApiRouter;
