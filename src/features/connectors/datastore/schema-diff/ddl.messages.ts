import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  ddlIdentifiersCannotBeEmptyOrContainNullCharacters: [
    'DDL 标识符不能是空值或含空字符。',
    'DDL identifiers cannot be empty or contain null characters.',
  ],
  ddlTextCannotContainNullCharacters: [
    'DDL 文本不支持空字符。',
    'DDL text cannot contain null characters.',
  ],
  columnLacksTheCompleteOriginalGeneratedColumnIdentityDefinition: [
    '字段 {p0} 缺少生成列 / Identity 的完整原始定义。',
    'Column {p0} lacks the complete original generated-column / identity definition.',
  ],
  invalidTypeDefinitionForColumn: [
    '字段 {p0} 类型定义无效。',
    'Invalid type definition for column {p0}.',
  ],
  cannotLocateTheObjectNameInTheOriginalDdl: [
    '无法定位原始 DDL 对象名称。',
    'Cannot locate the object name in the original DDL.',
  ],
  indexLacksAUsableCreateIndexDefinition: [
    '索引 {p0} 缺少可用的 CREATE INDEX 定义。',
    'Index {p0} lacks a usable CREATE INDEX definition.',
  ],
  cannotLocateTheTargetTableForIndex: [
    '无法定位索引 {p0} 的目标表。',
    'Cannot locate the target table for index {p0}.',
  ],
  constraintSupportingIndexesMustBeGeneratedWithTheirConstraints: [
    '约束支撑索引必须随约束生成。',
    'Constraint-supporting indexes must be generated with their constraints.',
  ],
  indexIsInvalidANormalCreateIndexCannotReproduceThat: [
    '索引 {p0} 当前无效，无法用普通 CREATE INDEX 重现无效状态。',
    'Index {p0} is invalid; a normal CREATE INDEX cannot reproduce that state.',
  ],
  indexLacksAUsableKeyDefinition: [
    '索引 {p0} 缺少可用键定义。',
    'Index {p0} lacks a usable key definition.',
  ],
  indexLacksExpressionMetadata: [
    '索引 {p0} 缺少表达式元数据。',
    'Index {p0} lacks expression metadata.',
  ],
  thisPrefixIndexSyntaxIsSupportedOnlyByMysql: [
    '此前缀索引语法只支持 MySQL。',
    'This prefix-index syntax is supported only by MySQL.',
  ],
  invalidMethodForIndex: ['索引 {p0} 方法无效。', 'Invalid method for index {p0}.'],
  includeColumnsForIndexCannotBeGeneratedInTheCurrent: [
    '索引 {p0} 的 INCLUDE 字段不能在当前库生成。',
    'INCLUDE columns for index {p0} cannot be generated in the current database.',
  ],
  mysqlDoesNotSupportPartialIndexWhereClauses: [
    'MySQL 不支持部分索引 WHERE。',
    'MySQL does not support partial-index WHERE clauses.',
  ],
  constraintLacksItsOriginalDefinition: [
    '约束 {p0} 缺少原始定义。',
    'Constraint {p0} lacks its original definition.',
  ],
  constraintLacksColumns: ['约束 {p0} 缺少字段。', 'Constraint {p0} lacks columns.'],
  foreignKeyHasAnIncompleteColumnMapping: [
    '外键 {p0} 字段映射不完整。',
    'Foreign key {p0} has an incomplete column mapping.',
  ],
  invalidActionForForeignKey: [
    '外键 {p0} 的 {p1} 动作无效。',
    'Invalid {p1} action for foreign key {p0}.',
  ],
  noParseableOriginalCreateTableDefinition: [
    '缺少可解析的 CREATE TABLE 原始定义。',
    'No parseable original CREATE TABLE definition.',
  ],
  noParseableOriginalCreateTriggerDefinition: [
    '缺少可解析的 CREATE TRIGGER 原始定义。',
    'No parseable original CREATE TRIGGER definition.',
  ],
});
