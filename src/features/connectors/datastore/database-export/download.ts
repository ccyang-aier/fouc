import { getBackendEndpoint } from '@/lib/backend';

interface SaveTarget {
  name?: string;
  createWritable(): Promise<{ write(value: Uint8Array): Promise<void>; close(): Promise<void>; abort(): Promise<void>; }>;
}
type SavePicker = (options: { suggestedName: string; }) => Promise<SaveTarget>;

/** Download from the authenticated native endpoint; stream to disk where the browser supports it. */
export async function downloadDatabaseExport(
  path: string,
  filename: string,
  bytes: number,
  signal: AbortSignal,
  onProgress: (bytes: number) => void,
  options: { forbiddenFilename?: string; browserBytes?: number } = {},
): Promise<'disk' | 'browser'> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker; }).showSaveFilePicker;
  // A picker must run directly within the user gesture, before waiting for endpoint resolution.
  const target = picker ? await picker.call(window, { suggestedName: filename }) : null;
  if (target?.name && options.forbiddenFilename && target.name.toLowerCase() === options.forbiddenFilename.toLowerCase()) throw new Error('请选与运行数据库不同的备份文件名。');
  const browserBytes = options.browserBytes ?? 256 * 1024 * 1024;
  if (!target && bytes > browserBytes) throw new Error(`当前浏览器不支持流式保存；内存下载最多 ${Math.floor(browserBytes / 1024 / 1024)} MiB，请减小导出范围或使用支持文件保存的 Chrome / Edge。`);
  signal.throwIfAborted();
  const endpoint = await getBackendEndpoint();
  const response = await fetch(`${endpoint.baseUrl}${path}`, { headers: endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}, signal });
  if (!response.ok || !response.body) throw new Error(`导出文件下载失败 (${response.status})。`);
  const reader = response.body.getReader();
  let writable: Awaited<ReturnType<SaveTarget['createWritable']>> | null = null;
  const parts: BlobPart[] = [];
  let received = 0;
  try {
    writable = target ? await target.createWritable() : null;
    for (; ;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > bytes || !writable && received > browserBytes) throw new Error('下载数据超过已确认文件范围。');
      if (writable) await writable.write(value);
      else parts.push(value.slice().buffer);
      onProgress(received);
    }
    signal.throwIfAborted();
    if (received !== bytes) throw new Error('导出文件未完整下载，请重试。');
    if (writable) await writable.close();
    else {
      const url = URL.createObjectURL(new Blob(parts, { type: response.headers.get('content-type') ?? 'application/octet-stream' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    return writable ? 'disk' : 'browser';
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await writable?.abort().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}
