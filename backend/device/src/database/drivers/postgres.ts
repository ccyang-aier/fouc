import { Pool, types, type QueryResult } from 'pg';
import type { DatabaseColumnInfo, RelationalConnectInput } from '@fouc/shared';
import { quoteRelationalIdentifier as quote } from '../relational-sql';
import { relationalCell, type DriverResult, type Relation, type RelationalDriver } from './relational-driver';
import { DatabaseInputError } from '../input-error';

// Adapted from DBX dbx-drivers/src/db/postgres.rs: catalog-backed metadata,
// connection-local search_path, read-only transactions and bounded cursors.
export async function connectPostgres(
  input: Extract<RelationalConnectInput, { provider: 'postgres' }>,
): Promise<RelationalDriver> {
  const pool = new Pool({
    host: input.host,
    port: input.port,
    user: input.username,
    password: input.password,
    database: input.database,
    ssl: input.ssl ? { rejectUnauthorized: true } : undefined,
    max: 4,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    options: '-c standard_conforming_strings=on',
  });
  pool.on('error', () => {});
  const parser = {
    getTypeParser: (oid: number, format?: string) =>
      [1082, 1114, 1184, 1700, 20].includes(oid)
        ? (value: string) => value
        : types.getTypeParser(oid, format as 'text' | 'binary'),
  };
  try {
    const identity = (await pool.query('SELECT current_database() AS database, version() AS version'))
      .rows[0]!;
    async function read(sql: string, schema: string | null, maxRows: number): Promise<DriverResult> {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query('BEGIN READ ONLY');
        await client.query("SET LOCAL statement_timeout = '30s'");
        if (schema) await client.query("SELECT set_config('search_path', $1, true)", [quote(schema)]);
        let result: QueryResult<unknown[]>;
        if (/^\s*EXPLAIN\b/i.test(sql))
          result = await client.query({ text: sql, rowMode: 'array', types: parser });
        else {
          await client.query(`DECLARE fouc_result NO SCROLL CURSOR FOR ${sql}`);
          result = await client.query({
            text: `FETCH FORWARD ${maxRows + 1} FROM fouc_result`,
            rowMode: 'array',
            types: parser,
          });
        }
        return {
          columns: result.fields.map((field) => field.name),
          columnTypes: result.fields.map((field) => `oid:${field.dataTypeID}`),
          rows: result.rows.slice(0, maxRows).map((row) => row.map(relationalCell)),
          hasMore: result.rows.length > maxRows,
        };
      } finally {
        await client.query('ROLLBACK').catch(() => {
          broken = true;
        });
        client.release(broken);
      }
    }
    return {
      quoteIdentifier: quote,
      info: {
        productName: 'PostgreSQL',
        productVersion: identity.version,
        currentDatabase: identity.database,
        driverName: 'node-postgres',
      },
      async schemas() {
        const result =
          await pool.query(`SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
          AND has_schema_privilege(oid, 'USAGE') ORDER BY nspname`);
        return result.rows.map((row) => String(row.nspname));
      },
      async tables(schema) {
        const result = await pool.query(
          `SELECT c.relname, c.relkind, obj_description(c.oid) AS comment FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind IN ('r','v','m','p','f')
          AND has_table_privilege(c.oid, 'SELECT') ORDER BY c.relname`,
          [schema],
        );
        return result.rows.map(
          (row): Relation => ({
            name: row.relname,
            schema,
            kind: row.relkind === 'v' ? 'view' : row.relkind === 'm' ? 'materialized_view' : 'table',
            comment: row.comment,
          }),
        );
      },
      async columns(schema, table) {
        const result = await pool.query(
          `SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull,
          pg_get_expr(d.adbin, d.adrelid) AS default_value, col_description(c.oid, a.attnum) AS comment,
          a.attidentity, a.attgenerated,
          EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisprimary AND a.attnum=ANY(i.indkey)) AS pk,
          EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts=1 AND i.indpred IS NULL AND a.attnum=i.indkey[0]) AS unique_key
          FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
          LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
          WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
          [schema, table],
        );
        return result.rows.map(
          (row): DatabaseColumnInfo => ({
            name: row.attname,
            dataType: row.type,
            isNullable: !row.attnotnull,
            columnDefault: row.default_value,
            isPrimaryKey: row.pk,
            isUnique: row.unique_key,
            extra: row.attgenerated ? 'generated' : row.attidentity ? 'identity' : null,
            comment: row.comment,
            numericPrecision: null,
            numericScale: null,
            characterMaximumLength: null,
          }),
        );
      },
      read,
      async assertEditable(schema, table) {
        const result = await pool.query(
          `SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname=$1 AND c.relname=$2 AND c.relkind IN ('r','p')`,
          [schema, table],
        );
        if (result.rows.length !== 1) throw new DatabaseInputError('只能编辑普通表或分区表');
      },
      async transaction(schema, run) {
        const client = await pool.connect();
        let broken = false;
        try {
          await client.query('BEGIN');
          await client.query("SET LOCAL statement_timeout = '30s'");
          await client.query("SET LOCAL lock_timeout = '5s'");
          await client.query("SELECT set_config('search_path', $1, true)", [quote(schema)]);
          const result = await run({
            async query(sql, values) {
              const response = await client.query({
                text: sql,
                values: values.map((value) => (value instanceof Uint8Array ? Buffer.from(value) : value)),
                rowMode: 'array',
                types: parser,
              });
              return {
                columns: response.fields.map((field) => field.name),
                columnTypes: response.fields.map((field) => `oid:${field.dataTypeID}`),
                rows: response.rows.map((row) => row.map(relationalCell)),
                hasMore: false,
                affectedRows: response.rowCount ?? 0,
              };
            },
          });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {
            broken = true;
          });
          throw error;
        } finally {
          client.release(broken);
        }
      },
      close: () => pool.end(),
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
