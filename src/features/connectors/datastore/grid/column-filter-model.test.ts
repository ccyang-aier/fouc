import { describe, expect, test } from 'bun:test';
import type { DatabaseCell, RelationalFilter } from '@fouc/shared';
import {
  databaseColumnValueFilter,
  filterGridSourceRows,
  gridColumnValueKey,
  gridColumnValueOptions,
  hasDatabaseColumnFilter,
  removeDatabaseColumnFilter,
} from './column-filter-model';

const condition = (column: string): RelationalFilter => ({
  kind: 'condition',
  column,
  operator: 'equals',
  value: 'value',
});
const group = (join: 'and' | 'or', ...children: RelationalFilter[]): RelationalFilter => ({
  kind: 'group',
  join,
  children,
});

describe('column value filters', () => {
  test('keys preserve scalar types, nested arrays, binary payloads and property-independent object equality', () => {
    const different: DatabaseCell[] = [
      null,
      'null',
      'NULL',
      '',
      1,
      '1',
      true,
      'true',
      0,
      -0,
      [1, '1'],
      ['1', 1],
    ];
    expect(new Set(different.map(gridColumnValueKey)).size).toBe(different.length);
    expect(gridColumnValueKey({ a: 1, z: [{ b: null, a: 'null' }] })).toBe(
      gridColumnValueKey({ z: [{ a: 'null', b: null }], a: 1 }),
    );
    expect(gridColumnValueKey({ type: 'binary', base64: 'AA==' })).toBe(
      gridColumnValueKey({ base64: 'AA==', type: 'binary' }),
    );
    expect(gridColumnValueKey({ type: 'binary', base64: 'AA==' })).not.toBe(
      gridColumnValueKey({ type: 'binary', base64: 'AQ==' }),
    );
    expect(gridColumnValueKey({ type: 'binary', base64: 'AA==' })).not.toBe(
      gridColumnValueKey('AA=='),
    );
  });

  test('loaded values aggregate by typed equality without replacing their original payload', () => {
    const original = { b: null, a: 1 };
    const options = gridColumnValueOptions(
      [[null], ['NULL'], [''], [1], ['1'], [original], [{ a: 1, b: null }], [null]],
      0,
    );
    expect(options.map((option) => [option.value, option.text, option.count])).toEqual([
      [null, 'NULL', 2],
      ['NULL', 'NULL', 1],
      ['', '空字符串', 1],
      [1, '1', 1],
      ['1', '1', 1],
      [original, '{"b":null,"a":1}', 2],
    ]);
    expect(options[5].value).toBe(original);
  });

  test('several local column white lists intersect while preserving loaded row indexes', () => {
    const rows: DatabaseCell[][] = [
      [10, null],
      [11, 'null'],
      [12, null],
      [13, 'null'],
      [14, 'null'],
    ];
    expect(filterGridSourceRows(rows, {})).toEqual([0, 1, 2, 3, 4]);
    expect(
      filterGridSourceRows(rows, {
        0: [11, 12, 13].map(gridColumnValueKey),
        1: [gridColumnValueKey('null')],
      }),
    ).toEqual([1, 3]);
    expect(filterGridSourceRows(rows, { 1: [gridColumnValueKey(null)] })).toEqual([0, 2]);
    expect(filterGridSourceRows(rows, { 0: [] })).toEqual([]);
    expect(rows).toEqual([
      [10, null],
      [11, 'null'],
      [12, null],
      [13, 'null'],
      [14, 'null'],
    ]);
  });

  test('removing one column preserves mixed group semantics and compresses single or empty branches', () => {
    const city = condition('city'),
      name = condition('name'),
      tier = condition('tier'),
      email = condition('email');
    const filter = group(
      'and',
      group('or', city, name, tier),
      group('or', city, group('and', email, city)),
      group('and', city, city),
    );
    expect(hasDatabaseColumnFilter(filter, 'city')).toBe(true);
    expect(hasDatabaseColumnFilter(filter, 'id')).toBe(false);
    const removed = removeDatabaseColumnFilter(filter, 'city');
    expect(removed).toEqual(group('and', group('or', name, tier), email));
    expect(hasDatabaseColumnFilter(removed, 'city')).toBe(false);
    expect(hasDatabaseColumnFilter(removed, 'email')).toBe(true);
    expect(removeDatabaseColumnFilter(group('or', city, name), 'city')).toBe(name);
    expect(removeDatabaseColumnFilter(group('and', city, city), 'city')).toBeNull();
    expect(removeDatabaseColumnFilter(null, 'city')).toBeNull();
    expect(removeDatabaseColumnFilter(filter, 'unknown')).toBe(filter);
  });

  test('database membership separates NULL, retains typed values and enforces real IN boundaries', () => {
    expect(databaseColumnValueFilter('city', [null, null])).toEqual({
      kind: 'condition',
      column: 'city',
      operator: 'is-null',
    });
    expect(databaseColumnValueFilter('id', [1, '1', 1])).toEqual({
      kind: 'condition',
      column: 'id',
      operator: 'in',
      values: [1, '1'],
    });
    expect(databaseColumnValueFilter('city', [null, 'null', null])).toEqual({
      kind: 'group',
      join: 'or',
      children: [
        { kind: 'condition', column: 'city', operator: 'is-null' },
        { kind: 'condition', column: 'city', operator: 'in', values: ['null'] },
      ],
    });
    expect(() => databaseColumnValueFilter('city', [])).toThrow('至少选择一个值');
    expect(
      databaseColumnValueFilter(
        'id',
        Array.from({ length: 200 }, (_, index) => index),
      ),
    ).toMatchObject({ operator: 'in' });
    expect(() =>
      databaseColumnValueFilter(
        'id',
        Array.from({ length: 201 }, (_, index) => index),
      ),
    ).toThrow('最多选择 200');
  });
});
