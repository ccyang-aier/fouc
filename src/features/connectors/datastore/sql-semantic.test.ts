import { expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { sql, PostgreSQL, MySQL, SQLite } from '@codemirror/lang-sql';
import { ensureSyntaxTree } from '@codemirror/language';
import type { DatabaseColumnInfo, DatabaseObjectInfo, RelationalProvider } from '@fouc/shared';
import { sqlCompletionPosition } from './sql-completion-context';
import { SqlMetadataCompletion } from './sql-metadata-completion';
import { buildSqlSemanticModel } from './sql-semantic/model';
import { tokenizeSqlSemantic } from '@fouc/shared';
import { resolveSqlStatementWindow } from './sql-semantic/statement-window';

function cursor(sql: string) {
  const position = sql.indexOf('|');
  return { sql: sql.replace('|', ''), position };
}
function context(source: string) {
  const { sql, position } = cursor(source);
  return new CompletionContext(EditorState.create({ doc: sql }), position, true);
}
function fixture(provider: RelationalProvider = 'postgres') {
  const calls: string[] = [];
  const table = (name: string): DatabaseObjectInfo => ({
    name,
    schema: 'public',
    database: 'db',
    connectionId: 'session',
    kind: 'table',
    comment: null,
  });
  const column = (name: string, dataType: string): DatabaseColumnInfo => ({
    name,
    dataType,
    isNullable: true,
    columnDefault: null,
    isPrimaryKey: name === 'id',
    isUnique: false,
    extra: null,
    comment: '实际字段说明',
    numericPrecision: null,
    numericScale: null,
    characterMaximumLength: null,
  });
  const model = new SqlMetadataCompletion(provider, {
    tables: async (schema) => {
      calls.push('tables:' + schema);
      return ['items', 'scores'].map(table);
    },
    columns: async (schema, name) => {
      calls.push('columns:' + schema + '.' + name);
      return [
        column('id', 'integer'),
        column(name === 'items' ? 'name' : 'score', name === 'items' ? 'varchar(200)' : 'numeric'),
      ];
    },
  });
  const complete = async (source: string) =>
    (
      await model.complete(context(source), { schema: 'public', schemas: ['public', 'other'] })
    )?.options.filter((item) => item.type === 'property') ?? [];
  return { model, calls, complete };
}

for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
  test(`${provider}: CTE chains retain physical types and rename plain projections`, async () => {
    const { complete, calls } = fixture(provider);
    const fields = await complete(
      'WITH a AS (SELECT name AS label FROM items), b AS (SELECT label AS visible FROM a) SELECT b.vi| FROM b',
    );
    expect(fields.map((field) => field.label)).toEqual(['visible']);
    expect(fields[0].detail).toContain('varchar(200)');
    expect(fields[0].info).toContain('public.items.name');
    expect(calls).toEqual(['tables:public', 'columns:public.items']);
  });
  test(`${provider}: stars, explicit output lists and derived tables preserve projection order`, async () => {
    const { complete } = fixture(provider);
    const fields = await complete(
      'WITH c(a,b,c) AS (SELECT i.*, 1 AS literal FROM items i) SELECT x.a| FROM c x',
    );
    expect(fields.map((field) => field.label)).toEqual(['a', 'b', 'c']);
    expect(fields.map((field) => field.detail?.split(' · ').at(-1))).toEqual([
      'integer',
      'varchar(200)',
      '表达式',
    ]);
    const derived = await complete(
      'SELECT d.na| FROM (SELECT nested.* FROM (SELECT name FROM items) nested) d',
    );
    expect(derived.map((field) => field.label)).toEqual(['name']);
    expect(derived[0].detail).toContain('varchar(200)');
    const reordered = await complete(
      'WITH c AS (SELECT 1 AS extra, i.* FROM items i) SELECT c.ex| FROM c',
    );
    expect(reordered.map((field) => field.label)).toEqual(['extra', 'id', 'name']);
  });
}

test('unreferenced CTEs, sibling queries and isolated CTE bodies never contribute fields', async () => {
  const { complete, calls } = fixture();
  const fields = await complete(
    'WITH hidden AS (SELECT score AS secret FROM scores), c AS (SELECT name FROM items) SELECT na| FROM c',
  );
  expect(fields.map((field) => field.label)).toEqual(['name']);
  expect(calls).not.toContain('columns:public.scores');
  const source = cursor('WITH c AS (SELECT i.na| FROM items i) SELECT * FROM scores outside');
  expect(
    sqlCompletionPosition(source.sql, source.position, 'postgres')?.references.map(
      (ref) => ref.alias,
    ),
  ).toEqual(['i']);
  const derived = cursor('SELECT * FROM items outside, (SELECT s.sc| FROM scores s) d');
  expect(
    sqlCompletionPosition(derived.sql, derived.position, 'postgres')?.references.map(
      (ref) => ref.alias,
    ),
  ).toEqual(['s']);
});

test('quoted Pg names remain case-sensitive and explicit schema references bypass CTE shadowing', async () => {
  const { complete, calls } = fixture();
  const fields = await complete(
    'WITH items AS (SELECT 1 AS fake) SELECT t.na| FROM public.items t',
  );
  expect(fields.map((field) => field.label)).toEqual(['id', 'name']);
  expect(calls).toEqual(['tables:public', 'columns:public.items']);
  const quoted = await complete('WITH "MiX" AS (SELECT 1 AS "FiELD") SELECT m."Fi|" FROM "MiX" m');
  expect(quoted.map((field) => field.label)).toEqual(['FiELD']);
  expect(quoted[0].apply).toBe('"FiELD"');
  expect(await complete('WITH "MiX" AS (SELECT 1 AS "FiELD") SELECT m.fi| FROM mix m')).toEqual([]);
});

test('nested WITH definitions shadow only within their owning query block', async () => {
  const { complete } = fixture();
  const inner = await complete(
    'WITH c AS (SELECT name AS outer_field FROM items) SELECT (WITH c AS (SELECT score AS inner_field FROM scores) SELECT x.in| FROM c x) FROM c',
  );
  expect(inner.map((field) => field.label)).toEqual(['inner_field']);
  const outer = await complete(
    'WITH c AS (SELECT name AS outer_field FROM items) SELECT c.ou|, (WITH c AS (SELECT score AS inner_field FROM scores) SELECT x.inner_field FROM c x) FROM c',
  );
  expect(outer.map((field) => field.label)).toEqual(['outer_field']);
});

test('recursive anchor output lists and materialized CTEs remain local and finite', async () => {
  const { complete, calls } = fixture();
  const fields = await complete(
    'WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<3) SELECT s.n| FROM seq s',
  );
  expect(fields.map((field) => field.label)).toEqual(['n']);
  expect(calls).toEqual([]);
  const materialized = await complete(
    'WITH c AS NOT MATERIALIZED (SELECT name FROM items) SELECT c.na| FROM c',
  );
  expect(materialized.map((field) => field.label)).toEqual(['name']);
  const sameName = await complete(
    'WITH items AS (SELECT name AS label FROM items) SELECT i.la| FROM items i',
  );
  expect(sameName.map((field) => field.label)).toEqual(['label']);
  expect(sameName[0].detail).toContain('varchar(200)');
});

test('nested star expansion respects one four-request metadata budget and drops queued obsolete reads', async () => {
  let concurrent = 0,
    maximum = 0,
    reads = 0;
  const objects = Array.from(
    { length: 12 },
    (_, index) =>
      ({
        name: `table_${index}`,
        kind: 'table',
        schema: 'public',
        database: 'db',
        connectionId: 'session',
        comment: null,
      }) as DatabaseObjectInfo,
  );
  const model = new SqlMetadataCompletion('postgres', {
    tables: async () => objects,
    columns: async (_, table, signal) => {
      concurrent++;
      maximum = Math.max(maximum, concurrent);
      reads++;
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        signal.throwIfAborted();
        return [
          {
            name: table + '_id',
            dataType: 'integer',
            isPrimaryKey: false,
            comment: null,
          } as DatabaseColumnInfo,
        ];
      } finally {
        concurrent--;
      }
    },
  });
  const body = objects.map((table) => table.name).join(' CROSS JOIN ');
  const request = () =>
    model.complete(context(`WITH c AS (SELECT * FROM ${body}) SELECT c.t| FROM c`), {
      schema: 'public',
      schemas: ['public'],
    });
  expect((await request())?.options).toHaveLength(12);
  expect(reads).toBe(12);
  expect(maximum).toBe(4);
  model.clear();
  reads = 0;
  concurrent = 0;
  const pending = request();
  for (let index = 0; reads < 4 && index < 20; index++) await Promise.resolve();
  expect(reads).toBe(4);
  model.clear();
  expect(await pending).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(reads).toBe(4);
  expect(model.getSnapshot()).toEqual({ pending: 0, error: '' });
});

test('global UTF-16 spans and parents survive multiple statements and protected text', () => {
  const input = cursor(
    "SELECT 'fake; FROM wrong'; SELECT (SELECT x.na| FROM items x) FROM scores y;",
  );
  const parsed = sqlCompletionPosition(input.sql, input.position, 'postgres')!;
  expect(parsed.references.map((ref) => ref.alias)).toEqual(['x', 'y']);
  expect(parsed.from).toBe(input.position - 2);
  const pg = tokenizeSqlSemantic(
    "SELECT E'a\\'b', $body$ fake; /* $body$, 1 /* outer /* inner */ still */",
    'postgres',
  );
  expect(pg.filter((token) => token.kind === 'string')).toHaveLength(2);
  expect(pg.filter((token) => token.kind === 'comment')).toHaveLength(1);
  const model = buildSqlSemanticModel('SELECT CAST(name AS TEXT) AS displayed FROM items', 15, {
    provider: 'postgres',
  });
  expect(model.projections.map((projection) => projection.name)).toEqual(['displayed']);
});

test('projection aliases obey native WHERE, GROUP BY, HAVING and ORDER BY visibility', async () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const { complete } = fixture(provider);
    for (const clause of ['WHERE', 'GROUP BY', 'HAVING', 'ORDER BY']) {
      const fields = await complete(`SELECT name AS display_name FROM items ${clause} di|`);
      const expected =
        clause === 'ORDER BY' ||
        clause === 'GROUP BY' ||
        (clause === 'WHERE' && provider === 'sqlite') ||
        (clause === 'HAVING' && provider !== 'postgres');
      expect(fields.some((field) => field.label === 'display_name')).toBe(expected);
    }
  }
});

test('PostgreSQL DISTINCT ON keeps output names, types and positional star aliases', async () => {
  const { complete } = fixture();
  const fields = await complete(
    'WITH c AS (SELECT DISTINCT ON (id) name AS chosen FROM items ORDER BY id) SELECT c.ch| FROM c',
  );
  expect(fields.map((field) => field.label)).toEqual(['chosen']);
  expect(fields[0].detail).toContain('varchar(200)');
  const renamed = await complete(
    'SELECT d.b| FROM (SELECT DISTINCT ON (id) i.* FROM items i) d(a,b)',
  );
  expect(renamed.map((field) => field.label)).toEqual(['a', 'b']);
  expect(renamed[1].detail).toContain('varchar(200)');
});

test('native LATERAL references correlate while ordinary derived sources stay isolated', () => {
  for (const provider of ['postgres', 'mysql'] as const) {
    const lateral = cursor(
      'SELECT * FROM items outside, LATERAL (SELECT outside.na|) d, scores later',
    );
    expect(
      sqlCompletionPosition(lateral.sql, lateral.position, provider)?.references.map(
        (ref) => ref.alias,
      ),
    ).toEqual(['outside']);
    const after = cursor('SELECT d.na| FROM items i, LATERAL (SELECT name FROM items) d');
    expect(
      sqlCompletionPosition(after.sql, after.position, provider)?.references.map(
        (ref) => ref.alias,
      ),
    ).toEqual(['i', 'd']);
  }
  const only = cursor('SELECT s.sc| FROM items i, ONLY scores s');
  expect(
    sqlCompletionPosition(only.sql, only.position, 'postgres')?.references.map((ref) => ref.table),
  ).toEqual(['items', 'scores']);
});

test('live incremental SQL trees keep global offsets and defer Pg protected bodies to native lexing', () => {
  for (const provider of ['postgres', 'mysql', 'sqlite'] as const) {
    const input = cursor("SELECT 'é;fake'; SELECT i.na| FROM items i;");
    const state = EditorState.create({
      doc: input.sql,
      extensions: [
        sql({ dialect: { postgres: PostgreSQL, mysql: MySQL, sqlite: SQLite }[provider] }),
      ],
    });
    expect(ensureSyntaxTree(state, state.doc.length, 50)).not.toBeNull();
    const window = resolveSqlStatementWindow(input.sql, input.position, state, provider);
    expect(input.sql.slice(window.from, window.to).trim()).toBe('SELECT i.na FROM items i');
    expect(sqlCompletionPosition(input.sql, input.position, provider, state)?.from).toBe(
      input.position - 2,
    );
    expect(
      sqlCompletionPosition(input.sql, input.position, provider, state)?.references.map(
        (ref) => ref.table,
      ),
    ).toEqual(['items']);
  }
  for (const body of [
    '$tag$ SELECT fake; FROM wrong $tag$',
    '1 /* outer /* inner; */ still comment */',
  ]) {
    const input = cursor(`SELECT ${body}; SELECT i.na| FROM items i;`);
    const state = EditorState.create({
      doc: input.sql,
      extensions: [sql({ dialect: PostgreSQL })],
    });
    expect(
      sqlCompletionPosition(input.sql, input.position, 'postgres', state)?.references.map(
        (ref) => ref.table,
      ),
    ).toEqual(['items']);
  }
});

test('native Unicode folding differs from ASCII folding and MySQL column case differs from table case', async () => {
  for (const provider of ['postgres', 'mysql', 'sqlite'] as const) {
    const { complete } = fixture(provider);
    const fields = await complete(
      'WITH q AS (SELECT name AS ÄField FROM items) SELECT q.Ä| FROM q',
    );
    expect(fields.map((field) => field.label)).toEqual([
      provider === 'postgres' ? 'Äfield' : 'ÄField',
    ]);
    expect(fields[0].detail).toContain('varchar(200)');
  }
  const mysql = fixture('mysql');
  const fields = await mysql.complete(
    'WITH q AS (SELECT NAME AS label FROM items) SELECT q.la| FROM q',
  );
  expect(fields[0].detail).toContain('varchar(200)');
  expect(
    await mysql.complete('WITH q AS (SELECT name AS label FROM items) SELECT x.la| FROM Q x'),
  ).toEqual([]);
  const sqlite = fixture('sqlite');
  expect(
    await sqlite.complete(
      'WITH "Äq" AS (SELECT name AS label FROM items) SELECT x.la| FROM "äq" x',
    ),
  ).toEqual([]);
  const canonical = await sqlite.complete('SELECT x.na| FROM PUBLIC.ITEMS x');
  expect(canonical.map((field) => field.label)).toEqual(['id', 'name']);
  expect(sqlite.calls).toContain('columns:public.items');
  const ambiguous = await sqlite.complete(
    'WITH a AS (SELECT name AS Foo FROM items), b AS (SELECT score AS FOO FROM scores) SELECT f| FROM a,b',
  );
  expect(
    ambiguous.filter((field) => /^foo$/i.test(field.label)).map((field) => field.apply),
  ).toEqual(['a."Foo"', 'b."FOO"']);
});
