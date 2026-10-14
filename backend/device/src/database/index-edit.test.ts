import { expect, test, setSystemTime } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type {
  DatabaseColumnInfo,
  RelationalIndex,
  RelationalProvider,
  RelationalTableStructure,
} from '@fouc/shared';
import {
  INDEX_EDIT_LIMITS,
  indexEditDropReason,
  validateIndexEditInput,
  type IndexEditInput,
  type IndexEditOptions,
} from '@fouc/shared/index-edit';
import type { DriverResult, RelationalDriver } from './drivers/relational-driver';
import { IndexEditPlans } from './index-edit-plans';
import { buildIndexEditReview } from './index-edit-sql';
import { indexEditRoutes } from '../api/index-edit-routes';

function column(name: string, dataType = 'varchar(100)'): DatabaseColumnInfo {
  return {
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
    characterMaximumLength: 100,
  };
}
function index(name: string, patch: Partial<RelationalIndex> = {}): RelationalIndex {
  return {
    name,
    method: 'btree',
    unique: false,
    primary: false,
    valid: true,
    visible: true,
    constraintBacked: false,
    parts: [
      {
        position: 1,
        column: 'label',
        expression: null,
        role: 'key',
        descending: false,
        nulls: null,
        prefixLength: null,
        collation: null,
      },
    ],
    predicate: null,
    definition: null,
    comment: null,
    ...patch,
  };
}
function options(
  provider: RelationalProvider,
  patch: Partial<RelationalTableStructure> = {},
): IndexEditOptions {
  return {
    provider,
    permission: 'allowed',
    capabilities: {
      descending: true,
      prefix: provider === 'mysql',
      include: provider === 'postgres',
      nullsNotDistinct: provider === 'postgres',
    },
    warnings: [],
    structure: {
      connectionId: '',
      provider,
      schema: provider === 'sqlite' ? 'main' : 'lab',
      table: 'rows',
      kind: 'table',
      columns: [column('label'), column('category'), column('payload', 'text')],
      indexes: [index('existing')],
      foreignKeys: [],
      constraints: [],
      triggers: [],
      properties: { engine: 'InnoDB' },
      definition: { sql: '', origin: 'native', warnings: [] },
      ...patch,
    },
  };
}
function draft(
  provider: RelationalProvider,
  patch: Partial<Extract<IndexEditInput, { operation: 'create' }>> = {},
): IndexEditInput {
  return {
    operation: 'create',
    schema: provider === 'sqlite' ? 'main' : 'lab',
    table: 'rows',
    name: 'fresh',
    unique: false,
    columns: [{ column: 'label', direction: 'asc', prefix: null }],
    include: [],
    nullsNotDistinct: false,
    ...patch,
  };
}
const allowed = () => undefined;
function response(rows: DriverResult['rows']): DriverResult {
  return { rows, columns: [], columnTypes: [], hasMore: false };
}
function fixture(provider: RelationalProvider = 'postgres') {
  const metadata = options(provider);
  const state = {
    collision: false,
    permitted: true,
    writes: [] as string[],
    fail: null as Error | null,
    after: null as (() => void) | null,
  };
  const driver = {
    info: {
      productVersion:
        provider === 'postgres'
          ? 'PostgreSQL 16.4 on linux'
          : provider === 'mysql'
            ? '8.4.0'
            : '3.49.1',
    },
    quoteIdentifier: (value: string) => '"' + value.replaceAll('"', '""') + '"',
    columns: async () => metadata.structure.columns,
    structure: async () => metadata.structure,
    read: async (sql: string) =>
      sql.includes(' AS allowed')
        ? response([[state.permitted]])
        : response(state.collision ? [['exists']] : []),
    transaction: async (_schema: string, run: Parameters<RelationalDriver['transaction']>[1]) => {
      const value = await run({
        query: async (sql) => {
          if (!sql.startsWith('LOCK TABLE')) {
            state.writes.push(sql);
            if (state.fail) throw state.fail;
          }
          return { ...response([]), affectedRows: 0 };
        },
      });
      state.after?.();
      return value;
    },
  } as unknown as RelationalDriver;
  return { driver, state, metadata };
}

test('native index DDL quotes identifiers, preserves composite order and uses provider-specific namespace/options', () => {
  const my = options('mysql', {
    table: 'quoted`table',
    columns: [column('quoted`column'), column('category')],
  });
  const mysql = buildIndexEditReview(
    my,
    draft('mysql', {
      table: my.structure.table,
      name: 'quoted`index',
      unique: true,
      columns: [
        { column: 'quoted`column', direction: 'desc', prefix: 12 },
        { column: 'category', direction: 'asc', prefix: null },
      ],
    }),
  ).review;
  expect(mysql.sql).toBe(
    'CREATE UNIQUE INDEX `quoted``index` ON `lab`.`quoted``table` (`quoted``column`(12) DESC, `category` ASC);',
  );
  expect(mysql.transaction).toBe('implicit-commit');
  const pg = buildIndexEditReview(
    options('postgres'),
    draft('postgres', {
      name: 'quote"index',
      unique: true,
      columns: [{ column: 'label', direction: 'desc', prefix: null }],
      include: ['category'],
      nullsNotDistinct: true,
    }),
  ).review;
  expect(pg.sql).toBe(
    'CREATE UNIQUE INDEX "quote""index" ON "lab"."rows" ("label" DESC) INCLUDE ("category") NULLS NOT DISTINCT;',
  );
  expect(pg.transaction).toBe('atomic');
  expect(buildIndexEditReview(options('sqlite'), draft('sqlite')).review.sql).toBe(
    'CREATE INDEX "main"."fresh" ON "rows" ("label" ASC);',
  );
  expect(
    buildIndexEditReview(options('mysql'), {
      operation: 'drop',
      schema: 'lab',
      table: 'rows',
      name: 'existing',
    }).review.sql,
  ).toBe('DROP INDEX `existing` ON `lab`.`rows`;');
  expect(
    buildIndexEditReview(options('postgres'), {
      operation: 'drop',
      schema: 'lab',
      table: 'rows',
      name: 'existing',
    }).review.sql,
  ).toBe('DROP INDEX "lab"."existing";');
});

test('strict structured inputs reject arbitrary SQL, unknown columns, incompatible capabilities and protected native indexes', () => {
  const invalid = [
    { ...draft('postgres'), sql: 'DROP TABLE secret' },
    draft('postgres', {
      columns: [{ column: 'label DESC); DROP TABLE secret', direction: 'asc', prefix: null }],
    }),
    draft('postgres', { columns: [{ column: 'label', direction: 'asc', prefix: 2 }] }),
    draft('postgres', { include: ['label'] }),
    draft('postgres', { include: ['missing'] }),
    draft('postgres', { nullsNotDistinct: true }),
    draft('postgres', { schema: 'pg_catalog' }),
    draft('postgres', { name: '汉'.repeat(22) }),
    draft('postgres', {
      columns: Array.from({ length: 17 }, () => ({
        column: 'label',
        direction: 'asc' as const,
        prefix: null,
      })),
    }),
  ];
  for (const input of invalid)
    expect(() => validateIndexEditInput(options('postgres'), input)).toThrow();
  expect(() =>
    validateIndexEditInput(
      options('mysql'),
      draft('mysql', { columns: [{ column: 'payload', direction: 'asc', prefix: null }] }),
    ),
  ).toThrow('前缀');
  expect(() =>
    validateIndexEditInput(
      options('mysql'),
      draft('mysql', { columns: [{ column: 'label', direction: 'asc', prefix: 101 }] }),
    ),
  ).toThrow('长度');
  expect(() =>
    validateIndexEditInput(options('sqlite'), draft('sqlite', { include: ['category'] })),
  ).toThrow('INCLUDE');
  const old = options('postgres');
  old.capabilities.nullsNotDistinct = false;
  expect(() =>
    validateIndexEditInput(old, draft('postgres', { unique: true, nullsNotDistinct: true })),
  ).toThrow('15+');
  expect(
    indexEditDropReason('postgres', index('pk', { primary: true }), options('postgres').structure)
      ?.message,
  ).toContain('主键');
  expect(
    indexEditDropReason(
      'sqlite',
      index('uq', { constraintBacked: true }),
      options('sqlite').structure,
    )?.message,
  ).toContain('约束');
  expect(
    indexEditDropReason(
      'mysql',
      index('uq', { constraintBacked: true, unique: true }),
      options('mysql').structure,
    ),
  ).toBeNull();
  const foreign = options('mysql');
  foreign.structure.foreignKeys.push({
    name: 'fk',
    nameSource: 'catalog',
    columns: ['label'],
    referencedSchema: 'lab',
    referencedTable: 'target',
    referencedColumns: ['id'],
    onUpdate: 'NO ACTION',
    onDelete: 'NO ACTION',
    match: 'NONE',
    deferrable: null,
    initiallyDeferred: null,
    validated: null,
    definition: null,
  });
  expect(indexEditDropReason('mysql', index('fk_support'), foreign.structure)?.message).toContain(
    '外键',
  );
});

test('readonly single-use plans bind to the live session, fresh structure/permission, lock and expiry with truthful native failure', async () => {
  const { driver, state, metadata } = fixture(),
    plans = new IndexEditPlans();
  const prepared = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  expect(state.writes).toEqual([]);
  await expect(
    plans.commit(driver, prepared.planId, () => {
      throw new Error('locked');
    }),
  ).rejects.toThrow('locked');
  expect((await plans.commit(driver, prepared.planId, allowed)).outcome).toBe('created');
  await expect(plans.commit(driver, prepared.planId, allowed)).rejects.toThrow('失效');
  const changed = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  metadata.structure.columns.push(column('later'));
  expect((await plans.commit(driver, changed.planId, allowed)).outcome).toBe('rejected');
  metadata.structure.columns.pop();
  const denied = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  state.permitted = false;
  expect((await plans.commit(driver, denied.planId, allowed)).outcome).toBe('rejected');
  state.permitted = true;
  const conflict = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  state.collision = true;
  expect((await plans.commit(driver, conflict.planId, allowed)).outcome).toBe('rejected');
  state.collision = false;
  const wrong = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  await expect(plans.commit(fixture().driver, wrong.planId, allowed)).rejects.toThrow('变化');
  const expired = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  try {
    setSystemTime(new Date(expired.expiresAt + 1));
    await expect(plans.commit(driver, expired.planId, allowed)).rejects.toThrow('失效');
  } finally {
    setSystemTime();
  }
  const revoked = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  plans.clear();
  await expect(plans.commit(driver, revoked.planId, allowed)).rejects.toThrow('失效');
  expect(state.writes.length).toBe(1);
  const uncertain = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  state.after = () => {
    throw Object.assign(new Error('COMMIT response lost'), { code: 'ECONNRESET' });
  };
  expect((await plans.commit(driver, uncertain.planId, allowed)).outcome).toBe('unknown');
  state.after = null;
  const rejected = await plans.prepare(driver, 'postgres', draft('postgres'), allowed);
  state.fail = Object.assign(new Error('duplicate key'), { code: '23505' });
  expect((await plans.commit(driver, rejected.planId, allowed)).outcome).toBe('rejected');
  const old = fixture('mysql');
  old.driver.info.productVersion = '5.7.44';
  expect(
    (await plans.options(old.driver, 'mysql', 'lab', 'rows', allowed)).capabilities.descending,
  ).toBe(false);
  old.driver.info.productVersion = '10.6.12-MariaDB';
  expect(
    (await plans.options(old.driver, 'mysql', 'lab', 'rows', allowed)).capabilities.descending,
  ).toBe(false);
});

test('real SQLite index DDL enforces uniqueness, retains data, protects constraints and rolls back failed construction', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      "CREATE TABLE rows(label TEXT, category TEXT, payload TEXT); INSERT INTO rows VALUES ('a','x',NULL), ('b','x',NULL);",
    );
    const create = buildIndexEditReview(
      options('sqlite'),
      draft('sqlite', {
        unique: true,
        columns: [
          { column: 'label', direction: 'desc', prefix: null },
          { column: 'category', direction: 'asc', prefix: null },
        ],
      }),
    ).review;
    db.exec('BEGIN IMMEDIATE');
    db.exec(create.sql);
    db.exec('COMMIT');
    const native = db.prepare('PRAGMA index_list("rows")').all();
    expect(native[0]?.name).toBe('fresh');
    expect(native[0]?.unique).toBe(1);
    const keys = db.prepare('PRAGMA index_xinfo("fresh")').all();
    expect(keys[0]?.name).toBe('label');
    expect(keys[0]?.desc).toBe(1);
    expect(keys[1]?.name).toBe('category');
    expect(() => db.exec("INSERT INTO rows VALUES('a','x',NULL)")).toThrow();
    const metadata = options('sqlite', { indexes: [index('fresh', { unique: true })] });
    db.exec(
      buildIndexEditReview(metadata, {
        operation: 'drop',
        schema: 'main',
        table: 'rows',
        name: 'fresh',
      }).review.sql,
    );
    expect(db.prepare('SELECT count(*) AS count FROM rows').get()?.count).toBe(2);
    expect(db.prepare('PRAGMA index_list("rows")').all()).toEqual([]);
    db.exec('BEGIN IMMEDIATE');
    expect(() =>
      db.exec(
        buildIndexEditReview(
          options('sqlite'),
          draft('sqlite', {
            unique: true,
            columns: [{ column: 'category', direction: 'asc', prefix: null }],
          }),
        ).review.sql,
      ),
    ).toThrow();
    db.exec('ROLLBACK');
    expect(db.prepare('PRAGMA index_list("rows")').all()).toEqual([]);
  } finally {
    db.close();
  }
});

test('route rejects arbitrary SQL, unconfirmed deletion and oversized plans before calling a writer', async () => {
  let commits = 0,
    prepares = 0;
  const app = new Hono().route(
    '/',
    indexEditRoutes({
      indexEditOptions: async () => options('sqlite'),
      prepareIndexEdit: async () => {
        prepares++;
        throw new Error('stop');
      },
      commitIndexEdit: async () => {
        commits++;
        throw new Error('stop');
      },
      discardIndexEdit: () => undefined,
    }),
  );
  app.onError((error) => new Response(error.message, { status: 400 }));
  const base = '/api/database/relational/sessions/s/index-edit';
  for (const value of [{ confirm: false }, { confirm: true, sql: 'DROP INDEX x' }, {}])
    expect(
      (
        await app.request(`${base}/plans/token/commit`, {
          method: 'POST',
          body: JSON.stringify(value),
        })
      ).status,
    ).toBe(400);
  expect(
    (
      await app.request(`${base}/plans`, {
        method: 'POST',
        body: 'x'.repeat(INDEX_EDIT_LIMITS.requestBytes + 1),
      })
    ).status,
  ).toBe(400);
  expect((await app.request(`${base}/options?schema=main&table=rows&sql=CREATE`)).status).toBe(400);
  expect(commits).toBe(0);
  expect(prepares).toBe(0);
});
