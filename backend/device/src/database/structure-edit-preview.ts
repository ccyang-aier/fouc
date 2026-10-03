import { tokenizeSqlSemantic, unquoteSqlSemanticIdentifier, type RelationalTableStructure } from '@fouc/shared';
import {
  structureEditInputSchema, structureColumnFromMetadata, structureNativeColumnClause, structureSqlLiteral,
  type StructureEditInput, type StructureEditIssue, type StructureEditOperation, type StructureEditPreview, type StructureEditStep,
} from '@fouc/shared/relational-structure-edit';
import { originalStructureColumn, structureColumnDdl, structureDefaultSql, structureIndexDdl, structureQuote, structureTarget, validateStructureColumn } from './structure-edit-ddl';

/** Adapted from DBX table_structure_sql's native columns/indexes/validation builders. */
export function previewStructureEdit(structure: RelationalTableStructure, raw: StructureEditInput): StructureEditPreview {
  const input = structureEditInputSchema.parse(raw), provider = structure.provider;
  const issues: StructureEditIssue[] = [], planned: { step: StructureEditStep; phase: number }[] = [];
  const issue = (operationId: string | null, severity: StructureEditIssue['severity'], message: string) => issues.push({ operationId, severity, message });
  const q = (name: string) => structureQuote(name, provider), target = structureTarget(structure);
  const operations = input.operations, ids = new Set<string>(), touched = new Map<string, string[]>();
  const columns = new Map(structure.columns.map((column) => [column.name, structureColumnFromMetadata(structure, column)]));
  const droppedIndexes = new Set(operations.filter((op) => op.kind === 'drop-index').map((op) => op.name));
  const primary = operations.find((op) => op.kind === 'set-primary-key');
  let serial = 0;
  const add = (op: StructureEditOperation, sql: string, label: string, risk: StructureEditStep['risk'], phase: number) => planned.push({ step: { id: `step-${++serial}`, operationId: op.id, sql: sql.replace(/;\s*$/, ''), label, risk }, phase });
  if (structure.kind !== 'table') issue(null, 'error', '只有普通表可以修改结构');
  if (new Set(structure.columns.map((column) => column.name)).size !== structure.columns.length) issue(null, 'error', '结构元数据含重复字段，请重新读取');
  for (const op of operations) {
    if (ids.has(op.id)) issue(op.id, 'error', '操作 ID 不能重复'); ids.add(op.id);
    const key = op.kind === 'set-primary-key' ? 'primary' : op.kind === 'add-index' ? `index:${op.index.name}` : op.kind === 'drop-index' ? `index:${op.name}` : `column:${op.kind === 'add-column' ? op.column.name : op.kind === 'drop-column' ? op.name : op.originalName}`;
    const previous = touched.get(key) ?? [];
    if (previous.length && !(previous.length === 1 && previous[0] === 'drop-index' && op.kind === 'add-index')) issue(op.id, 'error', '同一对象只能提交一次修改，索引可显式删除后重建');
    touched.set(key, [...previous, op.kind]);
    try {
      if (op.kind === 'add-column') { if (columns.has(op.column.name)) throw new Error(`字段 ${op.column.name} 已存在`); columns.set(op.column.name, op.column); }
      if (op.kind === 'drop-column') { if (!columns.delete(op.name)) throw new Error(`字段 ${op.name} 不存在`); }
      if (op.kind === 'update-column') {
        const original = columns.get(op.originalName); if (!original) throw new Error(`字段 ${op.originalName} 不存在`);
        const next = { ...original, ...op.patch };
        if (next.name !== op.originalName && columns.has(next.name)) throw new Error(`字段 ${next.name} 已存在`);
        columns.delete(op.originalName); columns.set(next.name, next);
      }
    } catch (reason) { issue(op.id, 'error', message(reason)); }
  }
  const names = [...columns.keys()], folded = provider === 'postgres' ? names : names.map((name) => name.toLowerCase());
  if (new Set(folded).size !== folded.length) issue(null, 'error', '字段名称在当前数据库规则下重复');
  if (!names.length) issue(null, 'error', '表必须至少保留一个字段');
  const depends = (name: string): string[] => {
    const references = structure.foreignKeys.filter((key) => key.columns.includes(name)).map((key) => `外键 ${key.name}`);
    for (const index of structure.indexes) if (!index.primary && !droppedIndexes.has(index.name) && (index.parts.some((part) => part.column === name) || index.parts.some((part) => part.expression && referencesColumn(part.expression, name, structure)) || index.predicate && referencesColumn(index.predicate, name, structure))) references.push(`索引 ${index.name}`);
    for (const constraint of structure.constraints) if (!['primary', 'unique', 'foreign'].includes(constraint.kind) && (constraint.columns.includes(name) || constraint.definition && referencesColumn(constraint.definition, name, structure))) references.push(`约束 ${constraint.name}`);
    for (const column of structure.columns) if (column.name !== name && structureColumnFromMetadata(structure, column).generated?.expression && referencesColumn(structureColumnFromMetadata(structure, column).generated!.expression, name, structure) && !operations.some((op) => op.kind === 'drop-column' && op.name === column.name)) references.push(`生成列 ${column.name}`);
    return references;
  };
  for (const op of operations) {
    const checkpoint = planned.length;
    try {
      if (op.kind === 'add-column') {
        validateStructureColumn(op.column, structure, names);
        if (provider === 'sqlite') validateSqliteAdd(op.column);
        if (provider === 'sqlite' && op.column.comment) throw new ManualEdit('SQLite 没有原生字段注释，请清空注释');
        add(op, `ALTER TABLE ${target} ADD COLUMN ${structureColumnDdl(op.column, structure)}`, `新增字段 ${op.column.name}`, op.column.nullable ? 'normal' : 'review', op.column.generated ? 55 : 30);
        if (!op.column.nullable) issue(op.id, 'warning', '新增非空字段需要默认值或空表；提交前需核对现有数据');
        if (op.column.generated) issue(op.id, 'warning', '生成列会验证表达式；STORED 可能重写现有行');
        if (provider === 'postgres' && op.column.comment) add(op, `COMMENT ON COLUMN ${target}.${q(op.column.name)} IS ${structureSqlLiteral(op.column.comment, provider)}`, `字段注释 ${op.column.name}`, 'normal', 60);
      } else if (op.kind === 'drop-column') {
        originalStructureColumn(structure, op.name);
        if (provider === 'sqlite') throw new ManualEdit('SQLite 删除字段需重建审查；使用结构对比生成保留数据的重建步骤');
        const dependencies = depends(op.name);
        if (dependencies.length) throw new ManualEdit(`删除字段依赖 ${dependencies.join('、')}；先显式调整依赖`);
        if (structure.columns.find((column) => column.name === op.name)?.isPrimaryKey && (!primary || primary.columns.includes(op.name))) throw new ManualEdit('删除主键字段前必须显式修改主键');
        if (structure.triggers.length) throw new ManualEdit('表含触发器；删除字段须手工审查触发器正文');
        add(op, `ALTER TABLE ${target} DROP COLUMN ${q(op.name)}`, `删除字段 ${op.name}`, 'destructive', 25);
        issue(op.id, 'warning', `字段 ${op.name} 的所有数据将永久删除；外部依赖不在当前表元数据范围内`);
      } else if (op.kind === 'update-column') {
        const original = originalStructureColumn(structure, op.originalName), next = { ...original, ...op.patch };
        validateStructureColumn(next, structure, names, op.patch);
        if (provider === 'sqlite') throw new ManualEdit('SQLite 修改已有字段需重建审查；当前直接提交仅支持新增字段和普通索引');
        const rename = next.name !== original.name;
        if (rename && (depends(original.name).length || structure.triggers.length)) throw new ManualEdit('字段重命名涉及已有依赖，请先用 DDL 审查确认引用调整');
        if (provider === 'postgres') {
          if (op.patch.generated !== undefined && JSON.stringify(op.patch.generated) !== JSON.stringify(original.generated)) throw new ManualEdit('PostgreSQL 修改生成表达式需单独审查列重建');
          if (op.patch.dataType !== undefined && next.dataType !== original.dataType) {
            if (original.generated || depends(original.name).some((name) => name.startsWith('生成列 '))) throw new ManualEdit('PostgreSQL 生成列依赖阻止直接 ALTER TYPE；先审查移除和恢复依赖');
            add(op, `ALTER TABLE ${target} ALTER COLUMN ${q(original.name)} TYPE ${next.dataType} USING ${q(original.name)}::${next.dataType}`, `字段类型 ${original.name}`, 'destructive', 35);
            issue(op.id, 'warning', '类型转换可能丢失精度或无法转换；USING 按原生类型转换执行，未扫描数据');
          }
          if (op.patch.nullable !== undefined && next.nullable !== original.nullable) add(op, `ALTER TABLE ${target} ALTER COLUMN ${q(original.name)} ${next.nullable ? 'DROP' : 'SET'} NOT NULL`, `NULL 属性 ${original.name}`, 'review', 35);
          if (op.patch.identity !== undefined && JSON.stringify(next.identity) !== JSON.stringify(original.identity)) {
            if (next.identity?.kind === 'auto-increment' || original.identity?.kind === 'auto-increment') throw new Error('PostgreSQL 不接受 AUTO_INCREMENT');
            if (next.identity && original.identity && (next.identity.start !== original.identity.start || next.identity.increment !== original.identity.increment)) throw new ManualEdit('现有 Identity 的序列参数修改需单独审查');
            if (!next.identity) add(op, `ALTER TABLE ${target} ALTER COLUMN ${q(original.name)} DROP IDENTITY`, `移除 Identity ${original.name}`, 'review', 35);
            else if (original.identity) add(op, `ALTER TABLE ${target} ALTER COLUMN ${q(original.name)} SET GENERATED ${next.identity.kind === 'always' ? 'ALWAYS' : 'BY DEFAULT'}`, `Identity 模式 ${original.name}`, 'review', 35);
            else {
              const generated = structureColumnDdl(next, structure).match(/GENERATED (?:ALWAYS|BY DEFAULT) AS IDENTITY(?: \([^)]*\))?/);
              if (!generated) throw new Error('Identity 定义不合法');
              add(op, `ALTER TABLE ${target} ALTER COLUMN ${q(original.name)} ADD ${generated[0]}`, `新增 Identity ${original.name}`, 'review', 40);
            }
          }
          if (op.patch.default !== undefined && JSON.stringify(next.default) !== JSON.stringify(original.default)) {
            const sql = structureDefaultSql(next.default, provider);
            add(op, `ALTER TABLE ${target} ALTER COLUMN ${q(original.name)} ${sql === null ? 'DROP DEFAULT' : `SET DEFAULT ${sql}`}`, `默认值 ${original.name}`, 'normal', sql === null ? 38 : 40);
          }
          if (rename) add(op, `ALTER TABLE ${target} RENAME COLUMN ${q(original.name)} TO ${q(next.name)}`, `重命名 ${original.name} → ${next.name}`, 'review', 50);
          if (op.patch.comment !== undefined && next.comment !== original.comment) add(op, `COMMENT ON COLUMN ${target}.${q(next.name)} IS ${next.comment ? structureSqlLiteral(next.comment, provider) : 'NULL'}`, `字段注释 ${next.name}`, 'normal', 60);
        } else {
          const clause = structureNativeColumnClause(structure, original.name);
          if (/\b(?:stored|virtual) generated\b/i.test(structure.columns.find((column) => column.name === original.name)?.extra ?? '') && !original.generated) throw new ManualEdit('原生成表达式未能完整读取，不能重写该字段');
          if (clause && tokenizeSqlSemantic(clause, provider).some((token) => token.depth === 0 && token.kind === 'word' && ['invisible', 'srid', 'column_format', 'storage'].includes(token.normalized))) throw new ManualEdit('字段含未支持的原生存储属性，不能完整重写');
          if (original.generated && !next.generated || !original.generated && next.generated) throw new ManualEdit('MySQL 普通列与生成列转换需重建审查');
          add(op, `ALTER TABLE ${target} ${rename ? `CHANGE COLUMN ${q(original.name)}` : 'MODIFY COLUMN'} ${structureColumnDdl(next, structure, original.name, op.patch)}`, `修改字段 ${original.name}`, op.patch.dataType ? 'destructive' : 'review', 35);
          issue(op.id, 'warning', 'MySQL MODIFY / CHANGE 可能重建表并隐式提交；类型缩窄或严格 SQL_MODE 不匹配会失败');
        }
      } else if (op.kind === 'drop-index') {
        const index = structure.indexes.find((entry) => entry.name === op.name);
        if (!index) throw new Error(`索引 ${op.name} 不存在`);
        if (index.primary || index.constraintBacked) throw new ManualEdit('约束索引不能直接 DROP INDEX；主键请在主键页修改，唯一约束需 DDL 审查');
        if (structure.foreignKeys.some((key) => index.parts.slice(0, key.columns.length).every((part, position) => part.column === key.columns[position]))) throw new ManualEdit('索引可能支撑外键，须先审查外键依赖');
        add(op, provider === 'mysql' ? `DROP INDEX ${q(op.name)} ON ${target}` : `DROP INDEX ${q(structure.schema)}.${q(op.name)}`, `删除索引 ${op.name}`, 'review', 10);
        issue(op.id, 'warning', index.unique ? '删除唯一索引会取消其唯一性保护' : '删除索引可能影响查询性能');
      } else if (op.kind === 'add-index') {
        if (structure.indexes.some((index) => index.name === op.index.name) && !droppedIndexes.has(op.index.name)) throw new Error(`索引 ${op.index.name} 已存在`);
        const statements = structureIndexDdl(op.index, structure, names);
        for (const [position, sql] of statements.entries()) add(op, sql, `${position ? '注释' : '新增'}索引 ${op.index.name}`, op.index.unique ? 'review' : 'normal', 70);
        issue(op.id, 'warning', op.index.unique ? '唯一索引会扫描并拒绝重复值，构建期间可能阻塞写入' : '索引构建会占用磁盘并可能阻塞读写');
      } else {
        if (provider === 'sqlite') throw new ManualEdit('SQLite 主键变更需重建审查');
        if (new Set(op.columns).size !== op.columns.length || op.columns.some((name) => !names.includes(name))) throw new Error('主键字段不存在或重复');
        const before = structure.constraints.find((constraint) => constraint.kind === 'primary');
        const originalNames = before?.columns ?? structure.indexes.find((index) => index.primary)?.parts.flatMap((part) => part.column ? [part.column] : []) ?? [];
        if (JSON.stringify(originalNames) === JSON.stringify(op.columns)) continue;
        if (structure.foreignKeys.some((key) => key.referencedSchema === structure.schema && key.referencedTable === structure.table && key.referencedColumns.some((name) => originalNames.includes(name)))) throw new ManualEdit('主键被当前表自引用外键使用，须先审查依赖');
        if (provider === 'postgres' && originalNames.length && !before) throw new ManualEdit('缺少 PostgreSQL 主键约束名称，不能安全删除');
        if (originalNames.length) add(op, `ALTER TABLE ${target} ${provider === 'mysql' ? 'DROP PRIMARY KEY' : `DROP CONSTRAINT ${q(before!.name)}`}`, '移除原主键', 'review', 15);
        if (op.columns.length) add(op, `ALTER TABLE ${target} ADD PRIMARY KEY (${op.columns.map(q).join(', ')})`, '设置主键', 'review', 65);
        issue(op.id, 'warning', '主键变更会验证非空和唯一性；其他表的外键不在当前元数据范围内，数据库会拒绝未处理依赖');
      }
    } catch (reason) {
      planned.splice(checkpoint);
      issue(op.id, reason instanceof ManualEdit ? 'manual' : 'error', message(reason));
    }
  }
  if (provider === 'mysql') {
    const automatic = [...columns.values()].filter((column) => column.identity?.kind === 'auto-increment');
    if (automatic.length > 1) issue(null, 'error', 'MySQL 每表只能有一个 AUTO_INCREMENT 字段');
    for (const column of automatic) {
      const existing = structure.indexes.some((index) => !droppedIndexes.has(index.name) && (!index.primary || !primary) && index.parts[0]?.column === column.name);
      if (!existing && primary?.columns[0] !== column.name) issue(null, 'manual', `AUTO_INCREMENT 字段 ${column.name} 必须为已有索引或本次主键的首字段`);
    }
    // DBX coalesces column + PK clauses so AUTO_INCREMENT never loses its key between implicit commits.
    if (automatic.length && primary) {
      const clauses = planned.filter(({ step }) => /^ALTER TABLE /.test(step.sql) && !/ COMMENT /.test(step.sql));
      if (clauses.length > 1) {
        const joined = clauses.map(({ step }) => step.sql.slice(`ALTER TABLE ${target} `.length));
        for (const item of clauses) planned.splice(planned.indexOf(item), 1);
        add(primary, `ALTER TABLE ${target} ${joined.join(', ')}`, '原子调整自增字段与主键', 'destructive', 35);
      }
    }
  }
  const steps = planned.sort((a, b) => a.phase - b.phase).map((item) => item.step);
  if (!steps.length && !issues.some((entry) => entry.severity !== 'warning')) issue(null, 'error', '没有需要提交的结构变化');
  const transaction = provider === 'mysql' ? 'implicit-commit' : 'atomic';
  issue(null, 'warning', provider === 'mysql' ? 'MySQL DDL 隐式提交。成功步骤不能由 ROLLBACK 撤销；失败后剩余步骤停止执行' : '全部可执行步骤在一个事务中提交；任一步失败会请求回滚。提交阶段连接中断时结果需重新读取元数据确认');
  const header = provider === 'mysql' ? '-- MySQL DDL 隐式提交；执行核心移除 NO_BACKSLASH_ESCAPES 后执行，并恢复原 SQL_MODE。手工运行前须使用同样 SQL_MODE。' : '-- 审查锁影响与现有数据后执行；外部依赖由数据库校验。';
  const script = `${header}\n${provider !== 'mysql' ? 'BEGIN;\n' : ''}${steps.map((step) => `${step.sql};`).join('\n')}${provider !== 'mysql' ? '\nCOMMIT;' : ''}`;
  return { provider, schema: structure.schema, table: structure.table, operations, steps, issues, executable: steps.length > 0 && !issues.some((entry) => entry.severity !== 'warning'), transaction, script };
}
class ManualEdit extends Error {}
function message(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason); }
function referencesColumn(expression: string, name: string, structure: RelationalTableStructure): boolean {
  return tokenizeSqlSemantic(expression, structure.provider).some((token) => ['word', 'quoted_identifier'].includes(token.kind) && unquoteSqlSemanticIdentifier(token) === name);
}
function validateSqliteAdd(column: import('@fouc/shared/relational-structure-edit').StructureColumn): void {
  if (column.identity || column.generated?.storage === 'stored') throw new ManualEdit('SQLite ADD COLUMN 不支持自增或 STORED 生成列，需要重建审查');
  if (column.default.kind === 'expression') throw new ManualEdit('SQLite ADD COLUMN 不接受表达式 / CURRENT_TIMESTAMP 默认值，需要重建审查');
  if (!column.nullable && (column.default.kind === 'none' || column.default.kind === 'null')) throw new ManualEdit('SQLite 新增非空字段必须提供非 NULL 常量默认值');
}
