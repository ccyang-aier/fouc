import type { ChannelPermissions, ChannelRole } from '@fouc/shared/chats';
import { ResourceRequestError } from '../../platform/resources/errors';

export function channelManager(role: ChannelRole) { return role === 'owner' || role === 'admin'; }
export function requireChannelManager(role: ChannelRole) {
  if (!channelManager(role)) throw new ResourceRequestError('FORBIDDEN', '只有频道所有者或管理员可以执行此操作。', 403);
}
export function requireChannelCapability(role: ChannelRole, permissions: ChannelPermissions, action: keyof ChannelPermissions) {
  if (permissions[action] === 'admins' && !channelManager(role)) throw new ResourceRequestError('FORBIDDEN', action === 'invite' ? '只有频道管理员可以邀请成员。' : '此频道仅允许管理员发言。', 403);
}
export function requireMessageEditor(actorUserId: string, authorUserId: string, role: ChannelRole, editingBody: boolean) {
  if (actorUserId !== authorUserId && (editingBody || !channelManager(role))) throw new ResourceRequestError('FORBIDDEN', editingBody ? '只能编辑自己发送的消息。' : '无权管理这条消息。', 403);
}
