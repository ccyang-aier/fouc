import type { RelationalTableStructure } from '@fouc/shared';
import { tableTransferColumnOmittable, tableTransferInputSchema, tableTransferTypeFamily, validateTableTransferMapping, type TableTransferInput, type TableTransferIssue, type TableTransferPlan } from '@fouc/shared/table-transfer';
import { structureColumnFromMetadata } from '@fouc/shared/relational-structure-edit';

export function transferQuote(name: string, provider: RelationalTableStructure['provider']): string {
  if (!name.trim() || /[\u0000-\u001f]/.test(name)) throw new Error('传输对象名称无效');
  const quote = provider === 'mysql' ? '`' : '"'; return quote + name.replaceAll(quote, quote + quote) + quote;
}
export function transferReadSql(plan: TableTransferPlan, offset: number, limit: number): string {
  const { source } = plan, q = (name: string) => transferQuote(name, source.provider);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1001) throw new Error('分页参数超出范围');
  const projection = plan.columns.map((column) => {
    const name = q(column.source.name);
    return column.sourceProjection === 'native' ? name : `CAST(${name} AS ${source.provider === 'mysql' ? 'CHAR CHARACTER SET utf8mb4' : 'TEXT'}) AS ${name}`;
  }).join(', ');
  return `SELECT ${projection} FROM ${q(source.schema)}.${q(source.table)}${plan.orderBy.length ? ` ORDER BY ${plan.orderBy.map(q).join(', ')}` : ''} LIMIT ${limit} OFFSET ${offset}`;
}
export function prepareTableTransfer(source: RelationalTableStructure, target: RelationalTableStructure, raw: TableTransferInput): TableTransferPlan {
  const input = tableTransferInputSchema.parse(raw), issues: TableTransferIssue[] = [];
  const error = (message: string, targetColumn?: string, sourceColumn?: string) => issues.push({ severity: 'error', message, targetColumn, sourceColumn });
  const warn = (message: string, targetColumn?: string, sourceColumn?: string) => issues.push({ severity: 'warning', message, targetColumn, sourceColumn });
  if (!['table', 'view'].includes(source.kind)) error('源仅支持原生表或视图');
  if (target.kind !== 'table') error('目标必须是已有普通表');
  if (source.connectionId && source.connectionId === target.connectionId && source.schema === target.schema && source.table === target.table) error('源和目标不能是同一连接下的同一张表');
  const targets = new Set<string>(), sources = new Set<string>();
  const columns: TableTransferPlan['columns'] = [];
  for (const mapping of input.mappings) {
    const from = source.columns.find((column) => column.name === mapping.sourceColumn), to = target.columns.find((column) => column.name === mapping.targetColumn);
    if (!from || !to) { error('映射字段已不存在，请重新读取结构', mapping.targetColumn, mapping.sourceColumn); continue; }
    if (targets.has(to.name)) error('一个目标字段只能映射一次', to.name); targets.add(to.name);
    if (sources.has(from.name)) error('同一源字段只能选择一次', to.name, from.name); sources.add(from.name);
    const attributes = structureColumnFromMetadata(target, to);
    if (attributes.generated || /^(?:generated|(?:stored|virtual) generated)$/i.test(to.extra ?? '')) error('生成列由数据库计算，不能写入', to.name);
    if (target.provider === 'postgres' && attributes.identity?.kind === 'always') error('IDENTITY ALWAYS 不能显式写入；取消此映射让目标生成', to.name);
    const mismatch = validateTableTransferMapping(from, source.provider, to, target.provider, mapping); if (mismatch) error(mismatch, to.name, from.name);
    if (to.numericScale !== null && to.numericScale < 0) error('负小数位 NUMERIC 需要单独的舍入审查，当前不传输', to.name);
    const family = tableTransferTypeFamily(from.dataType, source.provider);
    const projection = family === 'json' || source.provider === 'postgres' && (family === 'array' || family === 'other' && mapping.conversion === 'text') ? 'text' : 'native';
    columns.push({ mapping, source: from, target: to, sourceProjection: projection });
    if (from.isNullable && !to.isNullable) warn('源允许 NULL，目标非空；遇到 NULL 会回滚整批传输', to.name, from.name);
    if (to.columnDefault !== null) warn('映射字段会写入源值，源 NULL 不会替换为目标 DEFAULT', to.name, from.name);
    if (attributes.identity || /auto_increment/i.test(to.extra ?? '')) warn('显式写入自增 / Identity 不会自动同步 PostgreSQL 序列；需审查后续自动编号', to.name);
    if (tableTransferTypeFamily(to.dataType, target.provider) === 'float') warn('目标浮点按原生浮点精度存储；超出整数精度的值会拒绝，十进制请使用 DECIMAL / TEXT', to.name);
  }
  for (const column of target.columns) if (!targets.has(column.name) && !tableTransferColumnOmittable(column, target)) error('未映射的非空字段没有 DEFAULT 或生成属性', column.name);
  const primary = source.constraints.find((constraint) => constraint.kind === 'primary')?.columns ?? source.indexes.find((index) => index.primary)?.parts.flatMap((part) => part.column ? [part.column] : []) ?? source.columns.filter((column) => column.isPrimaryKey).map((column) => column.name);
  const unique = source.indexes.find((index) => index.unique && !index.predicate && index.parts.length > 0 && index.parts.every((part) => part.role === 'key' && part.column && !part.prefixLength && !part.expression && source.columns.some((column) => column.name === part.column && !column.isNullable)));
  const orderBy = primary.length ? primary : unique?.parts.flatMap((part) => part.column ? [part.column] : []) ?? [];
  if (!orderBy.length) warn('源没有可用的非空唯一键，分页顺序不能保证稳定；建议先创建唯一键');
  warn('源按独立只读分页读取，没有跨页一致性快照；执行期间的增删改可能造成遗漏或重复');
  warn('整个目标追加在单个事务中提交，失败 / 取消会请求回滚。触发器的外部或非事务性副作用、序列编号空洞不能保证回滚');
  warn('目标使用已有表；不会清表、建表、修改类型或处理重复键冲突');
  if (input.rowLimitMode === 'require-complete') warn(`最多读取 ${input.maxRows.toLocaleString()} 行并额外探测一行；如源更多，目标事务回滚`);
  else warn(`用户选择限量追加：仅传输前 ${input.maxRows.toLocaleString()} 行；存在更多行时不会宣称全表完成`);
  const effectiveBatchSize = Math.max(1, Math.min(input.batchSize, Math.floor((target.provider === 'sqlite' ? 999 : 32767) / Math.max(1, columns.length))));
  const endpoint = (table: RelationalTableStructure) => ({ connectionId: table.connectionId, provider: table.provider, schema: table.schema, table: table.table });
  const plan: TableTransferPlan = { source: endpoint(source), target: endpoint(target), input, columns, orderBy, effectiveBatchSize, maxBytes: 256 * 1024 * 1024, issues, executable: columns.length > 0 && !issues.some((issue) => issue.severity === 'error'), sourceHasMore: null, sourcePreviewSql: '', targetPreviewSql: '' };
  plan.sourcePreviewSql = transferReadSql(plan, 0, effectiveBatchSize);
  const q = (name: string) => transferQuote(name, target.provider);
  plan.targetPreviewSql = `INSERT INTO ${q(target.schema)}.${q(target.table)} (${columns.map((column) => q(column.target.name)).join(', ')}) VALUES (${columns.map((_, index) => target.provider === 'postgres' ? `$${index + 1}` : '?').join(', ')})`;
  return plan;
}
