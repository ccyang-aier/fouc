import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { hasTrustedKnowledgeOrigin } from '../auth/config';
import { requireKnowledgeIdentity } from '../auth/identity';
import type { KnowledgeIdentity } from '../auth/identity';
import type { KnowledgeAuth } from '../auth/service';
import { OrganizationError, organizationFailure } from './errors';
import type { OrganizationService } from './service';

type OrganizationEnvironment = { Variables: { identity: KnowledgeIdentity } };
const base = '/api/knowledge/workspaces';

async function bodyWithPath(context: Context, path: Record<string, string> = {}) {
  let body: unknown;
  try { body = await context.req.json(); } catch { throw new OrganizationError('INVALID_INPUT', 'A JSON object is required.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(path).some((key) => key in body)) {
    throw new OrganizationError('INVALID_INPUT', 'Request scope must be provided only in the URL.', 400);
  }
  return { ...body, ...path };
}

function pagination(context: Context) {
  const values = context.req.query();
  return { ...values, ...(values.limit === undefined ? {} : { limit: Number(values.limit) }) };
}

/** Mount at / before the legacy bearer catch-all; session-only, never PAT discovery. */
export function createOrganizationRoutes(auth: KnowledgeAuth, service: OrganizationService) {
  const app = new Hono<OrganizationEnvironment>();
  const origins = auth.options.trustedOrigins as string[];
  app.use(`${base}/*`, async (context, next) => {
    context.header('Cache-Control', 'no-store');
    context.header('Referrer-Policy', 'no-referrer');
    if (!hasTrustedKnowledgeOrigin(context.req.raw, origins)) return context.json({ code: 'INVALID_ORIGIN', message: 'A trusted Origin is required.' }, 403);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method) && context.req.header('content-type')?.split(';')[0]?.trim() !== 'application/json') {
      return context.json({ code: 'INVALID_CONTENT_TYPE', message: 'JSON requests are required.' }, 415);
    }
    await next();
  });
  app.use(`${base}/*`, cors({ origin: (origin) => origins.includes(origin) ? origin : undefined, credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 600 }));
  app.use(`${base}/*`, bodyLimit({ maxSize: 16 * 1_024, onError: (context) => context.json({ code: 'PAYLOAD_TOO_LARGE', message: 'Organization request is too large.' }, 413) }));
  app.use(`${base}/*`, requireKnowledgeIdentity(auth));
  app.get(base, async (context) => context.json(await service.listWorkspaces(context.get('identity'), pagination(context))));
  app.post(base, async (context) => context.json(await service.createWorkspace(context.get('identity'), await bodyWithPath(context)), 201));
  app.get(`${base}/:workspaceId`, async (context) => context.json(await service.getWorkspace(context.get('identity'), context.req.param())));
  app.patch(`${base}/:workspaceId`, async (context) => context.json(await service.renameWorkspace(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${base}/:workspaceId/teamspaces`, async (context) => context.json(await service.listTeamspaces(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/teamspaces`, async (context) => context.json(await service.createTeamspace(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(`${base}/:workspaceId/teamspaces/:teamspaceId`, async (context) => context.json(await service.getTeamspace(context.get('identity'), context.req.param())));
  app.patch(`${base}/:workspaceId/teamspaces/:teamspaceId`, async (context) => context.json(await service.updateTeamspace(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:workspaceId/teamspaces/:teamspaceId`, async (context) => context.json(await service.removeTeamspace(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${base}/:workspaceId/members`, async (context) => context.json(await service.listMembers(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.patch(`${base}/:workspaceId/members/:userId`, async (context) => context.json(await service.changeMemberRole(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:workspaceId/members/:userId`, async (context) => context.json(await service.removeMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${base}/:workspaceId/groups`, async (context) => context.json(await service.listGroups(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/groups`, async (context) => context.json(await service.createGroup(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.patch(`${base}/:workspaceId/groups/:id`, async (context) => context.json(await service.renameGroup(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:workspaceId/groups/:groupId`, async (context) => context.json(await service.removeGroup(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${base}/:workspaceId/groups/:groupId/members`, async (context) => context.json(await service.listGroupMembers(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/groups/:groupId/members`, async (context) => context.json(await service.addGroupMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:workspaceId/groups/:groupId/members/:userId`, async (context) => context.json(await service.removeGroupMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${base}/:workspaceId/invitations`, async (context) => context.json(await service.listInvitations(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/invitations`, async (context) => context.json(await service.createInvitation(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.delete(`${base}/:workspaceId/invitations/:invitationId`, async (context) => context.json(await service.revokeInvitation(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${base}/:workspaceId/invitations/:invitationId/accept`, async (context) => context.json(await service.acceptInvitation(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.onError((error, context) => {
    const known = organizationFailure(error);
    return known ? context.json({ code: known.code, message: known.message }, known.status)
      : context.json({ code: 'ORGANIZATION_UNAVAILABLE', message: 'Organization service is temporarily unavailable.', retryable: true }, 503);
  });
  return app;
}
