import type { FoucAuth } from '../../platform/identity/service';
import { bodyWithPath, createResourceApi, pagination } from '../../platform/resources/http';
import type { ProjectService } from './service';

export function createProjectRoutes(auth: FoucAuth, service: ProjectService) {
  const base = '/api/projects';
  const app = createResourceApi(auth, base, { path: /^\/api\/projects(?:\/[^/]+)?\/?$/ });
  app.get(`${base}`, async (context) => context.json(await service.list(context.get('identity'), { ...pagination(context), ...context.req.param() })));
  app.post(`${base}`, async (context) => context.json(await service.create(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.patch(`${base}/:projectId`, async (context) => context.json(await service.rename(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${base}/:projectId`, async (context) => context.json(await service.remove(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  return app;
}
