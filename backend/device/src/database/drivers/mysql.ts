import mysql from 'mysql2/promise';
import {
  Types,
  type Connection as RawConnection,
  type FieldPacket,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2';
import type { DatabaseColumnInfo, RelationalConnectInput } from '@fouc/shared';
import { DatabaseInputError } from '../input-error';
import { relationalCell, type DriverResult, type RelationalDriver } from './relational-driver';

type Row = RowDataPacket & Record<string, unknown>;
export function quoteMysqlIdentifier(value: string): string {
  if (!value.trim() || value.length > 255 || value.includes('\0'))
    throw new DatabaseInputError('数据库对象名称无效');
  return '`' + value.replaceAll('`', '``') + '`';
}
function optionalNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/** DBX mysql.rs: separate catalog probes, SHOW fallback, exact values and bounded streams. */
export async function connectMysql(
  input: Extract<RelationalConnectInput, { provider: 'mysql' }>,
): Promise<RelationalDriver> {
  const pool = mysql.createPool({
    host: input.host,
    port: input.port,
    user: input.username,
    password: input.password,
    database: input.database || undefined,
    ssl: input.ssl ? { rejectUnauthorized: true } : undefined,
    connectionLimit: 4,
    connectTimeout: 10000,
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
    decimalNumbers: false,
  });
  async function query(sql: string, values?: unknown[]): Promise<Row[]> {
    return (await pool.query<Row[]>(sql, values))[0];
  }
  try {
    const identity = (await query('SELECT VERSION() AS version, DATABASE() AS current_database'))[0]!;
    return {
      info: {
        productName: 'MySQL',
        productVersion: String(identity.version),
        currentDatabase: identity.current_database == null ? undefined : String(identity.current_database),
        driverName: 'mysql2',
      },
      quoteIdentifier: quoteMysqlIdentifier,
      async schemas() {
        let rows: Row[];
        try {
          rows = await query('SHOW DATABASES');
        } catch {
          rows = await query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME');
        }
        return rows.map((row) => String(Object.values(row)[0])).sort();
      },
      async tables(schema) {
        let rows: Row[];
        try {
          rows = await query(
            'SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
            [schema],
          );
        } catch {
          rows = await query(`SHOW FULL TABLES FROM ${quoteMysqlIdentifier(schema)}`);
        }
        return rows.map((row) => ({
          name: String(row.TABLE_NAME ?? Object.values(row)[0]),
          schema,
          kind: String(row.TABLE_TYPE ?? Object.values(row)[1]).includes('VIEW') ? 'view' : 'table',
          comment: row.TABLE_COMMENT == null ? null : String(row.TABLE_COMMENT),
        }));
      },
      async columns(schema, table) {
        const rows = await query(
          `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, COLUMN_KEY,
          NUMERIC_PRECISION, NUMERIC_SCALE, CHARACTER_MAXIMUM_LENGTH, CHARACTER_SET_NAME, COLLATION_NAME
          , EXISTS(SELECT 1 FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA=c.TABLE_SCHEMA AND s.TABLE_NAME=c.TABLE_NAME
            AND s.COLUMN_NAME=c.COLUMN_NAME AND s.NON_UNIQUE=0 AND s.SEQ_IN_INDEX=1
            AND (SELECT COUNT(*) FROM information_schema.STATISTICS k WHERE k.TABLE_SCHEMA=s.TABLE_SCHEMA AND k.TABLE_NAME=s.TABLE_NAME AND k.INDEX_NAME=s.INDEX_NAME)=1) AS single_unique
          FROM information_schema.COLUMNS c WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
          [schema, table],
        );
        return rows.map(
          (row): DatabaseColumnInfo => ({
            name: String(row.COLUMN_NAME),
            dataType: String(row.COLUMN_TYPE),
            isNullable: row.IS_NULLABLE === 'YES',
            columnDefault: row.COLUMN_DEFAULT == null ? null : String(row.COLUMN_DEFAULT),
            isPrimaryKey: row.COLUMN_KEY === 'PRI',
            isUnique: row.single_unique === 1,
            extra: row.EXTRA == null ? null : String(row.EXTRA),
            comment: row.COLUMN_COMMENT == null ? null : String(row.COLUMN_COMMENT),
            numericPrecision: optionalNumber(row.NUMERIC_PRECISION),
            numericScale: optionalNumber(row.NUMERIC_SCALE),
            characterMaximumLength: optionalNumber(row.CHARACTER_MAXIMUM_LENGTH),
            characterSet: row.CHARACTER_SET_NAME == null ? null : String(row.CHARACTER_SET_NAME),
            collation: row.COLLATION_NAME == null ? null : String(row.COLLATION_NAME),
          }),
        );
      },
      async assertEditable(schema, table) {
        const rows = await query(
          "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND TABLE_TYPE='BASE TABLE'",
          [schema, table],
        );
        if (rows.length !== 1 || rows[0]!.ENGINE !== 'InnoDB')
          throw new DatabaseInputError('当前仅支持 InnoDB 表的原子写入');
      },
      async transaction(schema, run) {
        const connection = await pool.getConnection();
        let broken = false;
        try {
          await connection.query(`USE ${quoteMysqlIdentifier(schema)}`);
          await connection.query('SET SESSION innodb_lock_wait_timeout = 5');
          await connection.beginTransaction();
          const result = await run({
            async query(sql, values) {
              const [response, fields] = await connection.execute(
                { sql, rowsAsArray: true, timeout: 30000 },
                values.map((value) => (value instanceof Uint8Array ? Buffer.from(value) : value)),
              );
              const rows = Array.isArray(response) ? (response as unknown[][]) : [];
              return {
                columns: (fields ?? []).map((field) => field.name),
                columnTypes: (fields ?? []).map((field) => String(field.columnType)),
                rows: rows.map((row) => row.map(relationalCell)),
                hasMore: false,
                affectedRows: Array.isArray(response)
                  ? response.length
                  : (response as ResultSetHeader).affectedRows,
              };
            },
          });
          await connection.commit();
          return result;
        } catch (error) {
          await connection.rollback().catch(() => {
            connection.destroy();
            broken = true;
          });
          throw error;
        } finally {
          if (!broken) connection.release();
        }
      },
      async read(sql, schema, maxRows): Promise<DriverResult> {
        const connection = await pool.getConnection();
        let destroyed = false;
        try {
          // Fix the two quote modes the safety scanner assumes, preserving all
          // unrelated modes and the server's strictness settings.
          const [mode] = await connection.query<Row[]>('SELECT @@SESSION.sql_mode AS mode');
          const normalized = String(mode[0]!.mode)
            .split(',')
            .filter((item) => !['ANSI_QUOTES', 'NO_BACKSLASH_ESCAPES'].includes(item));
          await connection.query('SET SESSION sql_mode = ?', [normalized.join(',')]);
          await connection.query('SET SESSION max_execution_time = 30000');
          if (schema) await connection.query(`USE ${quoteMysqlIdentifier(schema)}`);
          await connection.query('START TRANSACTION READ ONLY');
          const raw = connection.connection as unknown as RawConnection;
          const request = raw.query({ sql, rowsAsArray: true, timeout: 30000 });
          let fields: FieldPacket[] = [];
          request.on('fields', (metadata: FieldPacket[]) => {
            fields = metadata;
          });
          const stream = request.stream({ highWaterMark: 16 });
          const rows: unknown[][] = [];
          let hasMore = false;
          for await (const row of stream) {
            if (rows.length === maxRows) {
              hasMore = true;
              stream.destroy();
              connection.destroy();
              destroyed = true;
              break;
            }
            rows.push(row as unknown[]);
          }
          return {
            columns: fields.map((field) => field.name),
            columnTypes: fields.map(
              (field) =>
                field.typeName ??
                (Types as unknown as Record<number, string>)[field.columnType ?? -1] ??
                'unknown',
            ),
            rows: rows.map((row) => row.map(relationalCell)),
            hasMore,
          };
        } finally {
          if (!destroyed) {
            await connection.query('ROLLBACK').catch(() => {
              connection.destroy();
              destroyed = true;
            });
            if (!destroyed) connection.release();
          }
        }
      },
      close: () => pool.end(),
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
