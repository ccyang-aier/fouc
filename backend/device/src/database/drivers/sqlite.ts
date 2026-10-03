import { DatabaseSync } from 'node:sqlite';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseColumnInfo, RelationalConnectInput } from '@fouc/shared';
import { quoteRelationalIdentifier as quote } from '../relational-sql';
import { DatabaseInputError } from '../input-error';
import { relationalCell, type Relation, type RelationalDriver } from './relational-driver';

// DBX sqlite.rs: existing local file, single connection, xinfo (including
// generated columns), composite primary keys and explicit read-only opening.
export async function connectSqlite(
  input: Extract<RelationalConnectInput, { provider: 'sqlite' }>,
): Promise<RelationalDriver> {
  if (!path.isAbsolute(input.path) || !(await stat(input.path)).isFile())
    throw new DatabaseInputError('请选择设备上已有 SQLite 文件的绝对路径');
  const db = new DatabaseSync(input.path, { readOnly: true });
  try {
    db.exec('PRAGMA query_only=ON');
    const identity = db.prepare('SELECT sqlite_version() AS version').get()!;
    return {
      quoteIdentifier: quote,
      info: {
        productName: 'SQLite',
        productVersion: String(identity.version),
        currentDatabase: input.path,
        driverName: 'node:sqlite',
      },
      async schemas() {
        return ['main'];
      },
      async tables(schema) {
        if (schema !== 'main') throw new DatabaseInputError('SQLite 会话仅支持 main');
        return db
          .prepare(
            "SELECT name, type FROM sqlite_schema WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all()
          .map(
            (row): Relation => ({
              name: String(row.name),
              schema,
              kind: row.type === 'view' ? 'view' : 'table',
              comment: null,
            }),
          );
      },
      async columns(schema, table) {
        if (schema !== 'main') throw new DatabaseInputError('SQLite 会话仅支持 main');
        const indices = db
          .prepare(`PRAGMA index_list(${quote(table)})`)
          .all()
          .filter((row) => row.unique === 1 && row.partial === 0);
        const unique = new Set(
          indices.flatMap((index) => {
            const columns = db.prepare(`PRAGMA index_info(${quote(String(index.name))})`).all();
            return columns.length === 1 &&
              Number(columns[0]!.cid) >= 0 &&
              typeof columns[0]!.name === 'string'
              ? [columns[0]!.name]
              : [];
          }),
        );
        return db
          .prepare(`PRAGMA table_xinfo(${quote(table)})`)
          .all()
          .filter((row) => row.hidden !== 1)
          .map(
            (row): DatabaseColumnInfo => ({
              name: String(row.name),
              dataType: String(row.type),
              isNullable: row.notnull !== 1,
              columnDefault: row.dflt_value == null ? null : String(row.dflt_value),
              isPrimaryKey: Number(row.pk) > 0,
              isUnique: unique.has(String(row.name)),
              extra: Number(row.hidden) > 1 ? 'generated' : null,
              comment: null,
              numericPrecision: null,
              numericScale: null,
              characterMaximumLength: null,
            }),
          );
      },
      async read(sql, schema, maxRows, values = []) {
        if (schema && schema !== 'main') throw new DatabaseInputError('SQLite 会话仅支持 main');
        const statement = db.prepare(sql);
        statement.setReadBigInts(true);
        statement.setReturnArrays(true);
        const fields = statement.columns();
        const rows = [];
        for (const row of statement.iterate(
          ...values.map((value) => (typeof value === 'boolean' ? Number(value) : value)),
        )) {
          rows.push(
            (row as unknown as unknown[]).map((value) =>
              typeof value === 'bigint' &&
              value <= BigInt(Number.MAX_SAFE_INTEGER) &&
              value >= BigInt(Number.MIN_SAFE_INTEGER)
                ? Number(value)
                : relationalCell(value),
            ),
          );
          if (rows.length > maxRows) break;
        }
        return {
          columns: fields.map((field) => field.name),
          columnTypes: fields.map((field) => field.type ?? 'dynamic'),
          rows: rows.slice(0, maxRows),
          hasMore: rows.length > maxRows,
        };
      },
      async assertEditable(schema, table) {
        if (
          schema !== 'main' ||
          db.prepare('SELECT type FROM sqlite_schema WHERE name=?').get(table)?.type !== 'table'
        )
          throw new DatabaseInputError('只能编辑 main 中的表');
      },
      async transaction(schema, run) {
        if (schema !== 'main') throw new DatabaseInputError('SQLite 会话仅支持 main');
        const writer = new DatabaseSync(input.path, { open: true, readOnly: false });
        try {
          writer.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
          const result = await run({
            async query(sql, values) {
              const statement = writer.prepare(sql);
              statement.setReadBigInts(true);
              statement.setReturnArrays(true);
              const fields = statement.columns();
              const parameters = values.map((value) => (typeof value === 'boolean' ? Number(value) : value));
              if (!fields.length)
                return {
                  columns: [],
                  columnTypes: [],
                  rows: [],
                  hasMore: false,
                  affectedRows: Number(statement.run(...parameters).changes),
                };
              const rows = statement.all(...parameters) as unknown as unknown[][];
              return {
                columns: fields.map((field) => field.name),
                columnTypes: fields.map((field) => field.type ?? 'dynamic'),
                rows: rows.map((row) =>
                  row.map((value) =>
                    typeof value === 'bigint' &&
                    value <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    value >= BigInt(Number.MIN_SAFE_INTEGER)
                      ? Number(value)
                      : relationalCell(value),
                  ),
                ),
                hasMore: false,
                affectedRows: rows.length,
              };
            },
          });
          writer.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            writer.exec('ROLLBACK');
          } catch {
            /* BEGIN can fail before a transaction exists. */
          }
          throw error;
        } finally {
          writer.close();
        }
      },
      async close() {
        db.close();
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
