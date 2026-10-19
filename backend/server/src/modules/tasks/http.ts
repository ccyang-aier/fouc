import type { Context } from 'hono';
import { TASK_COMMENT_IMAGE_LIMIT, TASK_COMMENT_IMAGE_MAX_BYTES } from '@fouc/shared/tasks';
import type { FoucAuth } from '../../platform/identity/service';
import { bodyWithPath, createResourceApi } from '../../platform/resources/http';
import { ResourceRequestError } from '../../platform/resources/errors';
import type { TaskBoardService } from './service';

async function commentBody(context: Context) {
  const scope = context.req.param();
  if (context.req.header('content-type')?.split(';')[0]?.trim() !== 'multipart/form-data') return { input: await bodyWithPath(context, scope), files: [] };
  let form: FormData;
  try { form = await context.req.formData(); }
  catch { throw new ResourceRequestError('INVALID_INPUT', '图片评论需要有效的表单。', 400); }
  if ([...form.keys()].some(key => key !== 'body' && key !== 'images') || form.getAll('body').length > 1) {
    throw new ResourceRequestError('INVALID_INPUT', '评论仅支持正文与图片，资源范围应通过 URL 提供。', 400);
  }
  const body = form.get('body') ?? '';
  const files = form.getAll('images');
  if (typeof body !== 'string' || files.some(file => typeof file === 'string')) throw new ResourceRequestError('INVALID_INPUT', '评论正文与图片格式不正确。', 400);
  return { input: { ...scope, body }, files: files as File[] };
}

export function createTaskBoardRoutes(auth: FoucAuth, service: TaskBoardService) {
  const base = '/api/projects';
  const boards = `${base}/:projectId/task-boards`;
  const board = `${boards}/:boardId`;
  const app = createResourceApi(auth, base, { multipart: { path: /^\/api\/projects\/[^/]+\/task-boards\/[^/]+\/tasks\/[^/]+\/comments\/?$/, maxBytes: TASK_COMMENT_IMAGE_LIMIT * TASK_COMMENT_IMAGE_MAX_BYTES + 128 * 1_024 } });
  app.get(`${base}/:projectId/task-members`, async context => context.json(await service.projectMembers(context.get('identity'), context.req.param())));
  app.get(boards, async context => context.json(await service.list(context.get('identity'), context.req.param())));
  app.post(boards, async context => context.json(await service.create(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(board, async context => context.json(await service.get(context.get('identity'), context.req.param())));
  app.patch(board, async context => context.json(await service.update(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(board, async context => context.json(await service.remove(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/members`, async context => context.json(await service.setMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/members/:userId`, async context => context.json(await service.removeMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/views`, async context => context.json(await service.createView(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.patch(`${board}/views/:viewId`, async context => context.json(await service.updateView(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/views/:viewId`, async context => context.json(await service.removeView(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/columns`, async context => context.json(await service.createColumn(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.post(`${board}/columns/reorder`, async context => context.json(await service.reorderColumns(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.patch(`${board}/columns/:columnId`, async context => context.json(await service.updateColumn(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/columns/:columnId`, async context => context.json(await service.removeColumn(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/tasks`, async context => context.json(await service.createTask(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.patch(`${board}/tasks/:taskId`, async context => context.json(await service.updateTask(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${board}/tasks/:taskId/move`, async context => context.json(await service.moveTask(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${board}/tasks/:taskId`, async context => context.json(await service.removeTask(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${board}/tasks/:taskId/comments`, async context => context.json(await service.comments(context.get('identity'), context.req.param())));
  app.post(`${board}/tasks/:taskId/comments`, async context => {
    const { input, files } = await commentBody(context);
    return context.json(await service.createComment(context.get('identity'), input, files), 201);
  });
  app.get(`${board}/tasks/:taskId/comments/:commentId/images/:imageId`, async context => {
    const image = await service.commentImage(context.get('identity'), context.req.param());
    context.header('Cache-Control', 'private, no-store');
    return image;
  });
  app.delete(`${board}/tasks/:taskId/comments/:commentId`, async context => context.json(await service.removeComment(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  return app;
}
