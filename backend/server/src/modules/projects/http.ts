import type { FoucAuth } from '../../platform/identity/service';
import { bodyWithPath, createWorkspaceApi, pagination, workspaceApiBase as base } from '../workspaces/http-boundary';
import type { ProjectService } from './service';

export function createProjectRoutes(auth: FoucAuth, service: ProjectService) {
  const app = createWorkspaceApi(auth);
  app.get(`${base}/:workspaceId/projects`, async (context) => context.json(await service.list(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}/:workspaceId/projects`, async (context) => context.json(await service.create(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.patch(`${base}/:workspaceId/projects/:projectId`, async (context) => context.json(await service.rename(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:workspaceId/projects/:projectId`, async (context) => context.json(await service.remove(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  return app;
}
