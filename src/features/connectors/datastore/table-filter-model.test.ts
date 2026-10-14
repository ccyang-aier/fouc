import { expect, test } from 'bun:test';
import type { DatabaseColumnInfo, RelationalFilter } from '@fouc/shared';
import {
  buildFilter,
  draftFilter,
  isolateFilter,
  newCondition,
  newGroup,
} from './table-filter-model';

const columns: DatabaseColumnInfo[] = [
  ['metadata', 'jsonb'],
  ['payload', 'bytea'],
  ['name', 'text'],
].map(([name, dataType]) => ({
  name,
  dataType,
  isNullable: true,
  columnDefault: null,
  isPrimaryKey: false,
  isUnique: false,
  extra: null,
  comment: null,
  numericPrecision: null,
  numericScale: null,
  characterMaximumLength: null,
}));

test('reopening typed filters preserves JSON scalars, binary values and nested groups', () => {
  const filter: RelationalFilter = {
    kind: 'group',
    join: 'or',
    children: [
      { kind: 'condition', column: 'metadata', operator: 'equals', value: 'text' },
      {
        kind: 'group',
        join: 'and',
        children: [
          { kind: 'condition', column: 'metadata', operator: 'equals', value: { enabled: true } },
          {
            kind: 'condition',
            column: 'payload',
            operator: 'equals',
            value: { type: 'binary', base64: 'AP8=' },
          },
        ],
      },
    ],
  };
  expect(buildFilter(draftFilter(filter, columns), columns)).toEqual(filter);
});

test('LIKE on JSON accepts text fragments; NULL equality never becomes an empty string', () => {
  const filter: RelationalFilter = {
    kind: 'group',
    join: 'and',
    children: [
      { kind: 'condition', column: 'metadata', operator: 'like', value: 'enabled' },
      { kind: 'condition', column: 'name', operator: 'not-equals', value: null },
    ],
  };
  expect(buildFilter(draftFilter(filter, columns), columns)).toEqual({
    ...filter,
    children: [filter.children[0], { kind: 'condition', column: 'name', operator: 'is-not-null' }],
  });
});

test('disabled drafts never validate or enter the database filter, including nested groups', () => {
  const disabled = { ...newCondition('metadata'), value: 'invalid json', enabled: false };
  const valid = { ...newCondition('name'), value: '杭州' };
  expect(buildFilter(newGroup([disabled, newGroup([valid])]), columns)).toEqual({
    kind: 'group',
    join: 'and',
    children: [
      {
        kind: 'group',
        join: 'and',
        children: [{ kind: 'condition', column: 'name', operator: 'equals', value: '杭州' }],
      },
    ],
  });
  expect(buildFilter(newGroup([disabled]), columns)).toBeNull();
  expect(() => buildFilter(newGroup([newGroup()]), columns)).toThrow('请为分组添加条件');
});

test('only this condition enables its ancestors and excludes all sibling conditions', () => {
  const first = { ...newCondition('name'), value: '甲' };
  const second = { ...newCondition('name'), value: '乙' };
  const root = newGroup([first, newGroup([second])]);
  expect(buildFilter(isolateFilter(root, second.id), columns)).toEqual({
    kind: 'group',
    join: 'and',
    children: [
      {
        kind: 'group',
        join: 'and',
        children: [{ kind: 'condition', column: 'name', operator: 'equals', value: '乙' }],
      },
    ],
  });
});
