import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import { z } from 'zod';
import type { RelationalProvider } from './relational';
import type { DatabaseColumnInfo } from './database';
import type { RelationalIndex, RelationalTableStructure } from './relational-structure';
import { tableCreateIdentifierError } from './table-create-validation';
import { INDEX_EDIT_LIMITS, type IndexEditInput, type IndexEditOptions } from './index-edit-types';
const target = {
  schema: z.string().min(1).max(255),
  table: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
};
export const indexEditInputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('drop'), ...target }).strict(),
  z
    .object({
      operation: z.literal('create'),
      ...target,
      unique: z.boolean(),
      columns: z
        .array(
          z
            .object({
              column: z.string().min(1).max(255),
              direction: z.enum(['asc', 'desc']),
              prefix: z.number().int().min(1).max(3072).nullable(),
            })
            .strict(),
        )
        .min(1)
        .max(INDEX_EDIT_LIMITS.keys),
      include: z.array(z.string().min(1).max(255)).max(INDEX_EDIT_LIMITS.include),
      nullsNotDistinct: z.boolean(),
    })
    .strict(),
]);
export function parseIndexEditInput(provider: RelationalProvider, value: unknown): IndexEditInput {
  const parsed = indexEditInputSchema.safeParse(value);
  if (!parsed.success)
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.invalidIndexParametersOnlyActualColumnsSortingAnd',
        '索引参数无效：仅接受真实字段、排序和受支持的原生选项。',
      ),
    );
  const input = parsed.data;
  for (const [kind, name] of [
    ['schema', input.schema],
    ['table', input.table],
    ['column', input.name],
  ] as const) {
    const error = tableCreateIdentifierError(provider, name, kind);
    if (error) throw new ValidationError(error);
  }
  if (
    (provider === 'sqlite' && /^sqlite_/i.test(input.name)) ||
    (provider === 'mysql' && input.name.toUpperCase() === 'PRIMARY')
  )
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.thisIndexNameIsReservedByTheDatabase',
        '此索引名称为数据库保留名称。',
      ),
    );
  return input;
}
export function indexEditPrefixColumn(column: DatabaseColumnInfo): boolean {
  return /^(?:char|varchar|binary|varbinary|(?:tiny|medium|long)?text|(?:tiny|medium|long)?blob)\b/i.test(
    column.dataType,
  );
}
/** Constraint indexes stay owned by their native constraint. MySQL UNIQUE itself is the index. */
export function indexEditDropReason(
  provider: RelationalProvider,
  index: RelationalIndex,
  structure: RelationalTableStructure,
): ValidationIssue | null {
  if (index.primary)
    return validationIssue(
      'index-edit-validation.thePrimaryKeyIndexIsManagedByThe',
      '主键索引由主键约束管理，不能在此删除。',
    );
  if (provider !== 'mysql' && index.constraintBacked)
    return validationIssue(
      'index-edit-validation.thisIndexIsManagedByANativeConstraint',
      '此索引由原生约束管理，不能单独删除。',
    );
  if (provider === 'mysql') {
    const keys = index.parts.filter((part) => part.role === 'key');
    const supported = structure.foreignKeys.some((foreign) =>
      foreign.columns.every(
        (column, position) =>
          keys[position]?.column === column && keys[position]?.prefixLength === null,
      ),
    );
    if (supported)
      return validationIssue(
        'index-edit-validation.thisIndexSLeadingColumnsSupportForeignKeys',
        '此索引的前导字段支持当前表的外键，请通过完整约束编辑处理。',
      );
  }
  return null;
}
export function validateIndexEditInput(options: IndexEditOptions, value: unknown): IndexEditInput {
  const input = parseIndexEditInput(options.provider, value),
    structure = options.structure;
  if (
    structure.kind !== 'table' ||
    input.schema !== structure.schema ||
    input.table !== structure.table
  )
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.theIndexTargetMustBeTheNativeTable',
        '索引目标必须是当前读取的原生数据表。',
      ),
    );
  if (options.permission === 'denied')
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.theCurrentRoleCannotManageIndexesOnThis',
        '当前角色没有管理此表索引的权限。',
      ),
    );
  const sameName = (name: string) =>
    options.provider === 'postgres'
      ? name === input.name
      : name.toLowerCase() === input.name.toLowerCase();
  const existing = structure.indexes.find((index) => sameName(index.name));
  if (input.operation === 'drop') {
    if (!existing)
      throw new ValidationError(
        validationIssue(
          'index-edit-validation.targetIndexDoesNotExistRefreshTheStructure',
          '目标索引不存在，请刷新结构。',
        ),
      );
    const reason = indexEditDropReason(options.provider, existing, structure);
    if (reason) throw new ValidationError(reason);
    return input;
  }
  if (existing)
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.theCurrentTableAlreadyHasAnIndexWith',
        '当前表已有同名索引。',
      ),
    );
  const used = new Set<string>();
  const find = (name: string) => structure.columns.find((column) => column.name === name);
  for (const key of input.columns) {
    const column = find(key.column);
    if (!column || used.has(key.column))
      throw new ValidationError(
        validationIssue(
          'index-edit-validation.indexColumnsMustExistAndMustNotRepeat',
          '索引字段必须存在且不能重复。',
        ),
      );
    used.add(key.column);
    if (key.direction === 'desc' && !options.capabilities.descending)
      throw new ValidationError(
        validationIssue(
          'index-edit-validation.theCurrentNativeVersionOrEngineDoesNot',
          '当前原生版本或引擎不支持真实降序索引。',
        ),
      );
    if (key.prefix !== null) {
      if (!options.capabilities.prefix || !indexEditPrefixColumn(column))
        throw new ValidationError(
          validationIssue(
            'index-edit-validation.prefixesApplyOnlyToCharacterOrBinaryColumns',
            '前缀仅用于当前 MySQL 引擎的字符或二进制字段。',
          ),
        );
      if (column.characterMaximumLength !== null && key.prefix > column.characterMaximumLength)
        throw new ValidationError(
          validationIssue(
            'index-edit-validation.prefixLengthMustNotExceedColumnLength',
            '前缀长度不能超过字段长度。',
          ),
        );
    }
    if (options.provider === 'mysql') {
      if (
        /^(?:json|geometry|point|linestring|polygon|multi(?:point|linestring|polygon)|geometrycollection)\b/i.test(
          column.dataType,
        )
      )
        throw new ValidationError(
          validationIssue(
            'index-edit-validation.jsonSpatialColumnsRequireDedicatedIndexDesignExpression',
            'JSON / 空间字段需要专用索引设计，当前不提供表达式或空间索引。',
          ),
        );
      if (
        /^(?:(?:tiny|medium|long)?text|(?:tiny|medium|long)?blob)\b/i.test(column.dataType) &&
        key.prefix === null
      )
        throw new ValidationError(
          validationIssue(
            'index-edit-validation.mysqlTextBlobIndexesRequireAnExplicitPrefix',
            'MySQL TEXT / BLOB 索引必须明确前缀长度。',
          ),
        );
    }
  }
  if (input.include.length && !options.capabilities.include)
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.theCurrentNativeVersionDoesNotSupportInclude',
        '当前原生版本不支持 INCLUDE 字段。',
      ),
    );
  for (const name of input.include) {
    if (!find(name) || used.has(name))
      throw new ValidationError(
        validationIssue(
          'index-edit-validation.includedColumnsMustExistAndMustNotDuplicate',
          '包含字段必须存在，且不能与索引键或其他包含字段重复。',
        ),
      );
    used.add(name);
  }
  if (input.nullsNotDistinct && (!input.unique || !options.capabilities.nullsNotDistinct))
    throw new ValidationError(
      validationIssue(
        'index-edit-validation.nullsNotDistinctAppliesOnlyToPostgresqlUnique',
        'NULLS NOT DISTINCT 仅适用于 PostgreSQL 15+ 唯一索引。',
      ),
    );
  return input;
}
