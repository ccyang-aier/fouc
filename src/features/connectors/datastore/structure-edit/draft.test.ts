import { expect, test } from 'bun:test';
import type { RelationalTableStructure } from '@fouc/shared';
import {
  createStructureEditorDraft,
  newStructureColumn,
  structureDraftInput,
  validateStructureDraft,
} from './draft';
const source: RelationalTableStructure = {
  connectionId: 'test',
  provider: 'postgres',
  schema: 'public',
  table: 'people',
  kind: 'table',
  columns: [
    {
      name: 'name',
      dataType: 'text',
      isNullable: true,
      columnDefault: null,
      isPrimaryKey: false,
      isUnique: false,
      extra: null,
      comment: null,
      numericPrecision: null,
      numericScale: null,
      characterMaximumLength: null,
    },
  ],
  indexes: [],
  foreignKeys: [],
  constraints: [],
  triggers: [],
  properties: {},
  definition: { sql: 'CREATE TABLE people(name text)', origin: 'native', warnings: [] },
};
test('untouched drafts are clean, changed columns become precise patches and undo removes operations', () => {
  const draft = createStructureEditorDraft(source);
  expect(structureDraftInput(source, draft).operations).toEqual([]);
  draft.columns[0].value.comment = '姓名';
  expect(structureDraftInput(source, draft).operations).toEqual([
    { id: 'column-0', kind: 'update-column', originalName: 'name', patch: { comment: '姓名' } },
  ]);
  draft.columns[0].value.comment = '';
  expect(structureDraftInput(source, draft).operations).toHaveLength(0);
  draft.columns.push({
    id: 'new',
    originalName: null,
    value: newStructureColumn('postgres'),
    dropped: false,
  });
  expect(validateStructureDraft(source, draft).length).toBeGreaterThan(0);
  draft.columns[1].dropped = true;
  expect(structureDraftInput(source, draft).operations).toHaveLength(0);
});
