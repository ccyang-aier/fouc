import { expect, test } from 'bun:test';
import { consumeGridFsDownload } from './download';

function content(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
}

test('GridFS browser consumption preserves bytes, detects partial responses and rolls back a cancelled disk writer', async () => {
  const parts = await consumeGridFsDownload(content([new Uint8Array([0, 1]), new Uint8Array([254, 255])]), 4, null, new AbortController().signal, () => {});
  expect([...new Uint8Array(await new Blob(parts).arrayBuffer())]).toEqual([0, 1, 254, 255]);
  await expect(consumeGridFsDownload(content([new Uint8Array([1])]), 2, null, new AbortController().signal, () => {})).rejects.toThrow('不完整');
  await expect(consumeGridFsDownload(content([new Uint8Array([1, 2])]), 1, null, new AbortController().signal, () => {})).rejects.toThrow('超过');
  const abort = new AbortController();
  let closed = false, rolledBack = false;
  const writer = { write: async () => { abort.abort(); }, close: async () => { closed = true; }, abort: async () => { rolledBack = true; } };
  await expect(consumeGridFsDownload(content([new Uint8Array([1, 2])]), 2, writer, abort.signal, () => {})).rejects.toThrow();
  expect(closed).toBe(false);
  expect(rolledBack).toBe(true);
});
