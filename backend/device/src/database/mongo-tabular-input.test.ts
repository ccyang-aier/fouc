import { expect, test } from 'bun:test';
import { BSON } from 'mongodb';
import { parseMongoDocumentImport } from './mongo-document-input';
import type { MongoTabularField } from '@fouc/shared/mongo-tabular';

const common = { database: 'test_tabular', collection: 'documents', format: 'csv', idPolicy: 'preserve' };
const config = { delimiter: ',', header: true, trimValues: false, emptyAsNull: false, nullToken: '\\N', recognizeObjectIdHex: false };
const field = (sourceIndex: number, target: string, type: MongoTabularField['type']): MongoTabularField => ({ sourceIndex, target, type });

test('explicit BSON types preserve original Int64/Decimal128/ObjectId and nested array values', async () => {
  const text = 'id,count,amount,note,flag,date\n507f1f77bcf86cd799439011,9223372036854775807,1234567890.123456789012345678,"line1\nline2",TRUE,2025-01-02T03:04:05.006+01:00\n';
  const parsed = await parseMongoDocumentImport({ ...common, text, tabular: { ...config, fields: [field(0, '/_id', 'objectId'), field(1, '/items/0/count', 'int64'), field(2, '/items/0/amount', 'decimal128'), field(3, '/note', 'string'), field(4, '/ready', 'boolean'), field(5, '/date', 'date')] } });
  const document = parsed.documents[0];
  expect(document._id).toBeInstanceOf(BSON.ObjectId);
  expect(document.items[0].count.toString()).toBe('9223372036854775807');
  expect(document.items[0].amount.toString()).toBe('1234567890.123456789012345678');
  expect(document.note).toBe('line1\nline2');
  expect(document.ready).toBe(true);
  expect(document.date.toISOString()).toBe('2025-01-02T02:04:05.006Z');
  expect(parsed.generatedIds).toBe(0);
  expect(BSON.serialize(document).byteLength).toBeGreaterThan(0);
});

test('headerless TSV allows string IDs, null/missing and explicit safe EJSON cells', async () => {
  const parsed = await parseMongoDocumentImport({ ...common, format: 'tsv', text: '507f1f77bcf86cd799439011\t\\N\t"{""$numberLong"":""9007199254740993""}"\nsecond\t"\\N"\n',
    tabular: { ...config, delimiter: '\t', header: false, fields: [field(0, '/_id', 'string'), field(1, '/value', 'string'), field(2, '/typed', 'ejson')] } });
  expect(parsed.documents[0]._id).toBe('507f1f77bcf86cd799439011');
  expect(parsed.documents[0].value).toBeNull();
  expect(parsed.documents[0].typed.toString()).toBe('9007199254740993');
  expect(parsed.documents[1].value).toBe('\\N');
  expect(Object.hasOwn(parsed.documents[1], 'typed')).toBe(false);
});

test('all rows are validated after sampling; type errors identify source physical line and column mapping', async () => {
  const text = 'note,count\n"first\nsecond",1\nnext,wrong\n';
  await expect(parseMongoDocumentImport({ ...common, text, tabular: { ...config, fields: [field(0, '/note', 'string'), field(1, '/count', 'int64')] } })).rejects.toThrow('源物理行 4，记录 3，字段 count');
  const long = 'n\n' + '1\n'.repeat(100) + 'not integer\n';
  await expect(parseMongoDocumentImport({ ...common, text: long, tabular: { ...config, fields: [field(0, '/n', 'int32')] } })).rejects.toThrow('源物理行 102');
  for (const [value, type] of [['9223372036854775808', 'int64'], ['2147483648', 'int32'], ['2025-02-30', 'date'], ['not bool', 'boolean'], ['1'.repeat(35), 'decimal128'], ['0x10', 'double']] as const) {
    await expect(parseMongoDocumentImport({ ...common, text: 'n\n' + value, tabular: { ...config, fields: [field(0, '/n', type)] } })).rejects.toThrow('字段 n');
  }
});

test('prototype EJSON, unsafe numeric JSON, sparse row arrays and conflicting ID configuration reject before preview', async () => {
  const quoted = (text: string) => '"' + text.replace(/"/g, '""') + '"';
  for (const text of ['{"__proto__":{"polluted":true}}', '{"n":9007199254740993}']) {
    await expect(parseMongoDocumentImport({ ...common, text: 'n\n' + quoted(text), tabular: { ...config, fields: [field(0, '/n', 'ejson')] } })).rejects.toThrow();
  }
  await expect(parseMongoDocumentImport({ ...common, text: 'a,b\n1,2\n3\n', tabular: { ...config, fields: [field(0, '/items/1', 'string'), field(1, '/items/0', 'string')] } })).rejects.toThrow('稀疏');
  await expect(parseMongoDocumentImport({ ...common, idPolicy: 'generate', text: 'id\nold', tabular: { ...config, fields: [field(0, '/_id', 'string')] } })).rejects.toThrow('跳过原');
  const generated = await parseMongoDocumentImport({ ...common, idPolicy: 'generate', text: 'id,name\nold,Ada', tabular: { ...config, fields: [{ sourceIndex: 0, target: null, type: 'string' }, field(1, '/name', 'string')] } });
  expect(generated.generatedIds).toBe(1);
  expect(generated.documents[0]._id).toBeInstanceOf(BSON.ObjectId);
  expect(({} as { polluted?: string }).polluted).toBeUndefined();
});
