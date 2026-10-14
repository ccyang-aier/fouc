import { type DatabaseColumnInfo, type RelationalProvider } from '@fouc/shared';
import {
  isTableImportDefaultColumn,
  parseTableImport,
  TABLE_IMPORT_LIMITS,
  validateTableImportMappings,
  type TableImportAppendSummary,
  type TableImportInput,
  type TableImportParsed,
  type TableImportReview,
  type TableImportValidation,
} from '@fouc/shared/table-import';
import type { RelationalDriver, SqlParameter } from './drivers/relational-driver';
import { DatabaseInputError } from './input-error';
import { tableImportParameter } from './table-import-values';

type ImportRow = { columns: string[]; values: SqlParameter[]; record: number };
type PreparedImport = {
  input: TableImportInput;
  parsed: TableImportParsed;
  columns: DatabaseColumnInfo[];
  rows: ImportRow[];
  validation: TableImportValidation;
};

export function tableImportInput(value: unknown): TableImportInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DatabaseInputError('导入参数无效。');
  const input = value as Record<string, unknown>;
  for (const key of ['schema', 'table'] as const)
    if (
      typeof input[key] !== 'string' ||
      !input[key].trim() ||
      input[key].length > 1024 ||
      input[key].includes('\0')
    )
      throw new DatabaseInputError('导入目标 Schema 或表名无效。');
  if (
    typeof input.text !== 'string' ||
    input.text.length > TABLE_IMPORT_LIMITS.bytes ||
    Buffer.byteLength(input.text) > TABLE_IMPORT_LIMITS.bytes
  )
    throw new DatabaseInputError('导入内容最多 5 MiB。');
  if (!input.options || typeof input.options !== 'object' || Array.isArray(input.options))
    throw new DatabaseInputError('导入解析选项无效。');
  if (!Array.isArray(input.mappings) || input.mappings.length > TABLE_IMPORT_LIMITS.columns)
    throw new DatabaseInputError('导入字段映射无效。');
  for (const mapping of input.mappings) {
    if (
      !mapping ||
      typeof mapping !== 'object' ||
      Array.isArray(mapping) ||
      typeof mapping.sourceColumn !== 'string' ||
      typeof mapping.targetColumn !== 'string' ||
      mapping.sourceColumn.length > 1024 ||
      mapping.targetColumn.length > 1024 ||
      mapping.sourceColumn.includes('\0') ||
      mapping.targetColumn.includes('\0')
    )
      throw new DatabaseInputError('导入字段映射无效。');
  }
  if (input.mode !== undefined && input.mode !== 'append')
    throw new DatabaseInputError('当前导入仅支持追加，不清表或创建表。');
  return {
    schema: input.schema as string,
    table: input.table as string,
    text: input.text,
    options: { ...input.options } as TableImportInput['options'],
    mappings: input.mappings.map((mapping) => ({
      sourceColumn: mapping.sourceColumn,
      targetColumn: mapping.targetColumn,
    })),
  };
}
async function prepare(
  driver: RelationalDriver,
  provider: RelationalProvider,
  value: unknown,
  signal?: AbortSignal,
): Promise<PreparedImport> {
  const input = tableImportInput(value);
  signal?.throwIfAborted();
  const parsed = parseTableImport(input.text, input.options, signal);
  await driver.assertEditable(input.schema, input.table);
  const columns = await driver.columns(input.schema, input.table);
  if (!columns.length) throw new DatabaseInputError('目标表没有可导入字段。');
  const validation = validateTableImportMappings(parsed.columns, input.mappings, columns, provider),
    rows: ImportRow[] = [];
  validation.errors.unshift(...parsed.errors);
  validation.warnings.push(...parsed.warnings);
  const active = input.mappings
    .filter((mapping) => mapping.targetColumn)
    .map((mapping) => ({
      index: parsed.columns.indexOf(mapping.sourceColumn),
      target: columns.find((column) => column.name === mapping.targetColumn),
    }));
  if (!validation.errors.length) {
    for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex++) {
      signal?.throwIfAborted();
      const record = parsed.rowNumbers[rowIndex],
        row: ImportRow = { columns: [], values: [], record };
      for (const mapping of active) {
        const target = mapping.target!,
          cell = parsed.rows[rowIndex][mapping.index];
        if (cell.kind === 'missing') {
          if (!target.isNullable && !isTableImportDefaultColumn(target, provider, columns))
            validation.errors.push({
              message: '缺失字段没有默认值且不允许 NULL。',
              record,
              targetColumn: target.name,
            });
          continue;
        }
        try {
          row.values.push(tableImportParameter(cell, target, provider, input.options.format));
          row.columns.push(target.name);
        } catch (error) {
          validation.errors.push({
            message: error instanceof Error ? error.message : String(error),
            record,
            targetColumn: target.name,
            sourceColumn: parsed.columns[mapping.index],
          });
        }
      }
      rows.push(row);
      if (validation.errors.length >= TABLE_IMPORT_LIMITS.issues) {
        validation.warnings.push(
          validationIssue(
            'table-import-parse.tooManyIssues',
            '错误较多，仅显示前 100 项；修正后请重新预览。',
          ),
        );
        validation.errors = validation.errors.slice(0, TABLE_IMPORT_LIMITS.issues);
        break;
      }
    }
  }
  validation.valid = !validation.errors.length;
  return { input, parsed, columns, rows, validation };
}

/** Metadata-only preview: no transaction, INSERT, DDL or original query is executed. */
export async function previewTableImport(
  driver: RelationalDriver,
  provider: RelationalProvider,
  value: unknown,
  signal?: AbortSignal,
): Promise<TableImportReview> {
  const prepared = await prepare(driver, provider, value, signal);
  return {
    parsed: {
      ...prepared.parsed,
      rows: prepared.parsed.rows.slice(0, TABLE_IMPORT_LIMITS.previewRows),
      rowNumbers: prepared.parsed.rowNumbers.slice(0, TABLE_IMPORT_LIMITS.previewRows),
    },
    targetColumns: prepared.columns,
    mappings: prepared.input.mappings,
    validation: prepared.validation,
    rowsToImport: prepared.parsed.totalRows,
    mode: 'append',
  };
}

/** DBX append batches adapted to a single native transaction. Caller owns writable and one-use plan gates. */
export async function appendTableImport(
  driver: RelationalDriver,
  provider: RelationalProvider,
  value: unknown,
  signal?: AbortSignal,
): Promise<TableImportAppendSummary> {
  const started = performance.now(),
    prepared = await prepare(driver, provider, value, signal);
  if (!prepared.validation.valid)
    throw new DatabaseInputError(
      prepared.validation.errors
        .map(
          (issue) =>
            `${issue.record ? `记录 ${issue.record} ` : ''}${issue.targetColumn ? `${issue.targetColumn}：` : ''}${issue.message}`,
        )
        .join('\n'),
    );
  const target = `${driver.quoteIdentifier(prepared.input.schema)}.${driver.quoteIdentifier(prepared.input.table)}`;
  let imported = 0;
  await driver.transaction(prepared.input.schema, async (transaction) => {
    for (let offset = 0; offset < prepared.rows.length;) {
      signal?.throwIfAborted();
      const first = prepared.rows[offset],
        signature = JSON.stringify(first.columns),
        batch: ImportRow[] = [];
      const limit = Math.max(
        1,
        Math.min(
          250,
          Math.floor((provider === 'sqlite' ? 900 : 60000) / Math.max(1, first.columns.length)),
        ),
      );
      while (
        offset < prepared.rows.length &&
        batch.length < limit &&
        JSON.stringify(prepared.rows[offset].columns) === signature
      )
        batch.push(prepared.rows[offset++]);
      if (!first.columns.length) {
        for (const row of batch) {
          signal?.throwIfAborted();
          imported += (
            await transaction.query(
              provider === 'mysql'
                ? `INSERT INTO ${target} () VALUES ()`
                : `INSERT INTO ${target} DEFAULT VALUES`,
              row.values,
            )
          ).affectedRows;
        }
      } else {
        let parameter = 0;
        const values = batch.flatMap((row) => row.values),
          groups = batch.map(
            (row) =>
              `(${row.values.map(() => (provider === 'postgres' ? `$${++parameter}` : '?')).join(', ')})`,
          );
        const sql = `INSERT INTO ${target} (${first.columns.map((column) => driver.quoteIdentifier(column)).join(', ')}) VALUES ${groups.join(', ')}`;
        try {
          imported += (await transaction.query(sql, values)).affectedRows;
        } catch (error) {
          throw new DatabaseInputError(
            `记录 ${batch[0].record}–${batch.at(-1)!.record} 导入失败，整批已回滚：${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      // Yield between bounded SQLite batches so request cancellation can reach the transaction before COMMIT.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    signal?.throwIfAborted();
  });
  return { rowsImported: imported, elapsedMs: Math.round(performance.now() - started) };
}
import { validationIssue } from '@fouc/shared';
