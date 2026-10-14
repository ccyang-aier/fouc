import { validationIssueFromError } from '@fouc/shared';
import { createHash } from 'node:crypto';
import type { DatabaseColumnInfo, RelationalTableStructure } from '@fouc/shared';
import {
  DATABASE_EXPORT_MAX_BYTES,
  DATABASE_EXPORT_MAX_TABLES,
  numericExportType,
  validateDatabaseExportInput,
  type DatabaseExportReview,
  type DatabaseExportTableReview,
} from '@fouc/shared/database-export';
import { DatabaseInputError } from './input-error';
import type { NativeDatabaseExportAdapter, PreparedDatabaseExport } from './database-export-types';
export function databaseExportGenerated(column: DatabaseColumnInfo): boolean {
  const extra = (column.extra ?? '').replace(/\bDEFAULT_GENERATED\b/gi, '');
  return !/\bidentity\b/i.test(extra) && /\b(?:generated|virtual|stored)\b/i.test(extra);
}
export function databaseExportNativeText(provider: string, column: DatabaseColumnInfo): boolean {
  return (
    (provider === 'postgres' &&
      (numericExportType('postgres', column.dataType) ||
        /\[\]$/.test(column.dataType) ||
        /^(?:jsonb?|xml|interval|point|line|lseg|box|path|polygon|circle)$/i.test(
          column.dataType,
        ))) ||
    (provider === 'mysql' && /^json$/i.test(column.dataType))
  );
}
export function databaseExportMysqlGeometry(type: string): boolean {
  return /^(?:geometry|point|linestring|polygon|multipoint|multilinestring|multipolygon|geometrycollection)$/i.test(
    type,
  );
}
function orderColumns(structure: RelationalTableStructure): string[] {
  const safe = (names: string[]) =>
    names.length > 0 &&
    names.every((name) =>
      structure.columns.some(
        (column) => column.name === name && !column.isNullable && !databaseExportGenerated(column),
      ),
    );
  const primary = structure.columns
    .filter((column) => column.isPrimaryKey)
    .map((column) => column.name);
  if (safe(primary)) return primary;
  for (const index of structure.indexes) {
    const parts = index.parts.filter((part) => part.role === 'key');
    if (
      index.unique &&
      index.valid !== false &&
      !index.predicate &&
      parts.every(
        (part) => part.column !== null && part.expression === null && part.prefixLength === null,
      )
    ) {
      const names = parts.map((part) => part.column!);
      if (safe(names)) return names;
    }
  }
  return [];
}
function tableReview(
  structure: RelationalTableStructure,
  input: DatabaseExportReview['input'],
): DatabaseExportTableReview {
  const order = orderColumns(structure),
    dataIncluded = input.includeData && (input.format !== 'sql' || structure.kind === 'table');
  const warnings = [...structure.definition.warnings];
  if (dataIncluded && !order.length)
    warnings.push(
      '无已确认的非空唯一键，使用 OFFSET 分页；并发写入时可能出现遗漏、重复或顺序变化。',
    );
  if (input.format === 'sql' && input.includeData && structure.kind !== 'table')
    warnings.push(
      'SQL 仅写表数据；视图与物化视图的行未作为 INSERT 导出，查询数据请使用 CSV / JSON 格式。',
    );
  if (input.format === 'sql' && structure.columns.some(databaseExportGenerated))
    warnings.push(
      'SQL INSERT 排除原生生成列，回放时由数据库重新计算；CSV / JSON 仍保留生成列的原始值。',
    );
  if (input.includeStructure && structure.definition.origin === 'reconstructed')
    warnings.push('该对象的 DDL 来自原生目录重建；原生采集告警会写入清单。');
  if (
    input.format === 'sql' &&
    structure.provider === 'postgres' &&
    structure.columns.some(
      (column) =>
        /\bidentity\b/i.test(column.extra ?? '') ||
        /\bnextval\s*\(/i.test(column.columnDefault ?? ''),
    )
  )
    warnings.push(
      '序列当前分配状态未导出；显式 INSERT 不推进 PostgreSQL 序列，回放后须校准原生 sequence / identity 游标。',
    );
  if (input.includeStructure && structure.provider === 'mysql' && structure.triggers.length)
    warnings.push(
      'MySQL 触发器保留原生 DEFINER 与 DELIMITER 指令，请使用支持该指令的原生脚本客户端并确认对应账号存在。',
    );
  return {
    schema: structure.schema,
    table: structure.table,
    key: JSON.stringify([structure.schema, structure.table]),
    kind: structure.kind,
    columns: structure.columns.map((column) => ({
      name: column.name,
      nativeType: column.dataType,
      wireEncoding:
        structure.provider === 'mysql' && databaseExportMysqlGeometry(column.dataType)
          ? 'geometry-wkb'
          : databaseExportNativeText(structure.provider, column)
            ? 'native-text'
            : /^(?:bytea|blob|(?:var)?binary|binary large object)$/i.test(column.dataType)
              ? 'binary-base64'
              : 'native',
      generated: databaseExportGenerated(column),
    })),
    pagination: order.length ? 'keyset' : 'offset',
    orderColumns: order,
    ddlOrigin: structure.definition.origin,
    dataIncluded,
    structureIncluded: input.includeStructure,
    warnings,
  };
}
/** Metadata signatures let the runner reject schema changes between review and reading. */
export function databaseExportStructureSignature(structure: RelationalTableStructure): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        structure.schema,
        structure.table,
        structure.kind,
        structure.columns,
        structure.foreignKeys,
        structure.definition.sql,
      ]),
    )
    .digest('hex');
}
function dependencyOrder(tables: PreparedDatabaseExport['tables']): {
  tables: PreparedDatabaseExport['tables'];
  cycle: boolean;
} {
  const catalog = new Map(tables.map((table) => [table.review.key, table])),
    remaining = new Set(catalog.keys()),
    done = new Set<string>(),
    ordered: PreparedDatabaseExport['tables'] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((key) =>
      catalog.get(key)!.structure.foreignKeys.every((foreign) => {
        const dependency = JSON.stringify([
          foreign.referencedSchema || catalog.get(key)!.structure.schema,
          foreign.referencedTable,
        ]);
        return dependency === key || !catalog.has(dependency) || done.has(dependency);
      }),
    );
    if (!ready.length)
      return {
        tables: [...ordered, ...[...remaining].map((key) => catalog.get(key)!)],
        cycle: true,
      };
    for (const key of ready) {
      ordered.push(catalog.get(key)!);
      remaining.delete(key);
      done.add(key);
    }
  }
  return { tables: ordered, cycle: false };
}
export async function prepareDatabaseExport(
  adapter: NativeDatabaseExportAdapter,
  value: unknown,
  signal?: AbortSignal,
): Promise<PreparedDatabaseExport> {
  let input;
  try {
    input = validateDatabaseExportInput(value);
  } catch (error) {
    throw new DatabaseInputError(
      error instanceof Error ? error.message : String(error),
      validationIssueFromError(error),
    );
  }
  signal?.throwIfAborted();
  const selected = input.tables.length
    ? new Set(input.tables.map((table) => JSON.stringify([table.schema, table.table])))
    : null;
  const targets: Array<{
      schema: string;
      table: string;
    }> = [],
    seen = new Set<string>();
  for (const schema of input.schemas) {
    for (const object of await adapter.listTables(schema, signal)) {
      signal?.throwIfAborted();
      if (object.schema !== schema || !['table', 'view', 'materialized_view'].includes(object.kind))
        continue;
      const key = JSON.stringify([schema, object.name]);
      if (seen.has(key) || (selected && !selected.has(key))) continue;
      seen.add(key);
      targets.push({ schema, table: object.name });
      if (targets.length > DATABASE_EXPORT_MAX_TABLES)
        throw new DatabaseInputError('当前导出最多 1000 个对象，请缩小选择范围');
    }
  }
  if (!targets.length || (selected && [...selected].some((key) => !seen.has(key))))
    throw new DatabaseInputError('选择的导出对象不存在或不在当前原生目录授权范围');
  if (input.format !== 'sql' && input.packaging === 'file' && targets.length !== 1)
    throw new DatabaseInputError('多表数据需要 ZIP，以分别保留各表字段与类型清单');
  let next = 0,
    bytes = 0,
    stopped = false;
  const collected: PreparedDatabaseExport['tables'] = [];
  const worker = async () => {
    while (!stopped && next < targets.length) {
      signal?.throwIfAborted();
      const target = targets[next++],
        structure = await adapter.structure(target.schema, target.table, signal);
      signal?.throwIfAborted();
      if (stopped) return;
      if (
        structure.provider !== adapter.provider ||
        structure.schema !== target.schema ||
        structure.table !== target.table
      )
        throw new Error('原生导出结构返回了范围之外的对象');
      bytes += Buffer.byteLength(JSON.stringify(structure));
      if (bytes > 16 * 1024 * 1024)
        throw new DatabaseInputError('导出结构超过 16 MiB，请缩小选择范围');
      if (!structure.columns.length && input.includeData)
        throw new DatabaseInputError('原生目录未提供可导出字段');
      collected.push({ structure, review: tableReview(structure, input) });
    }
  };
  const workers = Array.from({ length: Math.min(4, targets.length) }, async () => {
    try {
      await worker();
    } catch (error) {
      stopped = true;
      throw error;
    }
  });
  const completed = await Promise.allSettled(workers);
  const failure = completed.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) throw failure.reason;
  collected.sort(
    (a, b) =>
      a.review.schema.localeCompare(b.review.schema) ||
      a.review.table.localeCompare(b.review.table),
  );
  const ordered = dependencyOrder(collected),
    warnings: string[] = [];
  if (adapter.consistency === 'independent-reads')
    warnings.push(
      '源数据由独立只读分页采集，未持有全库一致快照；期间新增、修改或删除可能改变导出结果。',
    );
  if (input.rowLimit !== null)
    warnings.push(`用户明确选择每表最多前 ${input.rowLimit} 行，清单会标记实际仍有更多数据的表。`);
  if (ordered.cycle)
    warnings.push(
      '选中表存在外键循环依赖；SQL 脚本的结构恢复需要自行处理约束顺序，未在源库关闭任何约束。',
    );
  if (input.includeStructure)
    warnings.push(
      '结构脚本保留本次表 / 视图定义；目标 Schema / 数据库、外部类型、序列、函数、权限及跨范围依赖未被假设为已导出，恢复前须确认它们已存在。',
    );
  if (input.packaging === 'zip')
    warnings.push(
      'ZIP 使用标准 STORE 流式封装，不进行压缩；分包在完整行 / SQL 语句之后轮换，单个超大行可超过目标分包大小。',
    );
  if (input.format !== 'sql')
    warnings.push(
      'JSON / 数组列按原生文本保留，二进制使用带类型的 Base64 值；JSON 数字保留原始字面量，读取端须使用无损数值解析器。',
    );
  if (input.format === 'csv')
    warnings.push(
      'CSV 使用未加引号的 \\N 表示 NULL，空字符串和字符串 \\N 会加引号；CSV 仍是文本格式，原生类型见 ZIP 清单。',
    );
  if (!input.includeStructure && !ordered.tables.some((table) => table.review.dataIncluded))
    throw new DatabaseInputError('当前 SQL 选择没有可导出的表数据；视图数据请选择 CSV / JSON');
  const review: DatabaseExportReview = {
    provider: adapter.provider,
    database: adapter.database,
    input,
    tables: ordered.tables.map((table) => table.review),
    consistency: adapter.consistency,
    warnings,
    maxBytes: DATABASE_EXPORT_MAX_BYTES,
  };
  return { review, tables: ordered.tables };
}
