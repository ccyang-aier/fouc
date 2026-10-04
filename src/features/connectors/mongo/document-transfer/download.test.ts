import { expect, test } from 'bun:test';
import { consumeMongoDocumentExport } from './download';

test('NDJSON streaming counts chunk-split documents and honors writable backpressure', async () => {
  const input = ['{"x":1}\n{"x"', ':2}\n'];
  const bytes = new TextEncoder(), written: string[] = [];
  let closed = false;
  const progress: { documents: number; bytes: number }[] = [];
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of input) controller.enqueue(bytes.encode(chunk)); controller.close(); } });
  const parts = await consumeMongoDocumentExport(stream, { async write(value) { written.push(new TextDecoder().decode(value)); }, async close() { closed = true; }, async abort() {} }, new AbortController().signal, value => progress.push(value));
  expect(parts).toHaveLength(0); expect(written.join('')).toBe(input.join('')); expect(closed).toBe(true);
  expect(progress.at(-1)).toEqual({ documents: 2, bytes: 16 });
});

test('cancel aborts the target without treating partial bytes as a completed download', async () => {
  const controller = new AbortController();
  let aborted = false, closed = false;
  const stream = new ReadableStream<Uint8Array>({ start(value) { value.enqueue(new TextEncoder().encode('{"x":1}\n')); } });
  await expect(consumeMongoDocumentExport(stream, { async write() { controller.abort(new Error('cancelled')); }, async close() { closed = true; }, async abort() { aborted = true; } }, controller.signal, () => undefined)).rejects.toThrow('cancelled');
  expect(aborted).toBe(true); expect(closed).toBe(false);
});
