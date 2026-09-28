import type { FoucAuth } from '../../../platform/identity/service';
import { bodyWithPath, createWorkspaceApi, pagination, workspaceApiBase as base } from '../../workspaces/http-boundary';
import type { KnowledgeCatalogService } from './service';

/** Knowledge bases and their folders are children of the selected workspace. */
export function createKnowledgeCatalogRoutes(auth: FoucAuth, service: KnowledgeCatalogService) {
  const app = createWorkspaceApi(auth);
  app.get(`${base}/:workspaceId/knowledge-bases`, async (context) => context.json(await service.listKnowledgeBases(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/knowledge-bases`, async (context) => context.json(await service.createKnowledgeBase(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(`${base}/:workspaceId/teamspaces`, async (context) => context.json(await service.listTeamspaces(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/teamspaces`, async (context) => context.json(await service.createTeamspace(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(`${base}/:workspaceId/teamspaces/:teamspaceId`, async (context) => context.json(await service.getTeamspace(context.get('identity'), context.req.param())));
  app.patch(`${base}/:workspaceId/teamspaces/:teamspaceId`, async (context) => context.json(await service.updateTeamspace(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:workspaceId/teamspaces/:teamspaceId`, async (context) => context.json(await service.removeTeamspace(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  return app;
}
