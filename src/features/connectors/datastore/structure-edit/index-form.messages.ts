import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  indexName: ['索引名称', 'Index name'],
  editIndexName: ['编辑索引名称', 'Edit index name'],
  forExampleIdxDisplayName: ['例如 idx_display_name', 'For example, idx_display_name'],
  indexMethod: ['索引方法', 'Index method'],
  uniqueIndex: ['唯一索引', 'Unique index'],
  rejectDuplicateKeys: ['拒绝重复键', 'Reject duplicate keys'],
  indexKeyOrder: ['索引键顺序', 'Index key order'],
  indexKey: ['索引键 {p0}', 'Index key {p0}'],
  selectField: ['选择字段', 'Select field'],
  indexSortOrder: ['索引排序 {p0}', 'Index sort order {p0}'],
  indexPrefixLength: ['索引前缀长度 {p0}', 'Index prefix length {p0}'],
  prefixLength: ['前缀长度', 'Prefix length'],
  removeIndexKey: ['移除索引键 {p0}', 'Remove index key {p0}'],
  addIndexKey: ['＋ 添加索引键', '＋ Add index key'],
  includeCoveringColumns: ['INCLUDE 覆盖字段', 'INCLUDE covering columns'],
  partialIndexWhere: ['条件索引 WHERE', 'Partial index WHERE'],
  indexPredicate: ['索引条件', 'Index predicate'],
  forExampleDeletedAtIsNullLeaveEmptyToIndex: [
    '例如 deleted_at IS NULL；留空表示全表索引',
    'For example, deleted_at IS NULL; leave empty to index the entire table',
  ],
  indexComment: ['索引注释', 'Index comment'],
  commitUsesAStandardIndexBuildWhichMayLockThe: [
    '提交采用普通索引构建，可能锁表。扩展 opclass、表达式索引和 CONCURRENTLY 请通过 DDL 审查处理。',
    'Commit uses a standard index build, which may lock the table. Handle extended opclass, expression indexes, and CONCURRENTLY through DDL review.',
  ],
});
