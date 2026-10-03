import type { RelationalTableStructure } from '@fouc/shared';
import { textPieces, type DatabaseExportFormat, type DatabaseExportSummary, type DatabaseExportTableSummary } from '@fouc/shared/database-export';
import { databaseExportStructureSignature } from './database-export-plan';
import { compileDatabaseExportRead, databaseExportCursor, decodeDatabaseExportRows, type ExportCursor } from './database-export-query';
import { databaseExportCsvHeader, databaseExportCsvRow, databaseExportDdl, databaseExportInsert, databaseExportJsonRow } from './database-export-serialize';
import type { NativeDatabaseExportAdapter, PreparedDatabaseExport } from './database-export-types';
import { DatabaseExportWriter } from './database-export-writer';

interface PartOptions {
  prefix: string;
  format: DatabaseExportFormat;
  structure: RelationalTableStructure | null;
  header: string;
  maxBytes: number | null;
}

class ExportParts {
  readonly names: string[] = [];
  private rowsInPart = 0;
  private oversized = false;

  constructor(private readonly writer: DatabaseExportWriter, private readonly options: PartOptions, private readonly warnings: string[]) { }

  async begin(): Promise<void> {
    const number = String(this.names.length + 1).padStart(4, '0');
    const extension = this.options.format === 'ndjson' ? 'ndjson' : this.options.format;
    const name = `${this.options.prefix}.${number}.${extension}`;
    this.names.push(name);
    this.rowsInPart = 0;
    await this.writer.begin(name);
    if (this.options.format === 'json') await this.writer.write(['[\n']);
    if (this.options.format === 'csv') await this.writer.write(databaseExportCsvHeader(this.options.structure!));
    if (this.options.format === 'sql') await this.writer.write(textPieces(this.options.header));
  }

  async unit(pieces: Iterable<string>): Promise<void> {
    if (this.options.maxBytes !== null && this.writer.entryBytes >= this.options.maxBytes && this.rowsInPart > 0) {
      await this.end();
      await this.begin();
    }
    if (this.options.format === 'json' && this.rowsInPart) await this.writer.write([',\n']);
    const before = this.writer.entryBytes;
    await this.writer.write(pieces);
    if (this.options.format === 'ndjson') await this.writer.write(['\n']);
    this.rowsInPart++;
    if (this.options.maxBytes !== null && this.writer.entryBytes - before > this.options.maxBytes && !this.oversized) {
      this.oversized = true;
      this.warnings.push(`${this.options.prefix} 有单行 / 语句超过目标分包大小；它保持完整，没有切断内容。`);
    }
  }

  async end(): Promise<void> {
    if (this.options.format === 'json') await this.writer.write(['\n]\n']);
    await this.writer.end();
  }
}

function safeName(name: string): string {
  return Array.from(name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')).slice(0, 80).join('') || 'table';
}

function sqlHeader(prepared: PreparedDatabaseExport): string {
  const { review } = prepared;
  const lines = [
    '-- Fouc native database export',
    `-- Provider: ${review.provider}`, // Database names may contain line breaks; never inject them into comments.
    `-- Source: ${JSON.stringify(review.database)}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Consistency: ${review.consistency}`,
    `-- Per-table row limit: ${review.input.rowLimit ?? 'all rows'}`,
    '-- Apply parts in manifest order. This file does not disable constraints or drop existing data.',
    ...review.warnings.map(warning => `-- ${JSON.stringify(warning)}`),
  ];
  return lines.join('\n') + '\n\n';
}

export async function runDatabaseExport(
  adapter: NativeDatabaseExportAdapter,
  prepared: PreparedDatabaseExport,
  writer: DatabaseExportWriter,
  signal: AbortSignal,
  onProgress: (value: { table: { schema: string; table: string; } | null; rows: number; completedTables: number; finalizing: boolean; }) => void,
): Promise<DatabaseExportSummary> {
  const { review } = prepared;
  const warnings = [...review.warnings];
  for (const table of prepared.tables) warnings.push(...table.review.warnings.map(warning => `${table.review.schema}.${table.review.table}: ${warning}`));
  const maxBytes = review.input.packaging === 'zip' && review.input.partMiB !== null ? review.input.partMiB * 1024 * 1024 : null;
  const header = sqlHeader(prepared);
  const sql = review.input.format === 'sql' ? new ExportParts(writer, { prefix: 'database', format: 'sql', structure: null, header, maxBytes }, warnings) : null;
  if (sql) await sql.begin();
  const tables: DatabaseExportTableSummary[] = [];
  const after: string[] = [];
  let totalRows = 0;
  // Tables must exist before views; FK ordering within tables came from the native catalog.
  const ordered = review.input.format === 'sql'
    ? [...prepared.tables.filter(table => table.structure.kind === 'table'), ...prepared.tables.filter(table => table.structure.kind !== 'table')]
    : prepared.tables;
  for (const [position, table] of ordered.entries()) {
    signal.throwIfAborted();
    const structure = await adapter.structure(table.review.schema, table.review.table, signal);
    if (databaseExportStructureSignature(structure) !== databaseExportStructureSignature(table.structure)) throw new Error(`对象 ${table.review.schema}.${table.review.table} 的结构在准备后发生变化，导出文件未发布。`);
    const target = { schema: table.review.schema, table: table.review.table };
    onProgress({ table: target, rows: totalRows, completedTables: tables.length, finalizing: false });
    const firstSqlPart = sql ? sql.names.length - 1 : 0;
    if (table.review.structureIncluded) {
      const ddl = databaseExportDdl(structure);
      await sql!.unit(textPieces(ddl.before));
      after.push(...ddl.after);
    }
    const data = !sql ? new ExportParts(writer, {
      prefix: `${String(position + 1).padStart(4, '0')}-${safeName(target.schema)}-${safeName(target.table)}`,
      format: review.input.format,
      structure,
      header,
      maxBytes,
    }, warnings) : null;
    if (data) await data.begin();
    let rows = 0, limited = false, cursor: ExportCursor | null = null;
    while (table.review.dataIncluded) {
      signal.throwIfAborted();
      const size = Math.min(review.input.pageSize, review.input.rowLimit === null ? Infinity : review.input.rowLimit - rows);
      if (size <= 0) break;
      const read = compileDatabaseExportRead(structure, table.review, size, rows, cursor);
      const result = await adapter.read(read.sql, structure.schema, size + 1, read.values, signal);
      const decoded = decodeDatabaseExportRows(result, structure);
      const page = decoded.slice(0, size);
      const hasMore = decoded.length > size || result.hasMore;
      if (!page.length) break;
      if (sql) {
        for (let offset = 0; offset < page.length; offset += 100) await sql.unit(databaseExportInsert(page.slice(offset, offset + 100), structure));
      } else {
        for (const row of page) await data!.unit(review.input.format === 'csv' ? databaseExportCsvRow(row, adapter.provider) : databaseExportJsonRow(row, structure));
      }
      rows += page.length;
      totalRows += page.length;
      onProgress({ table: target, rows: totalRows, completedTables: tables.length, finalizing: false });
      if (review.input.rowLimit !== null && rows >= review.input.rowLimit) {
        limited = hasMore;
        break;
      }
      if (!hasMore) break;
      if (table.review.pagination === 'keyset') cursor = databaseExportCursor(page[page.length - 1], table.review, adapter.provider);
    }
    if (data) await data.end();
    signal.throwIfAborted();
    const finalStructure = await adapter.structure(target.schema, target.table, signal);
    if (databaseExportStructureSignature(finalStructure) !== databaseExportStructureSignature(structure)) throw new Error(`对象 ${target.schema}.${target.table} 的结构在读取期间发生变化，导出文件未发布。`);
    tables.push({ ...target, rows, limited, pagination: table.review.pagination, entries: data ? [...data.names] : sql!.names.slice(firstSqlPart) });
    onProgress({ table: target, rows: totalRows, completedTables: tables.length, finalizing: false });
  }
  if (sql) {
    for (const definition of after) await sql.unit(textPieces(definition));
    await sql.end();
  }
  const summary: DatabaseExportSummary = {
    provider: adapter.provider, database: adapter.database, generatedAt: new Date().toISOString(),
    format: review.input.format, consistency: adapter.consistency, rowLimit: review.input.rowLimit,
    tables, rows: totalRows, bytes: writer.bytes, warnings,
  };
  onProgress({ table: null, rows: totalRows, completedTables: tables.length, finalizing: true });
  if (writer.zip) {
    await writer.begin('manifest.json');
    // final archive bytes are reported by job progress; manifest bytes describe payload before manifest/central directory.
    await writer.write(textPieces(JSON.stringify({ version: 1, review, summary, sqlPartOrder: sql?.names ?? [], bytesScope: 'payload-before-manifest-and-central-directory' }, null, 2) + '\n'));
    await writer.end();
  }
  summary.bytes = await writer.finish();
  return summary;
}
