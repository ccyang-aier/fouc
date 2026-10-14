import { expect, test } from 'bun:test';
import { bytesToDraft, draftToBytes } from './redis-mutation-model';

test('Redis editor roundtrip retains BOM, unicode, binary and empty bytes', () => {
  for (const buffer of [
    Buffer.alloc(0),
    Buffer.from('中文🙂'),
    Buffer.from([0xef, 0xbb, 0xbf, 65]),
    Buffer.from([0, 255, 1]),
    Buffer.from('x'.repeat(200000)),
  ]) {
    const raw = buffer.toString('base64');
    expect(draftToBytes(bytesToDraft(raw))).toBe(raw);
  }
  expect(bytesToDraft('AP8B').encoding).toBe('base64');
  expect(() => draftToBytes({ encoding: 'base64', text: 'AB==' })).toThrow('Base64');
});
