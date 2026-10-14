import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqliteBegin: [
    '-- 先记录 PRAGMA foreign_keys 的原值；必须在事务外关闭外键。\nPRAGMA foreign_keys;\nPRAGMA foreign_keys=OFF;\nBEGIN IMMEDIATE;',
    '-- Record the original PRAGMA foreign_keys value; disable foreign keys outside the transaction.\nPRAGMA foreign_keys;\nPRAGMA foreign_keys=OFF;\nBEGIN IMMEDIATE;',
  ],
  sqliteCheck: [
    'PRAGMA foreign_key_check;\n-- 检查结果必须为空。确认数据与依赖后另行执行 COMMIT;\n-- 检查失败执行 ROLLBACK; 随后恢复 PRAGMA foreign_keys 的原值。',
    'PRAGMA foreign_key_check;\n-- The check must return no rows. Verify data and dependencies before executing COMMIT separately;\n-- If the check fails, execute ROLLBACK; then restore the original PRAGMA foreign_keys value.',
  ],
  reviewHeader: [
    '-- Fouc {provider} 结构差异审查\n-- 方向：源结构 → 目标对象；仅生成 DDL，不执行。\n',
    '-- Fouc {provider} structure difference review\n-- Direction: source structure → target object; generates DDL only, without execution.\n',
  ],
  noSelectedChanges: [
    '-- 当前选择没有可生成的变更。\n',
    '-- No changes can be generated for the current selection.\n',
  ],
  dropTableDeletesEveryRow: [
    'DROP TABLE 会删除全部行；当前比较没有行数据备份，也没有读取全部外部引用。',
    'DROP TABLE deletes every row. This comparison has no row data backup and has not read every external reference.',
  ],
  selectedStructureDifferencesChangedSelectAgain: [
    '选定的结构差异已变化，请重新选择。',
    'Selected structure differences changed. Select again.',
  ],
  changesContainADependencyCycleSplitTheDdlManually: [
    '变更存在循环依赖，须手工拆分 DDL。',
    'Changes contain a dependency cycle. Split the DDL manually.',
  ],
  thisBatchGeneratesOrdinaryTableDdlOnlyViewsAndMaterialized: [
    '当前批次只生成普通表 DDL，不部署视图或物化视图。',
    'This batch generates ordinary-table DDL only; views and materialized views are not deployed.',
  ],
  dropTable: ['删除表 {p0}', 'Drop table {p0}'],
  createTable: ['创建表 {p0}', 'Create table {p0}'],
  createIndex: ['创建索引 {p0}', 'Create index {p0}'],
  addForeignKey: ['建立外键 {p0}', 'Add foreign key {p0}'],
  createTrigger: ['创建触发器 {p0}', 'Create trigger {p0}'],
  dropColumn: ['删除字段 {p0}', 'Drop column {p0}'],
  existingDataInColumnWillBeDeletedExternalDependenciesAre: [
    '字段 {p0} 的已有数据会被删除；外部依赖未完整枚举，不生成 CASCADE。',
    'Existing data in column {p0} will be deleted. External dependencies are not fully enumerated; CASCADE is not generated.',
  ],
  addColumn: ['新增字段 {p0}', 'Add column {p0}'],
  aNewNonNullColumnHasNoDefaultExistingRows: [
    '新增非空字段无默认值，已有行需要回填，直接执行可能失败。',
    'A new non-null column has no default. Existing rows need backfilling, so direct execution may fail.',
  ],
  columnComment: ['字段注释 {p0}', 'Column comment {p0}'],
  modifyColumn: ['修改字段 {p0}', 'Modify column {p0}'],
  mysqlModifyRestatesTheColumnDefinitionAndMayRebuildOr: [
    'MySQL MODIFY 会重述字段定义，可能重建或锁住表；类型收窄须核对已有数据。',
    'MySQL MODIFY restates the column definition and may rebuild or lock the table. Check existing data before narrowing types.',
  ],
  generatedColumnIdentityOrEnumChangesForRequireManualReview: [
    '字段 {p0} 的生成列 / Identity / 枚举修改需结合目标版本和数据规则手工审查。',
    'Generated-column, identity or enum changes for {p0} require manual review against the target version and data rules.',
  ],
  postgresqlCannotChangePhysicalColumnOrderThroughAlterNoFabricated: [
    'PostgreSQL 不支持 ALTER 调整物理字段顺序，此项不生成伪 DDL。',
    'PostgreSQL cannot change physical column order through ALTER. No fabricated DDL is generated.',
  ],
  generatedColumnDependsOnColumnReviewRemovalAndRecreationOf: [
    '字段 {p0} 被生成列 {p1} 依赖；必须先审查该生成列的移除与重建，不能直接 ALTER TYPE。',
    'Generated column {p1} depends on column {p0}. Review removal and recreation of that generated column before ALTER TYPE.',
  ],
  columnType: ['字段类型 {p0}', 'Column type {p0}'],
  explicitNativeConversionWithUsingMayFailOrLosePrecision: [
    'USING 显式原生类型转换可能失败或丢失精度；源类型定义、依赖表达式和目标数据需核对。',
    'Explicit native conversion with USING may fail or lose precision. Verify source type definitions, dependent expressions and target data.',
  ],
  columnDefault: ['字段默认值 {p0}', 'Column default {p0}'],
  columnNullConstraint: ['字段 NULL 约束 {p0}', 'Column NULL constraint {p0}'],
  beforeSetNotNullEnsureExistingRowsContainNoNull: [
    'SET NOT NULL 前须确认已有行没有 NULL。',
    'Before SET NOT NULL, ensure existing rows contain no NULL values.',
  ],
  removeOldIndex: ['移除旧索引 {p0}', 'Remove old index {p0}'],
  addIndex: ['建立索引 {p0}', 'Add index {p0}'],
  thisOriginalDdlConstraintRequiresTheSqliteRebuildFlow: [
    '此原始 DDL 约束需要 SQLite 重建流程。',
    'This original DDL constraint requires the SQLite rebuild flow.',
  ],
  removeOldConstraint: ['移除旧约束 {p0}', 'Remove old constraint {p0}'],
  addConstraint: ['建立约束 {p0}', 'Add constraint {p0}'],
  newPkUniqueCheckConstraintsRequireExistingDataToComply: [
    '新增 PK / UNIQUE / CHECK 需要现有数据满足约束，可能扫描整表。',
    'New PK / UNIQUE / CHECK constraints require existing data to comply and may scan the whole table.',
  ],
  theForeignKeyNameIsInferredFromASequenceNumber: [
    '外键名称来自推断编号，不能据此 DROP CONSTRAINT。',
    'The foreign key name is inferred from a sequence number and cannot be used for DROP CONSTRAINT.',
  ],
  removeOldForeignKey: ['移除旧外键 {p0}', 'Remove old foreign key {p0}'],
  foreignKeysRequireAnExistingTargetTableAndUsableUnique: [
    '外键需引用目标库中已存在的表及可用唯一键，并核对现有数据。',
    'Foreign keys require an existing target table and usable unique key; verify existing data.',
  ],
  postgresqlTriggersDependOnFunctionsAndEnabledStatusThisBatch: [
    'PostgreSQL 触发器依赖函数和启用状态；本批不部署函数，保留原定义供审查。',
    'PostgreSQL triggers depend on functions and enabled status. This batch does not deploy functions; the original definition is retained for review.',
  ],
  removeTrigger: ['移除触发器 {p0}', 'Remove trigger {p0}'],
  addTrigger: ['建立触发器 {p0}', 'Add trigger {p0}'],
  triggerBodiesMayReferenceSourceObjectsOrUseDifferentPermissions: [
    '触发器正文可能引用源对象或使用不同权限，须审查正文；MySQL 客户端可能需要 DELIMITER。',
    'Trigger bodies may reference source objects or use different permissions. Review the body; MySQL clients may require DELIMITER.',
  ],
  tableComment: ['表注释', 'Table comment'],
  theTablePropertyIsNotAValidNativeName: [
    '表属性不是有效的原生名称。',
    'The table property is not a valid native name.',
  ],
  tableProperty: ['表属性 {p0}', 'Table property {p0}'],
  tablePropertyChangesMayRebuildOrLockTheTableOr: [
    '表属性变更可能重建、锁表或改变后续默认排序规则。',
    'Table-property changes may rebuild or lock the table, or change future default collations.',
  ],
  tableOwner: ['表所有者', 'Table owner'],
  tablePersistence: ['表持久性', 'Table persistence'],
  tablespace: ['表空间', 'Tablespace'],
  tablePropertyLacksAReliableNativeChangeRuleAndRequires: [
    '表属性 {p0} 缺少可靠的原生变更规则，需手工审查。',
    'Table property {p0} lacks a reliable native change rule and requires manual review.',
  ],
  dependentForeignKeyLacksItsActualCatalogNameAndCannot: [
    '依赖外键 {p0} 缺少真实目录名称，不能可靠地暂移。',
    'Dependent foreign key {p0} lacks its actual catalog name and cannot be temporarily removed reliably.',
  ],
  temporarilyRemoveDependentForeignKey: [
    '暂移依赖外键 {p0}',
    'Temporarily remove dependent foreign key {p0}',
  ],
  restoreDependentForeignKey: ['恢复依赖外键 {p0}', 'Restore dependent foreign key {p0}'],
  recordForeignKeySettingsAndBeginTheRebuildTransaction: [
    '记录外键设置并开启重建事务',
    'Record foreign-key settings and begin the rebuild transaction',
  ],
  verifyForeignKeysAndManuallyConfirmCommit: [
    '核对外键并人工确认提交',
    'Verify foreign keys and manually confirm commit',
  ],
  theSqliteRebuildScriptDeliberatelyStopsAtACheckpointInside: [
    'SQLite 重建脚本有意停在事务内的检查点。foreign_key_check 只返回问题，不会自动阻止 COMMIT，必须审查后另行提交或回滚。',
    'The SQLite rebuild script deliberately stops at a checkpoint inside the transaction. foreign_key_check reports issues but does not block COMMIT automatically; review before separately committing or rolling back.',
  ],
  sourceAndTargetShareAConnectionAndSchemaSourceIndex: [
    '源目标处于同一连接与 Schema，源索引 / 约束名 {p0} 可能已占用；请审查并为目标选择独立名称。',
    'Source and target share a connection and schema. Source index / constraint name {p0} may already be used; review and choose an independent target name.',
  ],
  requiresManualHandling: ['需手工处理', 'Requires manual handling'],
  effects: ['影响', 'Effects'],
});
