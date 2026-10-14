import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  createForeignKey: ['创建外键', 'Create foreign key'],
  dropForeignKey: ['删除外键', 'Drop foreign key'],
  readingTheTableSNativeCatalog: ['读取本表原生目录…', "Reading the table's native catalog…"],
  foreignKeyName: ['外键名称', 'Foreign key name'],
  newForeignKeyName: ['新外键名称', 'New foreign key name'],
  referencedCatalog: ['引用目录', 'Referenced catalog'],
  foreignKeyReferenceCatalog: ['外键引用目录', 'Foreign key reference catalog'],
  referencedTable: ['引用数据表', 'Referenced table'],
  foreignKeyReferenceTable: ['外键引用表', 'Foreign key reference table'],
  selectAnActualTable: ['选择真实表', 'Select an actual table'],
  completeReferencedUniqueKey: ['完整引用唯一键', 'Complete referenced unique key'],
  foreignKeyReferencedUniqueKey: ['外键引用唯一键', 'Foreign key referenced unique key'],
  selectAUniquePrimaryKey: ['选择唯一键 / 主键', 'Select a unique / primary key'],
  theReferencedTableHasNoSupportedCompleteValidNonDeferred: [
    '引用表没有当前支持的完整、有效、非延迟唯一键。部分索引、表达式与前缀索引不能作为本入口的引用目标。',
    'The referenced table has no supported complete, valid, non-deferred unique key. Partial, expression and prefix indexes cannot be referenced here.',
  ],
  columnMapping: ['字段对应', 'Column mapping'],
  compositeKeysFollowNativeCatalogOrder: [
    '复合键按原生目录顺序引用',
    'Composite keys follow native catalog order',
  ],
  localColumn: ['本表字段 {p0}', 'Local column {p0}'],
  selectALocalColumn: ['选择本表字段', 'Select a local column'],
  foreignKeyDeleteAction: ['外键删除行为', 'Foreign key delete action'],
  foreignKeyUpdateAction: ['外键更新行为', 'Foreign key update action'],
  actualForeignKey: ['真实外键', 'Actual foreign key'],
  foreignKeyToDrop: ['要删除的外键', 'Foreign key to drop'],
  selectAnExistingForeignKey: ['选择已存在外键', 'Select an existing foreign key'],
  thisTableHasNoExistingForeignKeys: [
    '本表没有已存在的外键。',
    'This table has no existing foreign keys.',
  ],
});
