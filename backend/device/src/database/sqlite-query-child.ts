import { DatabaseSync } from 'node:sqlite';
import { relationalCell } from './drivers/relational-driver';

/** Internal stdin/stdout protocol; no socket, server, credentials or writable database. */
export async function runSqliteQueryChild(): Promise<void> {
  let database: DatabaseSync | undefined;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      file: string; sql: string; maxRows: number;
      values: Array<string | number | boolean | null | { integer: string } | { binary: string }>;
    };
    database = new DatabaseSync(input.file, { readOnly: true });
    database.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=5000');
    const statement = database.prepare(input.sql);
    statement.setReadBigInts(true); statement.setReturnArrays(true);
    const fields = statement.columns();
    const values = input.values.map((value) => typeof value === 'boolean' ? Number(value) : value && typeof value === 'object'
      ? 'integer' in value ? BigInt(value.integer) : Buffer.from(value.binary, 'base64') : value);
    const rows = [];
    for (const row of statement.iterate(...values)) {
      rows.push((row as unknown as unknown[]).map((value) => typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER)
        && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : relationalCell(value)));
      if (rows.length > input.maxRows) break;
    }
    process.stdout.write(JSON.stringify({ result: { columns: fields.map((field) => field.name),
      columnTypes: fields.map((field) => field.type ?? 'dynamic'), rows: rows.slice(0, input.maxRows), hasMore: rows.length > input.maxRows } }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  } finally { database?.close(); }
}
