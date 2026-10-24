import type { Context } from 'hono';
import { CHANNEL_FILE_TOTAL_MAX_BYTES } from '@fouc/shared/chats';
import type { FoucAuth } from '../../platform/identity/service';
import { bodyWithPath, createResourceApi } from '../../platform/resources/http';
import { ResourceRequestError } from '../../platform/resources/errors';
import type { ChannelService } from './service';

async function messageBody(context: Context) {
  const scope = context.req.param();
  if (context.req.header('content-type')?.split(';')[0]?.trim() !== 'multipart/form-data') return { input: await bodyWithPath(context, scope), files: [] };
  let form: FormData;
  try { form = await context.req.formData(); } catch { throw new ResourceRequestError('INVALID_INPUT', '附件消息需要有效的表单。', 400); }
  if ([...form.keys()].some(key => key !== 'input' && key !== 'files') || form.getAll('input').length !== 1) throw new ResourceRequestError('INVALID_INPUT', '消息表单格式不正确。', 400);
  const serialized = form.get('input');
  const files = form.getAll('files');
  if (typeof serialized !== 'string' || files.some(file => typeof file === 'string')) throw new ResourceRequestError('INVALID_INPUT', '消息与附件格式不正确。', 400);
  let input: unknown;
  try { input = JSON.parse(serialized); } catch { throw new ResourceRequestError('INVALID_INPUT', '消息格式不正确。', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(scope).some(key => key in input)) throw new ResourceRequestError('INVALID_INPUT', '资源范围只能通过 URL 提供。', 400);
  return { input: { ...input, ...scope }, files: files as File[] };
}
export function createChannelRoutes(auth: FoucAuth, service: ChannelService) {
  const base = '/api/projects';
  const channels = `${base}/:projectId/channels`;
  const channel = `${channels}/:channelId`;
  const app = createResourceApi(auth, base, {
    path: /^\/api\/projects\/[^/]+\/channels(?:\/.*)?\/?$/,
    multipart: { path: /^\/api\/projects\/[^/]+\/channels\/[^/]+\/messages\/?$/, maxBytes: CHANNEL_FILE_TOTAL_MAX_BYTES + 128 * 1024 },
  });
  app.get(channels, async context => context.json(await service.list(context.get('identity'), context.req.param())));
  app.post(channels, async context => context.json(await service.create(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(channel, async context => context.json(await service.get(context.get('identity'), context.req.param())));
  app.patch(channel, async context => context.json(await service.update(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(channel, async context => context.json(await service.remove(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${channel}/members`, async context => context.json(await service.addMembers(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.patch(`${channel}/members/:memberId`, async context => context.json(await service.setMemberRole(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${channel}/members/:memberId`, async context => context.json(await service.removeMember(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${channel}/agents`, async context => context.json(await service.addAgent(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.post(`${channel}/agents/:memberId/messages`, async context => context.json(await service.sendAgentMessage(context.get('identity'), await bodyWithPath(context, context.req.param())), 201));
  app.get(`${channel}/messages`, async context => context.json(await service.messagePage(context.get('identity'), { ...context.req.query(), ...context.req.param() })));
  app.get(`${channel}/assets`, async context => context.json(await service.assets(context.get('identity'), context.req.param())));
  app.post(`${channel}/messages`, async context => {
    const { input, files } = await messageBody(context);
    return context.json(await service.send(context.get('identity'), input, files), 201);
  });
  app.patch(`${channel}/messages/:messageId`, async context => context.json(await service.updateMessage(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.delete(`${channel}/messages/:messageId`, async context => context.json(await service.removeMessage(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${channel}/messages/:messageId/reactions`, async context => context.json(await service.toggleReaction(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.post(`${channel}/messages/:messageId/votes`, async context => context.json(await service.vote(context.get('identity'), await bodyWithPath(context, context.req.param()))));
  app.get(`${channel}/messages/:messageId/attachments/:attachmentId`, async context => service.attachment(context.get('identity'), context.req.param()));
  return app;
}
