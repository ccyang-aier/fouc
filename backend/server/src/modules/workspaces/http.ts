import type { FoucAuth } from '../../platform/identity/service';
import { bodyWithPath, createWorkspaceApi, pagination, workspaceApiBase as base } from './http-boundary';
import type { WorkspaceService } from './service';

/** Product-wide workspace, membership, group and invitation routes. */
export function createWorkspaceRoutes(auth: FoucAuth, service: WorkspaceService) {
  const app = createWorkspaceApi(auth);
  app.get(base, async (context) => context.json(await service.listWorkspaces(context.get('identity'), pagination(context))));
  app.post(base, async (context) => context.json(await service.createWorkspace(context.get('identity'), await bodyWithPath(context)), 201));
  app.get(`${base}/:workspaceId`, async (context) => context.json(await service.getWorkspace(context.get('identity'), context.req.param())));
  app.patch(`${base}/:workspaceId`, async (context) => context.json(await service.renameWorkspace(context.get('identity'), await bodyWithPath(context, context.req.param()))));
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
  return app;
}
