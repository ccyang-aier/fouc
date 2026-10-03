import { expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DatabaseColumnInfo, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import { buildErDiagram, diagramFieldRelations, diagramJoinSql, diagramVisibleColumns, erDiagramNodeId, fitErDiagramViewport, layoutErDiagram, routeErDiagramEdge, zoomErDiagramAt } from '@fouc/shared/er-diagram';
import type { RelationalDriver } from './drivers/relational-driver';
import { connectSqlite } from './drivers/sqlite';
import { loadRelationalDiagram } from './diagram-metadata';
function col(name: string, primary = false): DatabaseColumnInfo { return { name, dataType: 'INTEGER', isNullable: !primary, isPrimaryKey: primary, isUnique: false, columnDefault: null, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null }; }
function table(provider: RelationalProvider, name: string, schema = 'public'): RelationalTableStructure { return { connectionId: 'connection', provider, schema, table: name, kind: 'table', columns: [col('tenant', true), col('id', true)], foreignKeys: [], indexes: [], constraints: [], triggers: [], properties: {}, definition: { sql: '', origin: 'native', warnings: [] } }; }
function fk(source: RelationalTableStructure, target: RelationalTableStructure) { source.foreignKeys.push({ name: 'parent_fk', nameSource: 'catalog', columns: ['tenant', 'parent'], referencedSchema: target.schema, referencedTable: target.table, referencedColumns: ['tenant', 'id'], onUpdate: 'NO ACTION', onDelete: 'CASCADE', match: 'SIMPLE', deferrable: false, initiallyDeferred: false, validated: true, definition: null }); }
test('native composite relationships keep exact column order, true unique subsets and safe JOIN quoting', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const parent = table(provider, 'parent"`'), child = table(provider, 'child"`'); child.columns.push(col('parent')); fk(child, parent);
    const model = buildErDiagram([parent, child]), edge = model.edges[0];
    expect(edge.pairs).toEqual([{ sourceColumn: 'tenant', targetColumn: 'tenant' }, { sourceColumn: 'parent', targetColumn: 'id' }]);
    expect(edge.sourceCardinality).toBe('many'); expect(edge.targetCardinality).toBe('one'); expect(edge.nullable).toBe(true);
    child.constraints.push({ name: 'one_parent', kind: 'unique', columns: ['parent'], definition: null, deferrable: null, initiallyDeferred: null, validated: true });
    expect(buildErDiagram([parent, child]).edges[0].sourceCardinality).toBe('one');
    const sql = diagramJoinSql(model, edge.id); expect(sql).toContain(provider === 'mysql' ? '`parent"```' : '"parent""`"'); expect(sql).toContain('\n AND ');
    const incoming = diagramFieldRelations(model, parent.columns.length ? model.nodes[0].id : '', 'id'); expect(incoming[0].direction).toBe('incoming'); expect(incoming[0].peer?.table).toBe(child.table);
  }
});
test('cross-schema identity, missing metadata and catalog validation never fabricate relationships', () => {
  const parent = table('postgres', 'parent', 'other'), sameName = table('postgres', 'parent'), child = table('postgres', 'child'); child.columns.push(col('parent')); fk(child, parent);
  const model = buildErDiagram([sameName, child]); expect(model.nodes.filter((node) => node.external)).toHaveLength(1); expect(model.edges[0].target).toBe(erDiagramNodeId('connection', 'other', 'parent')); expect(model.edges[0].targetCardinality).toBe('unknown');
  expect(model.nodes.find((node) => node.external)?.columns[0].primary).toBeNull();
  child.foreignKeys[0].validated = false; expect(buildErDiagram([child, parent]).issues.some((issue) => issue.message.includes('尚未验证'))).toBe(true);
  child.foreignKeys[0].referencedColumns.pop(); expect(buildErDiagram([child]).edges).toHaveLength(0);
  const foreign = table('postgres', 'foreign'); foreign.connectionId = 'another'; expect(() => buildErDiagram([child, foreign])).toThrow('不同连接');
  expect(erDiagramNodeId('a', 'b.c', 'd')).not.toBe(erDiagramNodeId('a', 'b', 'c.d'));
});
test('partial/expression/prefix indexes cannot prove complete foreign-key uniqueness', () => {
  const parent = table('mysql', 'parent'), child = table('mysql', 'child'); child.columns.push(col('parent')); fk(child, parent);
  child.indexes.push({ name: 'partial', unique: true, primary: false, valid: true, visible: true, method: 'btree', constraintBacked: false, parts: [{ position: 1, column: 'parent', expression: null, role: 'key', descending: false, nulls: null, prefixLength: null, collation: null }], predicate: 'parent > 1', definition: null, comment: null });
  expect(buildErDiagram([parent, child]).edges[0].sourceCardinality).toBe('many'); child.indexes[0].predicate = null; child.indexes[0].parts[0].prefixLength = 5; expect(buildErDiagram([parent, child]).edges[0].sourceCardinality).toBe('many');
  child.indexes[0].parts[0].prefixLength = null; expect(buildErDiagram([parent, child]).edges[0].sourceCardinality).toBe('one');
  parent.columns.forEach((column) => column.isPrimaryKey = false); expect(buildErDiagram([parent, child]).edges[0].targetCardinality).toBe('many');
});
test('cycle-aware layout never overlaps cards; route anchors and cursor-relative zoom remain accurate', () => {
  const a = table('sqlite', 'a', 'main'), b = table('sqlite', 'b', 'main'); a.columns.push(col('parent')); b.columns.push(col('parent')); fk(a, b); fk(b, a);
  a.columns.push(...Array.from({ length: 30 }, (_, index) => col(`extra${index}`)));
  const model = buildErDiagram([a, b]), columns = Object.fromEntries(model.nodes.map((node) => [node.id, diagramVisibleColumns(node, model, 12, node.table === 'a' ? 'extra29' : undefined)])), layout = layoutErDiagram(model, columns);
  expect(columns[model.nodes[0].id].some((column) => column.name === 'extra29')).toBe(true); expect(columns[model.nodes[0].id].some((column) => column.name === 'parent')).toBe(true);
  for (const [index, box] of layout.boxes.entries()) for (const other of layout.boxes.slice(index + 1)) expect(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y).toBe(true);
  const route = routeErDiagramEdge(model.edges[0], layout, columns); expect(route.length).toBeGreaterThanOrEqual(4); expect(route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  const initial = fitErDiagramViewport(layout, 800, 600), point = { x: 317, y: 240 }, next = zoomErDiagramAt(initial, initial.zoom * 2, point); expect(Math.abs((point.x - initial.x) / initial.zoom - (point.x - next.x) / next.zoom)).toBeLessThan(.00001);
});
test('real SQLite composite FK metadata loads once and its generated JOIN executes accurately', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-er-')), file = path.join(directory, 'fixture.sqlite'), db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE parent(tenant INTEGER NOT NULL,id INTEGER NOT NULL,PRIMARY KEY(tenant,id)); CREATE TABLE child(tenant INTEGER NOT NULL,id INTEGER NOT NULL,parent INTEGER,PRIMARY KEY(tenant,id),FOREIGN KEY(tenant,parent) REFERENCES parent(tenant,id) ON DELETE CASCADE); INSERT INTO parent VALUES(7,9); INSERT INTO child VALUES(7,3,9);'); db.close();
  let driver: RelationalDriver | undefined;
  try {
    driver = await connectSqlite({ provider: 'sqlite', path: file }); const result = await loadRelationalDiagram(driver, { connectionId: 'sqlite', provider: 'sqlite', schema: 'main', tables: ['parent', 'child'] }); expect(result.loadedTables).toBe(2); expect(result.model.edges).toHaveLength(1); expect(result.model.edges[0].targetCardinality).toBe('one');
    const rows = await driver.read(diagramJoinSql(result.model, result.model.edges[0].id), 'main', 10); expect(rows.rows).toHaveLength(1); expect(rows.rows[0]).toEqual([7, 3, 9, 7, 9]);
    const limited = await loadRelationalDiagram(driver, { connectionId: 'sqlite', provider: 'sqlite', schema: 'main', maxTables: 1 }); expect(limited.truncated).toBe(true); expect(limited.catalogTables).toBe(2);
  } finally { await driver?.close(); Bun.gc(true); unlinkSync(file); rmdirSync(directory); }
});
test('cancelled loading waits for all three bounded probes and never reads foreign schemas', async () => {
  const abort = new AbortController(), visited: string[] = []; let running = 0, finished = 0;
  const driver: RelationalDriver = { info: { productName: 'fixture', productVersion: '1', driverName: 'fixture', currentDatabase: 'fixture' }, quoteIdentifier: (name) => name, schemas: async () => [], tables: async (schema) => Array.from({ length: 5 }, (_, index) => ({ name: `table${index}`, schema, kind: 'table', comment: null })),
    columns: async (schema) => { visited.push(schema); running++; await new Promise((resolve) => setTimeout(resolve, 15)); finished++; return [col('id')]; }, structure: async () => { throw new Error('cancel must precede structure'); }, read: async () => { throw new Error('unused'); }, transaction: async () => { throw new Error('unused'); }, assertEditable: async () => {}, close: async () => {} };
  const loading = loadRelationalDiagram(driver, { connectionId: 'connection', provider: 'postgres', schema: 'approved' }, { signal: abort.signal }); setTimeout(() => abort.abort(), 1); await expect(loading).rejects.toThrow(); expect(running).toBe(3); expect(finished).toBe(3); expect(visited.every((schema) => schema === 'approved')).toBe(true);
});
