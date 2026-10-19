import { randomUUID } from 'node:crypto';
import { TASK_COMMENT_IMAGE_LIMIT, TASK_COMMENT_IMAGE_MAX_BYTES } from '@fouc/shared/tasks';
import type { TaskCommentImage } from '@fouc/shared/tasks';
import { ResourceRequestError } from '../../platform/resources/errors';
import type { S3ObjectStorage } from '../../platform/storage/s3';

export interface CommentImageScope { projectId: string; boardId: string; taskId: string; commentId: string }
export type TaskCommentImageStorage = Pick<S3ObjectStorage, 'putObject' | 'openObject' | 'deleteObject'>;

export function commentImageKey(scope: CommentImageScope, imageId: string) {
  return `tasks/${scope.projectId}/${scope.boardId}/${scope.taskId}/${scope.commentId}/${imageId}`;
}

function imageMime(bytes: Uint8Array): TaskCommentImage['mime'] | undefined {
  const starts = (signature: number[], offset = 0) => signature.every((value, index) => bytes[index + offset] === value);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
}

export async function prepareCommentImages(files: readonly File[]) {
  if (files.length > TASK_COMMENT_IMAGE_LIMIT) throw new ResourceRequestError('INVALID_INPUT', '每条评论最多添加 4 张图片。', 400);
  // Check every size before allocating image buffers.
  if (files.some(file => !file.size || file.size > TASK_COMMENT_IMAGE_MAX_BYTES)) {
    throw new ResourceRequestError('INVALID_INPUT', '每张图片需大于 0 字节且不超过 5 MB。', 400);
  }
  const images: { metadata: TaskCommentImage; bytes: Uint8Array }[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = imageMime(bytes);
    if (!mime || (file.type && file.type !== mime)) throw new ResourceRequestError('INVALID_INPUT', '请选择 PNG、JPEG、GIF 或 WebP 图片。', 400);
    const name = file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!name || name.length > 255) throw new ResourceRequestError('INVALID_INPUT', '图片名称需为 1 至 255 个字符。', 400);
    images.push({ metadata: { id: randomUUID(), name, mime, size: bytes.byteLength }, bytes });
  }
  return images;
}

/** Only called after a committed removal or after an upload transaction failed. */
export async function removeCommentImageObjects(storage: TaskCommentImageStorage | undefined, keys: readonly string[]) {
  if (!storage || !keys.length) return;
  const results = await Promise.allSettled(keys.map(key => storage.deleteObject(key)));
  if (results.some(result => result.status === 'rejected')) console.error('[tasks] Comment image cleanup failed.');
}
