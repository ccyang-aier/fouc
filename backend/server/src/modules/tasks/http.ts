import type { FoucAuth } from '../../platform/identity/service';
import { bodyWithPath, createResourceApi } from '../../platform/resources/http';
import type { TaskBoardService } from './service';

export function createTaskBoardRoutes(auth: FoucAuth, service: TaskBoardService) {
  const base = '/api/projects';
  const boards = `${base}/:projectId/task-boards`;
  const board = `${boards}/:boardId`;
  const app = createResourceApi(auth, base);
  app.get(`${base}/:projectId/task-members`, async context => context.json(await service.projectMembers(context.get('identity'), context.req.param())));
  app.get(boards, async context => context.json(await service.list(context.get('identity'), context.req.param())));
  app.post(boards, async context => context.json(await service.create(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(board, async context => context.json(await service.get(context.get('identity'), context.req.param())));
  app.patch(board, async context => context.json(await service.update(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(board, async context => context.json(await service.remove(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/members`, async context => context.json(await service.setMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/members/:userId`, async context => context.json(await service.removeMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/columns`, async context => context.json(await service.createColumn(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.post(`${board}/columns/reorder`, async context => context.json(await service.reorderColumns(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.patch(`${board}/columns/:columnId`, async context => context.json(await service.updateColumn(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/columns/:columnId`, async context => context.json(await service.removeColumn(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/tasks`, async context => context.json(await service.createTask(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.patch(`${board}/tasks/:taskId`, async context => context.json(await service.updateTask(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/tasks/:taskId/move`, async context => context.json(await service.moveTask(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/tasks/:taskId`, async context => context.json(await service.removeTask(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${board}/tasks/:taskId/comments`, async context => context.json(await service.comments(context.get('identity'), context.req.param())));
  app.post(`${board}/tasks/:taskId/comments`, async context => context.json(await service.createComment(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.delete(`${board}/tasks/:taskId/comments/:commentId`, async context => context.json(await service.removeComment(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  return app;
}
