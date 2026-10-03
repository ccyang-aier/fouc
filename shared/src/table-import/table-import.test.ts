import { expect, test } from 'bun:test';
import type { DatabaseColumnInfo } from '../database';
import { decodeTableImportBytes } from './encoding';
import { autoMapTableImportColumns, validateTableImportMappings } from './mapping';
import { parseTableImport } from './parse';
import { TABLE_IMPORT_LIMITS } from './types';

const column = (name: string, extra: Partial<DatabaseColumnInfo> = {}): DatabaseColumnInfo => ({ name, dataType: 'TEXT', isNullable: true, columnDefault: null, isPrimaryKey: false, isUnique: false, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null, ...extra });

test('DBX delimited header uniqueness, quoted delimiters/newlines/escapes and explicit NULL versus missing', () => {
  const parsed = parseTableImport('\uFEFFid,name,name,note\r\n9007199254740993,"Ada, A.","",\\N\r\n2,"two\r\nlines","quote ""yes"""\r\n', { format: 'csv', nullToken: '\\N' });
  expect(parsed.errors).toEqual([]); expect(parsed.columns).toEqual(['id', 'name', 'name_1', 'note']);
  expect(parsed.rows[0]).toEqual([{ kind: 'text', value: '9007199254740993' }, { kind: 'text', value: 'Ada, A.' }, { kind: 'text', value: '' }, { kind: 'null' }]);
  expect(parsed.rows[1][1]).toEqual({ kind: 'text', value: 'two\r\nlines' }); expect(parsed.rows[1][2]).toEqual({ kind: 'text', value: 'quote "yes"' }); expect(parsed.rows[1][3]).toEqual({ kind: 'missing' });
  expect(parsed.inferredTypes[0]).toBe('integer'); expect(parsed.rowNumbers).toEqual([2, 3]); expect(parsed.totalRows).toBe(2);
  expect(parseTableImport('v\n"\\N"\n', { format: 'csv', nullToken: '\\N' }).rows[0][0]).toEqual({ kind: 'text', value: '\\N' });
});

test('TSV/custom delimiter and logical row ranges preserve column order and leading-zero identifiers', () => {
  const text = 'skip\ncode|amount\n00123|1.25\n00456|2e3\nignored|tail\n';
  const parsed = parseTableImport(text, { format: 'delimited', delimiter: '|', titleRow: 2, dataStartRow: 3, lastDataRow: 4 });
  expect(parsed.columns).toEqual(['code', 'amount']); expect(parsed.rows).toHaveLength(2); expect(parsed.inferredTypes).toEqual(['text', 'decimal']);
  const tsv = parseTableImport(' A \tB\n 1 \t\n', { format: 'tsv', trimValues: true, emptyStringAsNull: true });
  expect(tsv.columns).toEqual(['A', 'B']); expect(tsv.rows[0]).toEqual([{ kind: 'text', value: '1' }, { kind: 'null' }]);
  expect(parseTableImport('1;two\n', { format: 'delimited', delimiter: ';', titleRow: 0 }).columns).toEqual(['column_1', 'column_2']);
});

test('JSON/NDJSON retain number spellings, object key order, nested JSON and missing cells without prototype mutation', () => {
  const parsed = parseTableImport('[{"id":9007199254740993,"amount":1.2300e+2,"details":{"n":9007199254740995}},{"id":2,"extra":null,"__proto__":"literal"}]', { format: 'json' });
  expect(parsed.errors).toEqual([]); expect(parsed.columns).toEqual(['id', 'amount', 'details', 'extra', '__proto__']);
  expect(parsed.rows[0][0]).toEqual({ kind: 'number', value: '9007199254740993' }); expect(parsed.rows[0][1]).toEqual({ kind: 'number', value: '1.2300e+2' });
  expect(parsed.rows[0][2]).toEqual({ kind: 'json', value: '{"n":9007199254740995}' }); expect(parsed.rows[0][4]).toEqual({ kind: 'missing' });
  expect(parsed.rows[1][3]).toEqual({ kind: 'null' }); expect(parsed.rows[1][4]).toEqual({ kind: 'text', value: 'literal' });
  const lines = parseTableImport('\n{"id":9007199254740993}\r\n{"id":2,"name":"😀"}\n', { format: 'ndjson' });
  expect(lines.errors).toEqual([]); expect(lines.rowNumbers).toEqual([1, 2]); expect(lines.rows[1][1]).toEqual({ kind: 'text', value: '😀' });
  expect(parseTableImport('[[1,"x"],[2]]', { format: 'json', jsonShape: 'arrays' }).rows[1][1]).toEqual({ kind: 'missing' });
});

test('invalid syntax has source coordinates and mixed shapes, duplicate keys, extra CSV columns block import', () => {
  const malformed = parseTableImport('id,name\n1,"unclosed 😀', { format: 'csv' });
  expect(malformed.errors[0]).toMatchObject({ record: 2, line: 2, column: 1, offset: 8 });
  expect(parseTableImport('[{"id":1},[2]]', { format: 'json' }).errors[0].message).toContain('不能混用');
  expect(parseTableImport('[{"id":1,"id":2}]', { format: 'json' }).errors[0].message).toContain('重复');
  expect(parseTableImport('id\n1,2', { format: 'csv' }).errors[0].record).toBe(2);
  const lines = parseTableImport('{"id":1}\r\n{"id":}', { format: 'ndjson' });
  expect(lines.errors[0].line).toBe(2); expect(lines.errors[0].record).toBe(2);
  expect(parseTableImport('[1]', { format: 'json' }).errors).toHaveLength(1);
  expect(parseTableImport('[{"id":1},]', { format: 'json' }).errors).toHaveLength(1);
  expect(parseTableImport('\uFEFF[{"id":}]', { format: 'json' }).errors[0]).toMatchObject({ offset: 8, line: 1, column: 9 });
});

test('strict encoding handles BOM/GBK and real limits refuse partial success, cancellation propagates', () => {
  expect(decodeTableImportBytes(new Uint8Array([0xff, 0xfe, 65, 0, 9, 0, 66, 0])).text).toBe('A\tB');
  expect(decodeTableImportBytes(new Uint8Array([0xfe, 0xff, 0, 65, 0, 9, 0, 66])).text).toBe('A\tB');
  expect(decodeTableImportBytes(new Uint8Array([0xd6, 0xd0]), 'gbk').text).toBe('中');
  expect(() => decodeTableImportBytes(new Uint8Array([0xc0, 0xaf]), 'utf8')).toThrow();
  const large = parseTableImport('v\n' + '1\n'.repeat(5001), { format: 'csv' });
  expect(large.errors[0].message).toContain('5000');
  expect(parseTableImport('a'.repeat(TABLE_IMPORT_LIMITS.bytes + 1), { format: 'csv' }).errors[0].message).toContain('5 MiB');
  expect(parseTableImport('v\n' + Array.from({ length: 257 }, (_, index) => index).join(','), { format: 'csv' }).errors[0].message).toContain('256');
  const controller = new AbortController(); controller.abort();
  expect(() => parseTableImport('v\n1', { format: 'csv' }, controller.signal)).toThrow();
});

test('DBX exact/normalized mapping avoids ambiguity and checks required/generated/duplicate targets', () => {
  expect(autoMapTableImportColumns(['note'], [column('note', { extra: 'DEFAULT_GENERATED', columnDefault: "'seed'" })])[0].targetColumn).toBe('note');
  expect(autoMapTableImportColumns(['value'], [column('value', { extra: 'VIRTUAL GENERATED' })])[0].targetColumn).toBe('');
  const targets = [column('id', { isNullable: false, dataType: 'BIGINT', extra: 'identity' }), column('user_name', { isNullable: false }), column('label')];
  expect(autoMapTableImportColumns(['id', 'User Name', 'unknown'], targets)).toEqual([{ sourceColumn: 'id', targetColumn: '' }, { sourceColumn: 'User Name', targetColumn: 'user_name' }, { sourceColumn: 'unknown', targetColumn: '' }]);
  expect(autoMapTableImportColumns(['a b'], [column('a_b'), column('a-b')])[0].targetColumn).toBe('');
  expect(validateTableImportMappings(['x'], [{ sourceColumn: 'x', targetColumn: 'label' }], targets, 'postgres').requiredColumns).toEqual(['user_name']);
  expect(validateTableImportMappings(['x', 'y'], [{ sourceColumn: 'x', targetColumn: 'label' }, { sourceColumn: 'y', targetColumn: 'label' }], targets, 'postgres').valid).toBe(false);
  expect(validateTableImportMappings(['x'], [{ sourceColumn: 'x', targetColumn: 'id' }], targets, 'postgres').errors[0].message).toContain('生成字段');
});
