import {
  MONGO_DOCUMENT_TRANSFER_LIMITS as LIMITS,
  type MongoDocumentExportInput,
  type MongoDocumentExportProgress,
} from '@fouc/shared/mongo-document-transfer';
import { getBackendEndpoint } from '@/lib/backend';

type SaveWriter = { write: (chunk: Uint8Array) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> };
type SaveHandle = { createWritable: () => Promise<SaveWriter> };
type Picker = (options: { suggestedName: string }) => Promise<SaveHandle>;

export async function consumeMongoDocumentExport(
  stream: ReadableStream<Uint8Array>, writer: SaveWriter | null, signal: AbortSignal,
  onProgress: (value: MongoDocumentExportProgress) => void,
): Promise<Uint8Array<ArrayBuffer>[]> {
  const reader = stream.getReader(), parts: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0, documents = 0;
  const abort = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.throwIfAborted();
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > (writer ? LIMITS.exportBytes : LIMITS.browserBytes)) {
        throw new Error(writer ? '导出达到 1 GiB 上限，文件不完整' : '浏览器下载回退最多 64 MiB，已停止读取；请缩小范围或使用支持流式保存的浏览器');
      }
      for (const byte of chunk.value) if (byte === 10) documents++;
      if (writer) await writer.write(chunk.value);
      else parts.push(new Uint8Array(chunk.value));
      onProgress({ bytes, documents });
    }
    await writer?.close();
    return parts;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await writer?.abort().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); signal.removeEventListener('abort', abort); }
}

export async function downloadMongoDocuments(
  base: string, input: MongoDocumentExportInput, signal: AbortSignal,
  onProgress: (value: MongoDocumentExportProgress) => void,
): Promise<'disk' | 'browser'> {
  const picker = (window as Window & { showSaveFilePicker?: Picker }).showSaveFilePicker;
  const suggestedName = `${input.database}-${input.collection}.ndjson`.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_').slice(0, 180);
  const handle = picker ? await picker({ suggestedName }) : null;
  signal.throwIfAborted();
  const endpoint = await getBackendEndpoint();
  const response = await fetch(`${endpoint.baseUrl}${base}/documents/export`, {
    method: 'POST', body: JSON.stringify(input), signal,
    headers: { 'content-type': 'application/json', ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}) },
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(failure?.error?.message ?? `MongoDB 文档导出请求失败 (${response.status})`);
  }
  if (!response.body) throw new Error('浏览器没有提供可读取的下载流');
  let writer: SaveWriter | null = null;
  try {
    writer = handle ? await handle.createWritable() : null;
    const chunks = await consumeMongoDocumentExport(response.body, writer, signal, onProgress);
    if (!writer) {
      signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob(chunks, { type: 'application/octet-stream' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName;
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
