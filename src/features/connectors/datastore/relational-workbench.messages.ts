import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  draftSaveFailedTheCurrentWorkbenchStaysOpen: [
    '草稿保存失败，当前工作台保持打开',
    'Draft save failed; the current workbench stays open',
  ],
  couldNotChangeWritePermissions: ['切换写入权限失败', 'Could not change write permissions'],
  defaultRowsPerPageSetTo: ['默认每页行数已设为 {p0}', 'Default rows per page set to {p0}'],
  rowCountAppliedButTheDefaultCouldNotBeSaved: [
    '行数已应用，无法保存默认值',
    'Row count applied, but the default could not be saved',
  ],
  draftSaveFailedTheCurrentViewStaysOpen: [
    '草稿保存失败，当前视图保持打开',
    'Draft save failed; the current view stays open',
  ],
  databaseWorkbench: ['{p0} 数据库工作台', '{p0} database workbench'],
  backToDatabaseConnections: ['返回数据库连接列表', 'Back to database connections'],
  commitOrDiscardPendingChangesFirst: [
    '先提交或放弃待提交变更',
    'Commit or discard pending changes first',
  ],
  backToConnections: ['返回连接列表', 'Back to connections'],
  expandDatabaseResources: ['展开数据库资源', 'Expand database resources'],
  connected: ['已连接', 'Connected'],
  connectionActions: ['连接操作', 'Connection actions'],
  databaseManagement: ['数据库管理', 'Database management'],
  writeAndConnectionInformation: ['写入与连接信息', 'Write and connection information'],
  lockTableWrites: ['锁定表格写入', 'Lock table writes'],
  unlockTableWrites: ['解锁表格写入', 'Unlock table writes'],
  lockWrites: ['锁定写入', 'Lock writes'],
  unlockWrites: ['解锁写入', 'Unlock writes'],
  pendingChanges: ['有待提交变更', 'Pending changes'],
  importExport: ['导入/导出', 'Import / Export'],
  dataTable: ['数据表', 'Data table'],
  selectATableOrView: ['选择表或视图', 'Select a table or view'],
  browseData: ['数据浏览', 'Browse data'],
  browseStructure: ['结构浏览', 'Browse structure'],
  retry: ['重试', 'Retry'],
  cannotLeaveYet: ['暂时无法离开：', 'Cannot leave yet: '],
  readingTableData: ['正在读取表数据…', 'Reading table data…'],
  selectATableToStartBrowsing: ['选择一个表开始浏览', 'Select a table to start browsing'],
  orOpenASqlQueryToExecuteStatementsInThe: [
    '或打开 SQL 查询，在当前 Schema 中执行语句。',
    'Or open a SQL query to execute statements in the current schema.',
  ],
});
