import { readLocalAsset } from '../assets/local-assets';
import { knowledgeAssetsApi } from '../assets/assets-api';
import type { DocumentFile } from './file-format';

const maximum = 100 * 1024 * 1024;
const tooLarge = () => new Error('预览支持 100 MB 以内的文件，请下载原文件查看。');
export async function readDocumentFile(workspaceId: string, source: 'local' | 'workspace', file: DocumentFile, signal: AbortSignal): Promise<Blob> {
  if (file.size > maximum) throw tooLarge();
  if (source === 'local') {
    const stored = await readLocalAsset(workspaceId, file.source);
    if (!stored) throw new Error('当前浏览器中没有这份原文件，请重新关联。');
    if (stored.blob.size > maximum) throw tooLarge();
    return stored.blob;
  }
  const grant = await knowledgeAssetsApi.download(workspaceId, file.source.slice(6), signal);
  const response = await fetch(grant.url, { signal });
  if (!response.ok) throw new Error('无法读取原文件，请检查访问权限后重试。');
  if (Number(response.headers.get('content-length')) > maximum) { await response.body?.cancel(); throw tooLarge(); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('原文件内容为空。');
  const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value as Uint8Array<ArrayBuffer>);
    }
  } finally { reader.releaseLock(); }
  return new Blob(chunks, { type: file.mime });
}
