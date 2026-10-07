import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const require = createRequire(new URL('../backend/device/package.json', import.meta.url));
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const admin = new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).DATABASE_ADMIN_URL);
const configs = [
  {
    provider: 'postgres',
    host: admin.hostname,
    port: Number(admin.port),
    username: decodeURIComponent(admin.username),
    password: decodeURIComponent(admin.password),
    database: 'fouc_datastore_lab',
    ssl: false,
  },
  JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8')),
  { provider: 'sqlite', path: path.resolve('.runtime/dbx-lab/relational.sqlite') },
];
const parent = 'dbx_structure_parent',
  child = 'dbx_structure_child',
  view = 'dbx_structure_view';
const base = `http://127.0.0.1:8710/api/database/relational/sessions`;
async function request(route, body, method = body ? 'POST' : 'GET', expected = 200) {
  const response = await fetch(base + route, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(40000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, result.error?.message ?? route);
  return result.data;
}
for (const config of configs) {
  const schema =
    config.provider === 'postgres'
      ? 'public'
      : config.provider === 'sqlite'
        ? 'main'
        : config.database;
  let source;
  if (config.provider === 'postgres') {
    assert.equal(config.database, 'fouc_datastore_lab');
    source = new Pool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    await source.query(`DROP VIEW IF EXISTS public.${view}; DROP TABLE IF EXISTS public.${child}; DROP TABLE IF EXISTS public.${parent};
      CREATE TABLE public.${parent}(tenant int NOT NULL,id int NOT NULL,name text,PRIMARY KEY(tenant,id));
      CREATE TABLE public.${child}(id bigint GENERATED ALWAYS AS IDENTITY(START WITH 42 INCREMENT BY 3),p_tenant int,p_id int,
        name text COLLATE "C" NOT NULL,qty int DEFAULT 2,label text GENERATED ALWAYS AS (name||' · generated') STORED,
        CONSTRAINT dbx_structure_pk PRIMARY KEY(id),CONSTRAINT dbx_structure_check CHECK(qty>=0),
        CONSTRAINT dbx_structure_fk FOREIGN KEY(p_tenant,p_id) REFERENCES public.${parent}(tenant,id)
          MATCH FULL ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED);
      CREATE INDEX dbx_structure_expression ON public.${child}(lower(name) DESC NULLS FIRST) INCLUDE(qty) WHERE name IS NOT NULL;
      CREATE OR REPLACE FUNCTION public.dbx_structure_trigger_fn() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;
      CREATE TRIGGER dbx_structure_trigger BEFORE INSERT OR UPDATE ON public.${child} FOR EACH ROW EXECUTE FUNCTION public.dbx_structure_trigger_fn();
      COMMENT ON TABLE public.${child} IS '结构验证 · O''Brien'; COMMENT ON COLUMN public.${child}.name IS '显示名称';
      CREATE VIEW public.${view} AS SELECT name,qty FROM public.${child}`);
  } else if (config.provider === 'mysql') {
    assert.equal(config.database, 'fouc_datastore_lab');
    assert.equal(config.username, 'fouc_lab');
    source = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    for (const sql of [
      `DROP VIEW IF EXISTS ${view}`,
      `DROP TABLE IF EXISTS ${child}`,
      `DROP TABLE IF EXISTS ${parent}`,
      `CREATE TABLE ${parent}(tenant int NOT NULL,id int NOT NULL,name varchar(100),PRIMARY KEY(tenant,id)) ENGINE=InnoDB`,
      `CREATE TABLE ${child}(id BIGINT AUTO_INCREMENT PRIMARY KEY,p_tenant int,p_id int,name VARCHAR(100) NOT NULL COMMENT '显示名称',
        qty int DEFAULT 2,label VARCHAR(120) GENERATED ALWAYS AS (CONCAT(name,' · generated')) STORED,
        CONSTRAINT dbx_structure_check CHECK(qty>=0),CONSTRAINT dbx_structure_fk FOREIGN KEY(p_tenant,p_id) REFERENCES ${parent}(tenant,id)
        ON UPDATE CASCADE ON DELETE CASCADE) ENGINE=InnoDB COMMENT='结构验证'`,
      `CREATE INDEX dbx_structure_expression ON ${child}((lower(name)))`,
      `CREATE INDEX dbx_structure_prefix ON ${child}(name(10) DESC) INVISIBLE`,
      `CREATE TRIGGER dbx_structure_trigger BEFORE INSERT ON ${child} FOR EACH ROW SET NEW.qty=COALESCE(NEW.qty,2)`,
      `CREATE VIEW ${view} AS SELECT name,qty FROM ${child}`,
    ])
      await source.query(sql);
  } else {
    source = new DatabaseSync(config.path);
    source.exec(`PRAGMA foreign_keys=ON; DROP VIEW IF EXISTS ${view}; DROP TABLE IF EXISTS ${child}; DROP TABLE IF EXISTS ${parent};
      CREATE TABLE ${parent}(tenant INTEGER NOT NULL,id INTEGER NOT NULL,name TEXT,PRIMARY KEY(tenant,id)) WITHOUT ROWID;
      CREATE TABLE ${child}(id INTEGER PRIMARY KEY,p_tenant INTEGER,p_id INTEGER,name TEXT NOT NULL,qty INTEGER DEFAULT 2,
        label TEXT GENERATED ALWAYS AS (name||' · generated') STORED,
        CONSTRAINT dbx_structure_check CHECK(qty>=0),CONSTRAINT dbx_structure_fk FOREIGN KEY(p_tenant,p_id) REFERENCES ${parent}
        ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED) STRICT;
      CREATE INDEX dbx_structure_expression ON ${child}(lower(name) DESC) WHERE name IS NOT NULL;
      CREATE TRIGGER dbx_structure_trigger AFTER INSERT ON ${child} BEGIN UPDATE ${child} SET qty=COALESCE(qty,2) WHERE id=NEW.id; END;
      CREATE VIEW ${view} AS SELECT name,qty FROM ${child};`);
  }
  let session;
  try {
    session = await request('', config, 'POST', 201);
    const tableRoute = `/${session.id}/schemas/${encodeURIComponent(schema)}/tables/`;
    const structure = await request(tableRoute + child + '/structure');
    assert.equal(structure.provider, config.provider);
    assert.equal(structure.kind, 'table');
    assert.match(
      structure.columns.find((column) => column.name === 'label').extra ?? '',
      /generated/i,
    );
    assert.equal(structure.foreignKeys.length, 1);
    const foreign = structure.foreignKeys[0];
    assert.deepEqual(foreign.columns, ['p_tenant', 'p_id']);
    assert.deepEqual(foreign.referencedColumns, ['tenant', 'id']);
    assert.equal(foreign.referencedTable, parent);
    assert.equal(foreign.onDelete, 'CASCADE');
    assert.equal(foreign.onUpdate, 'CASCADE');
    const expression = structure.indexes.find((index) => index.name === 'dbx_structure_expression');
    assert.ok(expression);
    assert.equal(expression.parts[0].column, null);
    assert.equal(expression.parts[0].role, 'key');
    assert.equal(structure.triggers.length, 1);
    assert.match(structure.triggers[0].definition, /CREATE .*TRIGGER/i);
    assert.match(structure.definition.sql, /CREATE TABLE/i);
    assert.match(structure.definition.sql, /GENERATED/i);
    if (config.provider === 'postgres') {
      assert.equal(structure.definition.origin, 'reconstructed');
      assert.match(structure.definition.sql, /GENERATED ALWAYS AS IDENTITY/);
      assert.match(structure.definition.sql, /START WITH 42 INCREMENT BY 3/);
      assert.match(structure.definition.sql, /COLLATE "pg_catalog"\."C"/);
      assert.equal(foreign.deferrable, true);
      assert.equal(foreign.initiallyDeferred, true);
      assert.equal(foreign.match, 'FULL');
      assert.equal(expression.parts[0].descending, true);
      assert.equal(expression.parts[0].nulls, 'first');
      assert.ok(expression.parts[0].expression.includes('lower'));
      assert.equal(expression.parts[1].role, 'include');
      assert.equal(expression.parts[1].column, 'qty');
      assert.match(expression.predicate, /name IS NOT NULL/);
      assert.equal(
        structure.constraints.find((constraint) => constraint.name === 'dbx_structure_check').kind,
        'check',
      );
      assert.deepEqual(structure.triggers[0].events, ['INSERT', 'UPDATE']);
      // Only fixture DDL is reconstructed within a rolled-back transaction; the live fixture stays available for Web QA.
      await source.query('BEGIN');
      try {
        await source.query(`DROP VIEW public.${view}; DROP TABLE public.${child}`);
        await source.query(structure.definition.sql);
      } finally {
        await source.query('ROLLBACK');
      }
    } else if (config.provider === 'mysql') {
      assert.equal(structure.definition.origin, 'native');
      assert.ok(expression.parts[0].expression.includes('lower'));
      const prefix = structure.indexes.find((index) => index.name === 'dbx_structure_prefix');
      assert.equal(prefix.parts[0].prefixLength, 10);
      assert.equal(prefix.parts[0].descending, true);
      assert.equal(prefix.visible, false);
      assert.equal(
        structure.constraints.find((constraint) => constraint.name === 'dbx_structure_check').kind,
        'check',
      );
      assert.equal(structure.properties.engine, 'InnoDB');
      assert.deepEqual(structure.triggers[0].events, ['INSERT']);
    } else {
      assert.equal(structure.definition.origin, 'native');
      assert.equal(structure.properties.strict, 'true');
      assert.equal(foreign.nameSource, 'synthetic');
      assert.equal(foreign.deferrable, null);
      assert.equal(expression.parts[0].descending, true);
      assert.match(expression.definition, /WHERE name IS NOT NULL/);
      const scratch = new DatabaseSync(':memory:');
      try {
        scratch.exec((await request(tableRoute + parent + '/structure')).definition.sql);
        scratch.exec(structure.definition.sql);
        scratch.exec(expression.definition);
        scratch.exec(structure.triggers[0].definition);
      } finally {
        scratch.close();
      }
    }
    const viewStructure = await request(tableRoute + view + '/structure');
    assert.equal(viewStructure.kind, 'view');
    assert.match(viewStructure.definition.sql, /VIEW/i);
    await request(tableRoute + 'dbx_structure_missing/structure', undefined, 'GET', 400);
    const wrong = await fetch(
      base + tableRoute.replace(`/${session.id}/`, `/${crypto.randomUUID()}/`) + child + '/structure',
    );
    assert.equal(wrong.status, 400);
    console.log(
      `PASS structure ${config.provider}: columns/generated, composite FK ordinals/actions, expression indexes, triggers/views, native/reconstructed DDL, scope and missing-object rejection${config.provider === 'postgres' ? ', INCLUDE/NULL order/identity/collation and rolled-back DDL recreation' : config.provider === 'mysql' ? ', prefix/direction/invisible indexes and CHECK' : ', implicit referenced primary key, STRICT and in-memory DDL recreation'}.`,
    );
  } finally {
    if (session) await request('/' + session.id, undefined, 'DELETE');
    if (config.provider === 'sqlite') source.close();
    else await source.end();
  }
}
