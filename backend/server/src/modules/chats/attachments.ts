import { CHANNEL_FILE_LIMIT, CHANNEL_FILE_MAX_BYTES, CHANNEL_FILE_TOTAL_MAX_BYTES } from '@fouc/shared/chats';
import type { StoredChannelAttachment } from '../../platform/database/resources/schema/chats';
import type { S3ObjectStorage } from '../../platform/storage/s3';
import { ResourceRequestError } from '../../platform/resources/errors';

export async function uploadChannelFiles(storage: S3ObjectStorage | undefined, scope: { projectId: string; channelId: string; messageId: string }, files: File[]): Promise<StoredChannelAttachment[]> {
  if (files.length > CHANNEL_FILE_LIMIT) throw new ResourceRequestError('INVALID_INPUT', '一次最多发送 8 个附件。', 400);
  if (files.some(file => file.size <= 0 || file.size > CHANNEL_FILE_MAX_BYTES)) throw new ResourceRequestError('INVALID_INPUT', '附件需要大于 0 且不超过 20 MB。', 400);
  if (files.reduce((total, file) => total + file.size, 0) > CHANNEL_FILE_TOTAL_MAX_BYTES) throw new ResourceRequestError('INVALID_INPUT', '一次发送的附件总大小不能超过 80 MB。', 400);
  if (!files.length) return [];
  if (!storage) throw new ResourceRequestError('INVALID_INPUT', '文件存储暂不可用，请稍后重试。', 400);
  const attachments: StoredChannelAttachment[] = [];
  try {
    for (const file of files) {
      const id = crypto.randomUUID();
      const name = file.name.replace(/[\r\n\u0000/\\]/g, '_').slice(0, 255) || 'attachment';
      const mime = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : 'application/octet-stream';
      const objectKey = `projects/${scope.projectId}/channels/${scope.channelId}/${scope.messageId}/${id}`;
      await storage.putObject(objectKey, new Uint8Array(await file.arrayBuffer()), mime);
      attachments.push({ id, name, mime, size: file.size, messageId: scope.messageId, createdAt: new Date().toISOString(), objectKey });
    }
    return attachments;
  } catch (error) {
    await cleanupChannelFiles(storage, attachments);
    throw error;
  }
}
export async function cleanupChannelFiles(storage: S3ObjectStorage | undefined, files: StoredChannelAttachment[]) {
  if (!storage) return;
  await Promise.all(files.map(file => storage.deleteObject(file.objectKey).catch(() => false)));
}
export async function openChannelFile(storage: S3ObjectStorage | undefined, attachment: StoredChannelAttachment): Promise<Response> {
  if (!storage) throw new ResourceRequestError('INVALID_INPUT', '文件存储暂不可用。', 400);
  const object = await storage.openObject(attachment.objectKey);
  const headers = new Headers({ 'Content-Type': attachment.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}` });
  return new Response(object.body, { status: 200, headers });
}
