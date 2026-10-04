import { expect, test } from 'bun:test';
import { BSON } from 'mongodb';
import { parseMongoDocumentImport } from './mongo-document-input';

const namespace = { database: 'test_database', collection: 'test_documents', idPolicy: 'preserve' as const };

test('full Canonical EJSON validation preserves typed values and exact integer tokens', async () => {
  const original = {
    _id: new BSON.ObjectId(), integer: BSON.Long.fromString('9223372036854775807'),
    amount: BSON.Decimal128.fromString('1234567890.123456789012345678'),
    binary: new BSON.Binary(Buffer.from([0, 128, 255]), 128), date: new Date('2025-01-02T03:04:05.006Z'),
    timestamp: new BSON.Timestamp({ t: 4294967295, i: 123 }), regex: new BSON.BSONRegExp('a.*', 'i'),
  };
  const text = BSON.EJSON.stringify(original, { relaxed: false });
  const parsed = await parseMongoDocumentImport({ ...namespace, format: 'json', text: '[' + text + ']' });
  expect(BSON.EJSON.stringify(parsed.documents[0], { relaxed: false })).toBe(text);
  expect(parsed.generatedIds).toBe(0);
  await expect(parseMongoDocumentImport({ ...namespace, format: 'json', text: '[{"number":9007199254740993}]' })).rejects.toThrow('精度');
  await expect(parseMongoDocumentImport({ ...namespace, format: 'ndjson', text: '{"ok":1}\n{"bad":{"$numberLong":"9223372036854775808"}}' })).rejects.toThrow('第 2');
});

test('explicit JSON Pointer mapping handles arrays, escaped names, missing/null and ID recognition', async () => {
  const id = '507f1f77bcf86cd799439011';
  const parsed = await parseMongoDocumentImport({
    ...namespace, format: 'ndjson', text: JSON.stringify({ _id: id, 'a/b': [{ count: '9007199254740993' }], null: null, date: '2025-01-02T03:04:05.006Z' }),
    fields: [{ path: '/_id', type: 'objectId' }, { path: '/a~1b/0/count', type: 'int64' }, { path: '/missing', type: 'int32' }, { path: '/null', type: 'date' }, { path: '/date', type: 'date' }],
  });
  expect(parsed.documents[0]._id.toHexString()).toBe(id);
  expect(parsed.documents[0]['a/b'][0].count.toString()).toBe('9007199254740993');
  expect(Object.hasOwn(parsed.documents[0], 'missing')).toBe(false);
  expect(parsed.documents[0].null).toBeNull();
  expect(parsed.documents[0].date.toISOString()).toBe('2025-01-02T03:04:05.006Z');
  const plain = await parseMongoDocumentImport({ ...namespace, format: 'json', text: JSON.stringify({ _id: id }) });
  expect(plain.documents[0]._id).toBe(id);
});

test('unsafe paths, invalid types, oversize docs and malformed trailing rows reject the whole file', async () => {
  for (const fields of [[{ path: '/__proto__/polluted', type: 'string' }], [{ path: '/i', type: 'int64' }]]) {
    await expect(parseMongoDocumentImport({ ...namespace, format: 'json', text: '{"i":"9223372036854775808"}', fields })).rejects.toThrow();
  }
  await expect(parseMongoDocumentImport({ ...namespace, format: 'json', text: '{"date":"2025-02-30T00:00:00Z"}', fields: [{ path: '/date', type: 'date' }] })).rejects.toThrow('无法');
  await expect(parseMongoDocumentImport({ ...namespace, format: 'ndjson', text: '{"valid":1}\nnot json' })).rejects.toThrow('第 2');
  await expect(parseMongoDocumentImport({ ...namespace, format: 'json', text: '[{"x":"' + 'x'.repeat(262144) + '"}]' })).rejects.toThrow('256 KiB');
  await expect(parseMongoDocumentImport({ ...namespace, format: 'json', text: '[]' })).rejects.toThrow('1–5000');
  expect(({} as { polluted?: string }).polluted).toBeUndefined();
});

test('generate ID policy creates exact frozen IDs and rejects conflicting ID mappings', async () => {
  const parsed = await parseMongoDocumentImport({ ...namespace, idPolicy: 'generate', format: 'json', text: '[{"_id":"old"},{"_id":"old"}]' });
  expect(parsed.generatedIds).toBe(2);
  expect(parsed.documents[0]._id).toBeInstanceOf(BSON.ObjectId);
  expect(parsed.documents[0]._id.equals(parsed.documents[1]._id)).toBe(false);
  await expect(parseMongoDocumentImport({ ...namespace, idPolicy: 'generate', format: 'json', text: '{"_id":"old"}', fields: [{ path: '/_id', type: 'string' }] })).rejects.toThrow('不能同时');
});
