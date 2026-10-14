import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  invalidIndexParametersOnlyActualColumnsSortingAnd: [
    '索引参数无效：仅接受真实字段、排序和受支持的原生选项。',
    'Invalid index parameters: only actual columns, sorting, and supported native options are accepted.',
  ],
  thisIndexNameIsReservedByTheDatabase: [
    '此索引名称为数据库保留名称。',
    'This index name is reserved by the database.',
  ],
  thePrimaryKeyIndexIsManagedByThe: [
    '主键索引由主键约束管理，不能在此删除。',
    'The primary key index is managed by the primary key constraint and cannot be deleted here.',
  ],
  thisIndexIsManagedByANativeConstraint: [
    '此索引由原生约束管理，不能单独删除。',
    'This index is managed by a native constraint and cannot be deleted separately.',
  ],
  thisIndexSLeadingColumnsSupportForeignKeys: [
    '此索引的前导字段支持当前表的外键，请通过完整约束编辑处理。',
    "This index's leading columns support foreign keys in the current table. Use full constraint editing.",
  ],
  theIndexTargetMustBeTheNativeTable: [
    '索引目标必须是当前读取的原生数据表。',
    'The index target must be the native table currently read.',
  ],
  theCurrentRoleCannotManageIndexesOnThis: [
    '当前角色没有管理此表索引的权限。',
    'The current role cannot manage indexes on this table.',
  ],
  targetIndexDoesNotExistRefreshTheStructure: [
    '目标索引不存在，请刷新结构。',
    'Target index does not exist. Refresh the structure.',
  ],
  theCurrentTableAlreadyHasAnIndexWith: [
    '当前表已有同名索引。',
    'The current table already has an index with this name.',
  ],
  indexColumnsMustExistAndMustNotRepeat: [
    '索引字段必须存在且不能重复。',
    'Index columns must exist and must not repeat.',
  ],
  theCurrentNativeVersionOrEngineDoesNot: [
    '当前原生版本或引擎不支持真实降序索引。',
    'The current native version or engine does not support descending indexes.',
  ],
  prefixesApplyOnlyToCharacterOrBinaryColumns: [
    '前缀仅用于当前 MySQL 引擎的字符或二进制字段。',
    'Prefixes apply only to character or binary columns in the current MySQL engine.',
  ],
  prefixLengthMustNotExceedColumnLength: [
    '前缀长度不能超过字段长度。',
    'Prefix length must not exceed column length.',
  ],
  jsonSpatialColumnsRequireDedicatedIndexDesignExpression: [
    'JSON / 空间字段需要专用索引设计，当前不提供表达式或空间索引。',
    'JSON / spatial columns require dedicated index design. Expression and spatial indexes are currently unavailable.',
  ],
  mysqlTextBlobIndexesRequireAnExplicitPrefix: [
    'MySQL TEXT / BLOB 索引必须明确前缀长度。',
    'MySQL TEXT / BLOB indexes require an explicit prefix length.',
  ],
  theCurrentNativeVersionDoesNotSupportInclude: [
    '当前原生版本不支持 INCLUDE 字段。',
    'The current native version does not support INCLUDE columns.',
  ],
  includedColumnsMustExistAndMustNotDuplicate: [
    '包含字段必须存在，且不能与索引键或其他包含字段重复。',
    'Included columns must exist and must not duplicate index keys or other included columns.',
  ],
  nullsNotDistinctAppliesOnlyToPostgresqlUnique: [
    'NULLS NOT DISTINCT 仅适用于 PostgreSQL 15+ 唯一索引。',
    'NULLS NOT DISTINCT applies only to PostgreSQL 15+ unique indexes.',
  ],
});
