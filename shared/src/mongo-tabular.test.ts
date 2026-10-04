import { expect, test } from 'bun:test';
import { mongoTabularDateMilliseconds, parseMongoTabular, validateMongoTabularFields, type MongoTabularOptions, type MongoTabularField } from './mongo-tabular';

const options: MongoTabularOptions = { delimiter: ',', header: true, trimValues: false, emptyAsNull: false, nullToken: '\\N', recognizeObjectIdHex: false };
const field = (sourceIndex: number, target: string): MongoTabularField => ({ sourceIndex, target, type: 'string' });

test('CSV preserves raw digits, quoted separators/newlines, escapes and physical source lines', () => {
  const parsed = parseMongoTabular('\uFEFFname,count,note\r\n"Ada, Lovelace",9007199254740993,"first\r\nsecond ""quoted"""\r\nBob,42,\\N\r\n', 'csv', options);
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows[0][1]).toEqual({ kind: 'text', value: '9007199254740993' });
  expect(parsed.rows[0][2]).toEqual({ kind: 'text', value: 'first\r\nsecond "quoted"' });
  expect(parsed.rows[1][2]).toEqual({ kind: 'null' });
  expect(parsed.sourceLines).toEqual([2, 4]);
  expect(parsed.suggestions[1].type).toBe('int64');
});

test('headerless TSV, explicit NULL, quoted literal and missing trailing fields stay distinct', () => {
  const parsed = parseMongoTabular('alpha\t"\\N"\t\n\nbeta\t\\N\n', 'tsv', { ...options, header: false, delimiter: '\t' });
  expect(parsed.columns).toEqual(['column_1', 'column_2', 'column_3']);
  expect(parsed.rows[0][1]).toEqual({ kind: 'text', value: '\\N' });
  expect(parsed.rows[0][2]).toEqual({ kind: 'text', value: '' });
  expect(parsed.rows[1][1]).toEqual({ kind: 'null' });
  expect(parsed.rows[1][2]).toEqual({ kind: 'missing' });
  expect(parsed.sourceLines).toEqual([1, 3]);
  const nulls = parseMongoTabular('x;y\n" ";\n', 'csv', { ...options, delimiter: ';', trimValues: true, emptyAsNull: true });
  expect(nulls.rows[0]).toEqual([{ kind: 'null' }, { kind: 'null' }]);
});

test('sampling is bounded, ObjectId recognition is explicit and raw values never change', () => {
  const text = '_id,count,amount,flag,date\n507f1f77bcf86cd799439011,42,1.50,TRUE,2025-01-02\n507f191e810c19729de860ea,2147483648,2.00,false,2025-01-03\n';
  const plain = parseMongoTabular(text, 'csv', options);
  expect(plain.suggestions.map(column => column.type)).toEqual(['string', 'int64', 'decimal128', 'boolean', 'date']);
  expect(plain.suggestions[0].objectIdCandidate).toBe(true);
  const recognized = parseMongoTabular(text, 'csv', { ...options, recognizeObjectIdHex: true });
  expect(recognized.suggestions[0].type).toBe('objectId');
  expect(recognized.rows).toEqual(plain.rows);
  const sampled = parseMongoTabular('n\n' + Array.from({ length: 100 }, () => '1').join('\n') + '\nwrong\n', 'csv', options);
  expect(sampled.sampledRows).toBe(100);
  expect(sampled.rows.length).toBe(101);
  expect(sampled.suggestions[0].type).toBe('int32');
  expect(mongoTabularDateMilliseconds('2025-02-30')).toBeNull();
  expect(mongoTabularDateMilliseconds('2025-01-02T03:04:05.006+01:00')).toBe(Date.parse('2025-01-02T02:04:05.006Z'));
});

test('target shape rejects prototype keys, duplicate/ancestor collisions and sparse or huge arrays', () => {
  expect(() => validateMongoTabularFields([field(0, '/items/0/name'), field(1, '/items/1/name')], 2)).not.toThrow();
  expect(() => validateMongoTabularFields([field(0, '/a~1b/~0name')], 1)).not.toThrow();
  for (const paths of [
    ['/__proto__/x'], ['/x/constructor'], ['/x/prototype'], ['/a', '/a/b'], ['/a/b', '/a'],
    ['/a', '/a'], ['/items/1/name'], ['/items/999999/name'], ['/items/0', '/items/name'], ['/a/~2'],
  ]) expect(() => validateMongoTabularFields(paths.map((path, index) => field(index, path)), paths.length)).toThrow();
  expect(() => validateMongoTabularFields([{ sourceIndex: 0, target: null, type: 'string' }], 1)).toThrow('至少');
});

test('invalid syntax and bounded-file errors are located without accepting partial rows', () => {
  const broken = parseMongoTabular('a,b\n1,2\n"bad', 'csv', options);
  expect(broken.errors[0].line).toBe(3);
  expect(broken.errors[0].message).toContain('未闭合');
  expect(broken.sourceLines).toEqual([]);
  expect(parseMongoTabular('a\n' + 'x'.repeat(5 * 1024 * 1024), 'csv', options).errors[0].message).toContain('5 MiB');
  expect(parseMongoTabular('a\n' + 'x\n'.repeat(5001), 'csv', options).errors[0].message).toContain('5000');
});
