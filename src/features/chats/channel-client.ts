import type { Channel, ChannelAttachment, ChannelMessagePage, ChannelSnapshot, CreateChannelInput, SendChannelMessageInput, UpdateChannelInput } from '@fouc/shared/chats';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { createTranslator } from '@/lib/i18n';
import { messages } from './channels.messages';
const uiText = createTranslator(messages);

export class ChannelRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

async function request<T>(projectId: string, path = '', method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const { origin } = await getFoucApiOrigin();
  const multipart = body instanceof FormData;
  const response = await authenticatedFetch(`${origin}/api/projects/${encodeURIComponent(projectId)}/channels${path}`, {
    method, signal,
    ...(body === undefined ? {} : multipart ? { body } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  }).catch((cause: unknown) => {
    if (signal?.aborted) throw cause;
    throw new ChannelRequestError(0, 'UNAVAILABLE', uiText('serviceUnavailable'));
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ChannelRequestError(response.status, payload?.code ?? 'UNAVAILABLE', payload?.message ?? 'Channel service is unavailable.');
  return payload as T;
}

export const channelClient = {
  list: (projectId: string, signal?: AbortSignal) => request<{ items: Channel[] }>(projectId, '', 'GET', undefined, signal),
  get: (projectId: string, channelId: string, signal?: AbortSignal) => request<ChannelSnapshot>(projectId, `/${channelId}`, 'GET', undefined, signal),
  history(projectId: string, channelId: string, before?: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ limit: '100', ...(before ? { before } : {}) });
    return request<ChannelMessagePage>(projectId, `/${encodeURIComponent(channelId)}/messages?${query}`, 'GET', undefined, signal);
  },
  assets: (projectId: string, channelId: string, signal?: AbortSignal) => request<{ items: ChannelAttachment[] }>(projectId, `/${encodeURIComponent(channelId)}/assets`, 'GET', undefined, signal),
  create: (projectId: string, input: CreateChannelInput) => request<ChannelSnapshot>(projectId, '', 'POST', input),
  update: (projectId: string, channelId: string, input: UpdateChannelInput) => request<ChannelSnapshot>(projectId, `/${channelId}`, 'PATCH', input),
  remove: (projectId: string, channelId: string) => request<{ ok: boolean }>(projectId, `/${channelId}`, 'DELETE', {}),
  invite: (projectId: string, channelId: string, userIds: string[]) => request<ChannelSnapshot>(projectId, `/${channelId}/members`, 'POST', { userIds }),
  memberRole: (projectId: string, channelId: string, memberId: string, role: 'admin' | 'member') => request<ChannelSnapshot>(projectId, `/${channelId}/members/${memberId}`, 'PATCH', { role }),
  removeMember: (projectId: string, channelId: string, memberId: string) => request<ChannelSnapshot>(projectId, `/${channelId}/members/${memberId}`, 'DELETE', {}),
  leave: (projectId: string, channelId: string, memberId: string) => request<{ ok: boolean }>(projectId, `/${channelId}/members/${memberId}`, 'DELETE', {}),
  addAgent: (projectId: string, channelId: string, input: { installationId: string; name: string; image?: string | null }) => request<ChannelSnapshot>(projectId, `/${channelId}/agents`, 'POST', input),
  agentMessage: (projectId: string, channelId: string, memberId: string, input: { body: string; threadId?: string; execution?: { sessionId: string; runId: string } }) => request<ChannelSnapshot>(projectId, `/${channelId}/agents/${memberId}/messages`, 'POST', input),
  send(projectId: string, channelId: string, input: SendChannelMessageInput, files: File[] = []) {
    if (!files.length) return request<ChannelSnapshot>(projectId, `/${channelId}/messages`, 'POST', input);
    const body = new FormData();
    body.set('input', JSON.stringify(input));
    for (const file of files) body.append('files', file, file.name);
    return request<ChannelSnapshot>(projectId, `/${channelId}/messages`, 'POST', body);
  },
  editMessage: (projectId: string, channelId: string, messageId: string, input: { body?: string; pinned?: boolean; closed?: boolean }) => request<ChannelSnapshot>(projectId, `/${channelId}/messages/${messageId}`, 'PATCH', input),
  removeMessage: (projectId: string, channelId: string, messageId: string) => request<ChannelSnapshot>(projectId, `/${channelId}/messages/${messageId}`, 'DELETE', {}),
  react: (projectId: string, channelId: string, messageId: string, emoji: string) => request<ChannelSnapshot>(projectId, `/${channelId}/messages/${messageId}/reactions`, 'POST', { emoji }),
  vote: (projectId: string, channelId: string, messageId: string, optionId: string) => request<ChannelSnapshot>(projectId, `/${channelId}/messages/${messageId}/votes`, 'POST', { optionId }),
  async attachment(projectId: string, channelId: string, attachment: Pick<ChannelAttachment, 'id' | 'messageId'>): Promise<Blob> {
    const { origin } = await getFoucApiOrigin();
    const response = await authenticatedFetch(`${origin}/api/projects/${projectId}/channels/${channelId}/messages/${attachment.messageId}/attachments/${attachment.id}`);
    if (!response.ok) throw new ChannelRequestError(response.status, 'DOWNLOAD_FAILED', 'The attachment could not be downloaded.');
    return response.blob();
  },
};
