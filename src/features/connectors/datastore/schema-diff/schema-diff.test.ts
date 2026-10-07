import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import type { DatabaseColumnInfo, RelationalForeignKey, RelationalIndex, RelationalProvider, RelationalTableStructure } from '@fouc/shared'
import { buildSchemaDiff } from './compare'
import { parseTableDdl, normalizeSchemaSql, generatedColumn } from './ddl-source'
import { createIndexDdl } from './ddl'
import { buildSchemaDiffScript, expandSchemaDiffSelection } from './script'

function column(name: string, type = 'INTEGER', nullable = true, defaultValue: string | null = null): DatabaseColumnInfo {
  return { name, dataType: type, isNullable: nullable, columnDefault: defaultValue, isPrimaryKey: false, isUnique: false, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null }
}
function table(provider: RelationalProvider, name: string, columns: DatabaseColumnInfo[], sql: string): RelationalTableStructure {
  return { connectionId: name + '-connection', provider, schema: provider === 'sqlite' ? 'main' : provider === 'postgres' ? 'public' : 'fouc_datastore_lab', table: name, kind: 'table', columns,
    indexes: [], constraints: [], foreignKeys: [], triggers: [], properties: {}, definition: { sql, origin: 'native', warnings: [] } }
}
function index(name: string, columnName: string): RelationalIndex {
  return { name, method: 'btree', unique: false, primary: false, valid: true, visible: true, constraintBacked: false, predicate: null, definition: null, comment: null,
    parts: [{ position: 1, column: columnName, expression: null, role: 'key', descending: false, nulls: null, prefixLength: null, collation: null }] }
}
function foreign(name: string, columnName: string, referencedTable: string): RelationalForeignKey {
  return { name, nameSource: 'catalog', columns: [columnName], referencedSchema: 'public', referencedTable, referencedColumns: ['id'], onUpdate: 'NO ACTION', onDelete: 'CASCADE', match: 'SIMPLE', deferrable: false, initiallyDeferred: false, validated: true, definition: null }
}

test('native CREATE parsing preserves nested expressions, commas, strings and quoted names', () => {
  const sql = 'CREATE TABLE "odd,name" ("id" INTEGER PRIMARY KEY, "value" TEXT DEFAULT \'a,b  c\', "g" TEXT GENERATED ALWAYS AS (substr("value",1,2)) STORED, CHECK(length("value")>0)) STRICT;'
  const parsed = parseTableDdl(sql, 'sqlite')!
  expect(parsed.columns.size).toBe(3)
  expect(parsed.columns.get('value')).toContain("DEFAULT 'a,b  c'")
  expect(parsed.clauses).toEqual(['CHECK(length("value")>0)'])
  expect(parsed.suffix).toBe('STRICT')
  expect(normalizeSchemaSql("DEFAULT 'a  b'", 'postgres')).not.toBe(normalizeSchemaSql("default 'a b'", 'postgres'))
  expect(generatedColumn(column('v', 'text'), '"v" TEXT DEFAULT \'GENERATED AS (x)\'')).toBe(false)
  expect(generatedColumn({ ...column('id'), extra: 'identity' }, '"id" bigint GENERATED ALWAYS AS IDENTITY')).toBe(false)
})

test('fields, order, null/default/comment/generated differences use source as desired and target as physical', () => {
  const src = table('postgres', 'source', [column('id', 'bigint', false, '2'), { ...column('v', 'text'), comment: 'new' }], 'CREATE TABLE source (id bigint NOT NULL DEFAULT 2, v text);')
  const dst = table('postgres', 'target', [column('v', 'text'), column('id', 'integer', true, '1')], 'CREATE TABLE target (v text, id integer DEFAULT 1);')
  const diff = buildSchemaDiff('postgres', src, dst, { compareColumnOrder: true })
  const id = diff.changes.find((change) => change.name === 'id')!
  expect(id.fields.map((field) => field.key)).toEqual(['type', 'nullable', 'default', 'order'])
  const script = buildSchemaDiffScript(diff)
  expect(script.sql).toContain('ALTER TABLE "public"."target" ALTER COLUMN "id" TYPE bigint USING "id"::bigint;')
  expect(script.sql).toContain('SET DEFAULT 2')
  expect(script.sql).toContain('SET NOT NULL')
  expect(script.sql).toContain('COMMENT ON COLUMN "public"."target"."v" IS E\'new\'')
  expect(script.issues.some((issue) => issue.severity === 'unsupported' && issue.message.includes('顺序'))).toBe(true)
})

test('MySQL integer display width is equal, real unsigned/precision changes are retained', () => {
  const src = table('mysql', 'a', [column('id', 'int(11) unsigned')], 'CREATE TABLE a (`id` int(11) unsigned);')
  const dst = table('mysql', 'b', [column('id', 'int unsigned')], 'CREATE TABLE b (`id` int unsigned);')
  expect(buildSchemaDiff('mysql', src, dst).changes).toHaveLength(0)
  src.columns[0].dataType = 'int'
  expect(buildSchemaDiff('mysql', src, dst).changes[0].fields[0].key).toBe('type')
})

test('new generated columns follow base type changes; existing generated dependencies require review', () => {
  const src = table('postgres', 'a', [column('name', 'varchar(64)'), { ...column('g', 'text', true, 'upper(name)'), extra: 'generated' }], 'CREATE TABLE a(name varchar(64),g text GENERATED ALWAYS AS (upper(name)) STORED);')
  const dst = table('postgres', 'b', [column('name', 'varchar(20)')], 'CREATE TABLE b(name varchar(20));')
  const first = buildSchemaDiffScript(buildSchemaDiff('postgres', src, dst))
  expect(first.sql.indexOf('TYPE varchar(64)')).toBeLessThan(first.sql.indexOf('ADD COLUMN g'))
  dst.columns.push({ ...column('g', 'text', true, 'upper(name)'), extra: 'generated' })
  dst.definition.sql = 'CREATE TABLE b(name varchar(20),g text GENERATED ALWAYS AS (upper(name)) STORED);'
  const existing = buildSchemaDiffScript(buildSchemaDiff('postgres', src, dst))
  expect(existing.issues.some((issue) => issue.severity === 'unsupported' && issue.message.includes('生成列 g'))).toBe(true)
  expect(existing.sql).not.toContain('ALTER COLUMN "name" TYPE')
})

test('index native definitions retain opclasses/INCLUDE/partial predicates and native MySQL syntax', () => {
  const pg = table('postgres', 'target', [column('name', 'text')], 'CREATE TABLE target(name text);')
  const definition = { ...index('name_idx', 'name'), definition: 'CREATE INDEX name_idx ON public.source USING btree (name text_pattern_ops DESC NULLS LAST) INCLUDE (id) WHERE name IS NOT NULL' }
  const sql = createIndexDdl(definition, pg)
  expect(sql).toContain('ON "public"."target" USING btree')
  expect(sql).toContain('text_pattern_ops DESC NULLS LAST) INCLUDE (id) WHERE name IS NOT NULL')
  const mysql = table('mysql', 'target', [column('name', 'varchar(100)')], 'CREATE TABLE target(name varchar(100));')
  const idx = index('name_idx', 'name'); idx.parts[0].prefixLength = 12; idx.visible = false
  expect(createIndexDdl(idx, mysql)).toBe('CREATE INDEX `name_idx` ON `fouc_datastore_lab`.`target` (`name`(12) ASC) USING btree INVISIBLE;')
  const source = table('postgres', 'source', [column('name', 'text')], 'CREATE TABLE source(name text);')
  source.indexes = [{ ...index('same_idx', 'name'), definition: 'CREATE INDEX same_idx ON source(name text_pattern_ops)' }]
  pg.indexes = [{ ...index('same_idx', 'name'), definition: 'CREATE INDEX same_idx ON target(name)' }]
  expect(buildSchemaDiff('postgres', source, pg).changes[0].fields.some((field) => field.key === 'definition')).toBe(true)
})

test('selection closure adds prerequisite columns and index drops for removed fields', () => {
  const src = table('mysql', 'source', [column('new')], 'CREATE TABLE source(`new` INTEGER);')
  const dst = table('mysql', 'target', [column('old')], 'CREATE TABLE target(`old` INTEGER);')
  src.indexes = [index('new_idx', 'new')]; dst.indexes = [index('old_idx', 'old')]
  const diff = buildSchemaDiff('mysql', src, dst)
  const selected = expandSchemaDiffSelection(diff, diff.changes.filter((change) => change.name === 'new_idx' || change.name === 'old').map((change) => change.id))
  expect([...selected].length).toBe(4)
  const script = buildSchemaDiffScript(diff, [...selected])
  expect(script.sql.indexOf('DROP INDEX')).toBeLessThan(script.sql.indexOf('DROP COLUMN'))
  expect(script.sql.indexOf('ADD COLUMN')).toBeLessThan(script.sql.indexOf('CREATE INDEX'))
})

test('known incoming foreign keys are dropped before primary/type changes and restored afterward', () => {
  const src = table('postgres', 'parent', [column('id', 'bigint')], 'CREATE TABLE parent(id bigint);')
  const dst = table('postgres', 'parent', [column('id', 'integer')], 'CREATE TABLE parent(id integer);')
  const child = table('postgres', 'child', [column('parent_id')], 'CREATE TABLE child(parent_id integer);')
  child.foreignKeys = [foreign('child_parent_fk', 'parent_id', 'parent')]
  const diff = buildSchemaDiff('postgres', [src, child], [dst, structuredClone(child)])
  const script = buildSchemaDiffScript(diff)
  expect(script.steps[0].sql).toContain('DROP CONSTRAINT "child_parent_fk"')
  expect(script.steps.at(-1)!.sql).toContain('ADD CONSTRAINT "child_parent_fk"')
  expect(script.sql).toContain('REFERENCES "public"."parent" ("id")')
})

test('SQLite rebuild actually preserves rows, rowid, trigger, indexes and AUTOINCREMENT high water', () => {
  const srcColumns = [{ ...column('id'), isPrimaryKey: true }, column('name', 'TEXT', false, "'unknown'"), { ...column('g', 'TEXT'), extra: 'generated' }]
  const dstColumns = [{ ...column('id'), isPrimaryKey: true }, column('name', 'TEXT')]
  const src = table('sqlite', 'source', srcColumns, 'CREATE TABLE source(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT \'unknown\', g TEXT GENERATED ALWAYS AS (upper(name)) STORED, CHECK(length(name)>0));')
  const dst = table('sqlite', 'target', dstColumns, 'CREATE TABLE target(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);')
  dst.properties.withoutRowid = src.properties.withoutRowid = 'false'
  dst.indexes = [{ ...index('target_name_idx', 'name'), definition: 'CREATE INDEX target_name_idx ON target(name)' }]
  src.indexes = structuredClone(dst.indexes)
  dst.triggers = [{ name: 'target_audit', timing: 'AFTER', events: ['INSERT'], orientation: 'ROW', enabled: 'ENABLED', definition: 'CREATE TRIGGER target_audit AFTER INSERT ON target BEGIN INSERT INTO audit(id) VALUES (NEW.id); END;' }]
  src.triggers = structuredClone(dst.triggers)
  const script = buildSchemaDiffScript(buildSchemaDiff('sqlite', src, dst))
  expect(script.sql).toContain('PRAGMA foreign_key_check')
  expect(script.sql).not.toMatch(/^COMMIT;/m)
  const setup = "CREATE TABLE audit(id INTEGER); CREATE TABLE target(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT); INSERT INTO target(id,name) VALUES(5,'Ada'),(100,'deleted');DELETE FROM target WHERE id=100;CREATE INDEX target_name_idx ON target(name);CREATE TRIGGER target_audit AFTER INSERT ON target BEGIN INSERT INTO audit(id) VALUES(NEW.id);END;"
  const program = `import{DatabaseSync}from'node:sqlite';const d=new DatabaseSync(':memory:');d.exec(${JSON.stringify(setup)});d.exec(${JSON.stringify(script.sql)});const before=d.prepare('SELECT rowid,id,name,g FROM target').all();const issues=d.prepare('PRAGMA foreign_key_check').all();if(issues.length)throw Error('foreign keys');d.exec(${JSON.stringify("COMMIT;INSERT INTO target(name)VALUES('Bob');")});console.log(JSON.stringify({before,after:d.prepare('SELECT id,g FROM target ORDER BY id').all(),audit:d.prepare('SELECT id FROM audit').all(),indexes:d.prepare("SELECT name FROM sqlite_schema WHERE type='index' AND name='target_name_idx'").all()}));d.close();`
  const actual = JSON.parse(execFileSync('node', ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', program], { encoding: 'utf8' }))
  expect(actual.before).toEqual([{ id: 5, name: 'Ada', g: 'ADA' }])
  expect(actual.after).toEqual([{ id: 5, g: 'ADA' }, { id: 101, g: 'BOB' }])
  expect(actual.audit).toEqual([{ id: 101 }])
  expect(actual.indexes).toEqual([{ name: 'target_name_idx' }])
})

test('SQLite new NOT NULL without backfill stops before destructive steps; unsupported changes never leave half-drops', () => {
  const src = table('sqlite', 'a', [column('id'), column('required', 'TEXT', false)], 'CREATE TABLE a(id INTEGER,required TEXT NOT NULL);')
  const dst = table('sqlite', 'b', [column('id')], 'CREATE TABLE b(id INTEGER);')
  const script = buildSchemaDiffScript(buildSchemaDiff('sqlite', src, dst))
  expect(script.steps).toHaveLength(0)
  expect(script.reviewComplete).toBe(false)
  expect(script.issues.some((issue) => issue.message.includes('回填'))).toBe(true)
  const pgSrc = table('postgres', 'a', [column('id')], 'CREATE TABLE a(id INTEGER);')
  const pgDst = table('postgres', 'b', [column('id')], 'CREATE TABLE b(id INTEGER);')
  pgSrc.indexes = [{ ...index('idx', 'id'), valid: false }]; pgDst.indexes = [index('idx', 'id')]
  const partial = buildSchemaDiffScript(buildSchemaDiff('postgres', pgSrc, pgDst))
  expect(partial.steps).toHaveLength(0)
  expect(partial.sql).not.toContain('DROP INDEX')
})

test('collection mapping compares missing objects and guards unsupported providers', () => {
  const a = table('postgres', 'a', [column('id')], 'CREATE TABLE a(id INTEGER);')
  const b = table('postgres', 'b', [column('id')], 'CREATE TABLE b(id INTEGER);')
  const diff = buildSchemaDiff('postgres', [a], [b], { tableMappings: [{ sourceTable: 'a', targetTable: 'b' }] })
  expect(diff.changes).toHaveLength(0)
  expect(buildSchemaDiff('postgres', [a], []).changes[0].operation).toBe('add')
  expect(buildSchemaDiff('postgres', [], [b]).changes[0].operation).toBe('remove')
  expect(() => buildSchemaDiff('oracle' as never, a, b)).toThrow('暂不支持')
  expect(() => buildSchemaDiff('sqlite', a, b)).toThrow('相同')
})
