import { BackendRequestError, getBackendEndpoint } from '@/lib/backend';
import { isValidationIssue, type ValidationIssue } from '@fouc/shared';
import {
  MONGO_GRIDFS_LIMITS,
  mongoGridFsDownloadName,
  type MongoGridFsFile,
  type MongoGridFsNamespace,
} from '@fouc/shared/mongo-gridfs';
import { createUiMessages } from '../../i18n/ui-message';
import { messages as unitMessages } from '../i18n/gridfs-download';
const { error: uiError } = createUiMessages(unitMessages);

interface SaveTarget {
  createWritable(): Promise<SaveWriter>;
}
interface SaveWriter {
  write(value: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
type SavePicker = (options: { suggestedName: string }) => Promise<SaveTarget>;

/** Count actual HTTP bytes while preserving backpressure; a failed/partial write is never closed as success. */
export async function consumeGridFsDownload(
  body: ReadableStream<Uint8Array>,
  bytes: number,
  writer: SaveWriter | null,
  signal: AbortSignal,
  onProgress: (received: number) => void,
): Promise<BlobPart[]> {
  const reader = body.getReader();
  const parts: BlobPart[] = [];
  let received = 0,
    reported = 0;
  const abort = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > bytes || (!writer && received > MONGO_GRIDFS_LIMITS.browserBufferBytes))
        throw uiError('GridFS 下载超过已核对长度或浏览器内存限额');
      if (writer) await writer.write(value);
      else parts.push(value.slice().buffer);
      const now = performance.now();
      if (now - reported >= 120 || received === bytes) {
        reported = now;
        onProgress(received);
      }
    }
    signal.throwIfAborted();
    if (received !== bytes) throw uiError('GridFS 下载不完整，请重新读取文件后重试');
    if (writer) await writer.close();
    onProgress(received);
    return parts;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await writer?.abort().catch(() => undefined);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export async function downloadMongoGridFs(
  base: string,
  namespace: MongoGridFsNamespace,
  file: MongoGridFsFile,
  signal: AbortSignal,
  onProgress: (received: number) => void,
): Promise<'disk' | 'browser'> {
  if (!file.length || !/^\d+$/.test(file.length)) throw uiError('GridFS 文件没有有效长度');
  const length = BigInt(file.length);
  if (length > BigInt(MONGO_GRIDFS_LIMITS.downloadBytes))
    throw uiError('单文件下载最多 1 GiB；文件详情仍可查看');
  const filename = mongoGridFsDownloadName(file.filename);
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  // Open synchronously within the click gesture, before endpoint resolution and HTTP.
  const target = picker ? await picker.call(window, { suggestedName: filename }) : null;
  if (!target && length > BigInt(MONGO_GRIDFS_LIMITS.browserBufferBytes))
    throw uiError(
      '此浏览器不支持直接流式保存，内存下载最多 64 MiB。请使用支持文件保存的 Chrome / Edge 下载此文件。',
    );
  signal.throwIfAborted();
  const endpoint = await getBackendEndpoint();
  const response = await fetch(`${endpoint.baseUrl}${base}/gridfs/download`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}),
    },
    body: JSON.stringify({ ...namespace, idEjson: file.idEjson }),
    signal,
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; issue?: ValidationIssue };
    } | null;
    if (failure?.error?.message)
      throw new BackendRequestError(
        failure.error.message,
        response.status,
        failure.error.code,
        isValidationIssue(failure.error.issue) ? failure.error.issue : undefined,
      );
    throw uiError('GridFS 下载请求失败 ({v0})', { v0: response.status });
  }
  if (!response.body) throw uiError('当前浏览器未提供可读取的下载流');
  const declaredLength = response.headers.get('content-length');
  // HTTP may use chunked transfer without Content-Length; actual streamed bytes are always checked below.
  if (declaredLength !== null && declaredLength !== file.length) {
    await response.body.cancel().catch(() => undefined);
    throw uiError('文件长度已变化，请刷新列表后重新下载');
  }
  let writer: SaveWriter | null = null;
  try {
    writer = target ? await target.createWritable() : null;
    const parts = await consumeGridFsDownload(
      response.body,
      Number(length),
      writer,
      signal,
      onProgress,
    );
    if (!writer) {
      signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob(parts, { type: 'application/octet-stream' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    return writer ? 'disk' : 'browser';
  } catch (error) {
    await response.body.cancel().catch(() => undefined);
    await writer?.abort().catch(() => undefined);
    throw error;
  }
}
