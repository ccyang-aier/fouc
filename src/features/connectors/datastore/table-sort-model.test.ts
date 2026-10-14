import { expect, test } from 'bun:test';
import type { DatabaseColumnInfo } from '@fouc/shared';
import { buildSort, draftSort, newSort } from './table-sort-model';

const columns = [{ name: 'id' }, { name: 'name' }] as DatabaseColumnInfo[];
test('sorting omits disabled drafts and preserves database order and null placement', () => {
  expect(
    buildSort(
      [
        { ...newSort('missing'), enabled: false },
        ...draftSort([{ column: 'name', direction: 'desc', nulls: 'first' }]),
      ],
      columns,
    ),
  ).toEqual([{ column: 'name', direction: 'desc', nulls: 'first' }]);
});
test('sorting rejects missing or duplicate enabled fields before a database request', () => {
  expect(() => buildSort([newSort()], columns)).toThrow('请选择有效排序字段');
  expect(() => buildSort([newSort('id'), newSort('id')], columns)).toThrow('id 已用于排序');
});
