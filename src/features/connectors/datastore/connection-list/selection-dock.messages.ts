import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  updateTags: ['标签更新', 'Tag update'],
  delete: ['删除', 'Delete'],
  connectionTest: ['连接测试', 'Connection test'],
  bulkConnectionActions: ['连接批量操作', 'Bulk connection actions'],
  selectedCount: ['已选 {count} 项', 'Selected {count}'],
  bulkActions: ['批量操作', 'Bulk actions'],
  addTags: ['打标签', 'Add tags'],
  testConnections: ['测试连接', 'Test connections'],
  clearConnectionSelection: ['清除连接选择', 'Clear connection selection'],
  clearSelection: ['清除选择', 'Clear selection'],
  completedSummary: ['{action}完成 · {count} 成功', '{action} complete · {count} succeeded'],
  failed: [' · {p0} 失败', ' · {p0} failed'],
  viewFailures: ['查看失败', 'View failures'],
  closeBulkActionResults: ['关闭批量操作结果', 'Close bulk action results'],
});
