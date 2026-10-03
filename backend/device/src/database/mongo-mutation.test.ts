import { expect, test } from 'bun:test';
import { BSON } from 'mongodb';
import { mongoCreateCollectionOptions, mongoCreateIndexSpec, mongoMutationInput, mutationDocument } from './mongo-mutation-input';
import { mongoBsonSignature, mongoDocumentCasFilter } from './mongo-mutation-snapshot';

test('Mongo mutation input is a specific operation, never an arbitrary command or upsert', () => {
  const input = mongoMutationInput({ database: 'demo', collection: 'docs', operation: 'insert-document', documentEjson: '{"big":{"$numberLong":"9007199254740993"},"decimal":{"$numberDecimal":"12.3400"}}' });
  expect(input.operation).toBe('insert-document');
  expect('documentEjson' in input && input.documentEjson).toContain('9007199254740993');
  expect('documentEjson' in input && input.documentEjson).toContain('12.3400');
  for (const payload of [
    { operation: 'command', command: '{"dropDatabase":1}' },
    { operation: 'replace-document', originalEjson: '{}', documentEjson: '{}', upsert: true },
    { operation: 'delete-document', originalEjson: '{}', filter: '{}', many: true },
    { operation: 'insert-document' },
    { operation: 'drop-index', indexName: '*' }, { operation: 'drop-index', indexName: '_id_' },
  ]) expect(() => mongoMutationInput({ database: 'demo', collection: 'docs', ...payload })).toThrow();
  expect(() => mongoMutationInput({ database: 'admin', collection: 'docs', operation: 'drop-collection' })).toThrow();
});
test('Mongo full replacements reject operator documents and invalid identities', () => {
  expect(mutationDocument('{"_id":"507f1f77bcf86cd799439011"}')._id).toBe('507f1f77bcf86cd799439011');
  expect(mutationDocument('{"_id":{"$oid":"507f1f77bcf86cd799439011"}}')._id).toBeInstanceOf(BSON.ObjectId);
  expect(() => mutationDocument('{"$set":{"x":1}}')).toThrow();
  expect(() => mutationDocument('{"_id":[1,2]}')).toThrow();
});
test('Mongo collection and index specs validate typed options with precise field order', () => {
  const spec = mongoCreateIndexSpec('{"email":1,"createdAt":-1}', '{"unique":true,"partialFilterExpression":{"active":true}}');
  expect(spec.name).toBe('email_1_createdAt_-1'); expect(Object.keys(spec.keys)).toEqual(['email', 'createdAt']); expect(spec.options.unique).toBe(true);
  expect(mongoCreateIndexSpec('{"name":"text"}', '{"name":"name_search","weights":{"name":10}}').name).toBe('name_search');
  for (const [keys, options] of [['{}', '{}'], ['{"x":2}', '{}'], ['{"_id":1}', '{}'], ['{"x":"hashed"}', '{"unique":true}'], ['{"x":1,"y":1}', '{"expireAfterSeconds":60}'], ['{"x":1}', '{"key":{"hidden":1}}'], ['{"x":1}', '{"sparse":true,"partialFilterExpression":{}}'], ['{"x":1}', '{"partialFilterExpression":{"$where":"true"}}']]) expect(() => mongoCreateIndexSpec(keys, options)).toThrow();
  expect(mongoCreateCollectionOptions('{"capped":true,"size":4096,"max":100}').capped).toBe(true);
  for (const options of ['{"capped":true}', '{"max":10}', '{"validator":{"$where":"true"}}', '{"create":"other"}', '{"validationAction":"ignore"}']) expect(() => mongoCreateCollectionOptions(options)).toThrow();
});
test('Mongo BSON snapshots distinguish numeric types, field order and decimal precision', () => {
  const long = { _id: 1, x: BSON.Long.fromString('1') }, double = { _id: 1, x: new BSON.Double(1) };
  expect(mongoBsonSignature(long)).not.toBe(mongoBsonSignature(double));
  expect(mongoBsonSignature({ _id: 1, x: 2 })).not.toBe(mongoBsonSignature({ x: 2, _id: 1 }));
  expect(mongoBsonSignature({ x: BSON.Decimal128.fromString('12.3400') })).not.toBe(mongoBsonSignature({ x: BSON.Decimal128.fromString('12.34') }));
  expect(() => mongoDocumentCasFilter({ _id: 1, nested: Array.from({ length: 5000 }, () => 1) })).toThrow('4096');
  expect(() => { let document: Record<string, unknown> = {}; const root = { _id: 1, nested: document }; for (let index = 0; index < 30; index++) { document.next = {}; document = document.next as Record<string, unknown>; } mongoDocumentCasFilter(root); }).toThrow('24');
});
