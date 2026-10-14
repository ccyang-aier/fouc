import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  copiedTheSqlTextFromTheCurrentSnapshot: [
    '已复制当前快照的 SQL 文本',
    'Copied the SQL text from the current snapshot',
  ],
  copyFailedSelectTheTextAndCopyItManually: [
    '复制失败，请选中文本手动复制',
    'Copy failed. Select the text and copy it manually',
  ],
  sqliteDoesNotProvideAServerSessionDirectory: [
    'SQLite 不提供服务器会话目录',
    'SQLite does not provide a server session directory',
  ],
  fileAndConnectionDetailsComeFromRealPragmaResultsNo: [
    '文件与连接概览来自真实 PRAGMA，不展示推测的进程、连接数量或运行 SQL。',
    'File and connection details come from real PRAGMA results. No process counts, connection counts or running SQL are inferred.',
  ],
  nativeActiveSessions: ['原生活动会话', 'Native active sessions'],
  activeSessions: ['活动会话', 'Active sessions'],
  visibleRecords: ['条可见记录', ' visible records'],
  filterActiveSessions: ['筛选活动会话', 'Filter active sessions'],
  filterUserDatabaseStatusOrSql: [
    '筛选用户、数据库、状态、SQL…',
    'Filter user, database, status or SQL…',
  ],
  theRowSamplingLimitHasBeenReachedTheRecordCount: [
    '已达到 500 行采样上限，当前记录数只是下界，不代表完整目录。',
    'The 500-row sampling limit has been reached. The record count is a lower bound, not the full catalog size.',
  ],
  sessionId: ['会话 ID', 'Session ID'],
  user: ['用户', 'User'],
  database: ['数据库', 'Database'],
  status: ['状态', 'Status'],
  ageSeconds: ['年龄 / 秒', 'Age / Seconds'],
  clientWait: ['客户端 / 等待', 'Client / Wait'],
  sqlInformation: ['SQL / 信息', 'SQL / Information'],
  details: ['详情', 'Details'],
  unknown: ['未知', 'Unknown'],
  samplingConnection: ['采样连接', 'Sampling connection'],
  hiddenByPermissions: [' · 权限遮蔽', ' · Hidden by permissions'],
  notProvided: ['未提供', 'Not provided'],
  viewDetailsForSession: ['查看会话 {p0} 详情', 'View details for session {p0}'],
  view: ['查看', 'View'],
  noSessionsMatchTheCurrentSampleNativePermissionsOrFilters: [
    '当前样本没有匹配会话。原生权限或筛选可能限制可见范围。',
    'No sessions match the current sample. Native permissions or filters may limit visibility.',
  ],
  activeSessionSnapshotDetails: ['活动会话快照详情', 'Active session snapshot details'],
  session: ['会话', 'Session'],
  frozenSnapshotLaterRefreshesDoNotReplaceTheseDetails: [
    '冻结的快照 · 后续刷新不会替换当前详情',
    'Frozen snapshot · Later refreshes do not replace these details',
  ],
  closeActiveSessionDetails: ['关闭活动会话详情', 'Close active session details'],
  client: ['客户端', 'Client'],
  application: ['应用', 'Application'],
  nativeBackendType: ['原生后台类型', 'Native backend type'],
  command: ['命令', 'Command'],
  waitEvent: ['等待事件', 'Wait event'],
  sqlNativeInformation: ['SQL / 原生信息', 'SQL / Native information'],
  copySql: ['复制 SQL', 'Copy SQL'],
  theCurrentAccountCannotReadTheSqlText: [
    '当前账号未取得 SQL 文本。',
    'The current account cannot read the SQL text.',
  ],
  thisTextIsLimitedToClientCharactersAndTheDatabase: [
    '此文本受客户端 65,536 字符与数据库原生采样长度限制，不保证是完整原始语句。',
    "This text is limited to 65,536 client characters and the database's native sampling length. It may not contain the complete original statement.",
  ],
});
