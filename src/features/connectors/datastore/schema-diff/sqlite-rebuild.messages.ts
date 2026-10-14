import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  rebuildingRequiresActualCreateTableDefinitionsFromBothSidesCheck: [
    '{p0} 重建需要两端真实 CREATE TABLE，不能从不完整目录猜测 CHECK、生成列或表选项。',
    'Rebuilding {p0} requires actual CREATE TABLE definitions from both sides. CHECK, generated columns and table options cannot be inferred from incomplete catalogs.',
  ],
  columnLacksItsOriginalDefinitionAndCannotBeRebuilt: [
    '字段 {p0} 缺少原始定义，不能重建。',
    'Column {p0} lacks its original definition and cannot be rebuilt.',
  ],
  sqliteTablesRequireAtLeastOneColumnARebuildDropping: [
    'SQLite 表至少需要一列，不能生成删除全部字段的重建。',
    'SQLite tables require at least one column. A rebuild dropping every column cannot be generated.',
  ],
  selectedTypesViolateTheTargetStrictTableRulesSelectThe: [
    '选定类型不符合目标 STRICT 表规则；请同时选择相应表属性变更。',
    'Selected types violate the target STRICT table rules. Select the corresponding table-property changes as well.',
  ],
  newNotNullColumnLacksAValidDefaultAndA: [
    '新增 NOT NULL 字段 {p0} 没有有效默认值；现有行的数据回填规则未提供，暂不生成破坏性步骤。',
    'New NOT NULL column {p0} lacks a valid default and a backfill rule for existing rows. Destructive steps are not generated.',
  ],
  createATemporaryTableWithTheTargetDefinition: [
    '创建目标定义的临时表',
    'Create a temporary table with the target definition',
  ],
  saveTheAutoincrementHighWaterMark: [
    '保存 AUTOINCREMENT 高水位',
    'Save the AUTOINCREMENT high-water mark',
  ],
  noWritableCopyColumnsExistHowToPreserveExistingRows: [
    '没有可写的复制字段，不能确定如何保留已有行。',
    'No writable copy columns exist; how to preserve existing rows cannot be determined.',
  ],
  copyOriginalDataByColumnNameExcludingGeneratedColumns: [
    '按字段名复制原始数据，跳过生成列',
    'Copy original data by column name, excluding generated columns',
  ],
  columnsSelectedForDeletionAreNotCopiedTheirDataIs: [
    '选定删除的字段不会复制到新表，其数据会随旧表删除；请先保存备份。',
    'Columns selected for deletion are not copied; their data is deleted with the old table. Save a backup first.',
  ],
  existingNullValuesMayCauseCopyingToFailRollbackOn: [
    '已有 NULL 行可能使数据复制失败；失败后应 ROLLBACK，不继续提交。',
    'Existing NULL values may cause copying to fail. ROLLBACK on failure and do not commit.',
  ],
  declaredColumnsAreCopiedImplicitRowidHasNoUniversalMapping: [
    '本次按声明字段复制；隐式 rowid 无法统一映射，请核对依赖 rowid 的应用和虚拟表。',
    'Declared columns are copied. Implicit rowid has no universal mapping; check rowid-dependent applications and virtual tables.',
  ],
  dropTheOldTableDataCopiedInsideTheTransaction: [
    '删除旧表（数据已在事务内复制）',
    'Drop the old table (data copied inside the transaction)',
  ],
  renameTheTemporaryTableToTheOriginalTargetName: [
    '将临时表改为原目标名',
    'Rename the temporary table to the original target name',
  ],
  restoreTheAutoincrementHighWaterMark: [
    '恢复 AUTOINCREMENT 高水位',
    'Restore the AUTOINCREMENT high-water mark',
  ],
  recreateIndex: ['重建索引 {p0}', 'Recreate index {p0}'],
  restoreTrigger: ['恢复触发器 {p0}', 'Restore trigger {p0}'],
  rebuildingAffectsExternalViewsForeignKeysTriggersAndVirtualTables: [
    '重建会影响外部视图、外键、触发器和虚拟表。当前表元数据未枚举全部外部依赖，须按实际数据库确认。',
    'Rebuilding affects external views, foreign keys, triggers and virtual tables. Table metadata does not enumerate every external dependency; verify against the actual database.',
  ],
  temporaryTableMustNotExistTheScriptDoesNotUse: [
    '临时表 {p0} 必须不存在；脚本不使用 IF NOT EXISTS 跳过命名冲突。',
    'Temporary table {p0} must not exist. The script does not use IF NOT EXISTS to skip name conflicts.',
  ],
});
