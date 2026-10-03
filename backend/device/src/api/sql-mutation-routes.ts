import { Hono } from 'hono';
import { DatabaseInputError } from '../database/input-error';
import type { RelationalSessionManager } from '../database/relational-session';

/** The enclosing relational router provides authentication and error handling. */
export function sqlMutationRoutes(sessions: RelationalSessionManager) {
  const app = new Hono();
  const plans = '/api/database/workspaces/:workspaceId/relational/sessions/:id/sql-mutation/plans';
  app.post(plans, async c => c.json({
    ok: true,
    data: await sessions.prepareSqlMutation(
      c.req.param('workspaceId')!, c.req.param('id')!,
      await c.req.json().catch(() => null), c.req.raw.signal,
    ),
  }, 201));
  app.delete(plans + '/:planId', c => {
    sessions.discardSqlMutation(
      c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!,
    );
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.post(plans + '/:planId/commit', async c => {
    const input = await c.req.json().catch(() => null);
    if (input?.confirm !== true) throw new DatabaseInputError('请明确确认已审查的 SQL 变更');
    return c.json({
      ok: true,
      data: await sessions.commitSqlMutation(
        c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!,
        c.req.raw.signal,
      ),
    });
  });
  return app;
}
