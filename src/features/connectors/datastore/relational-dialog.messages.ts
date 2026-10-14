import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  connected: ['连接成功 · {p0} · {p1}', 'Connected · {p0} · {p1}'],
  connectionActionFailed: ['连接操作失败', 'Connection action failed'],
  editConnection: ['编辑 {p0} 连接', 'Edit {p0} connection'],
  newConnection: ['新建 {p0} 连接', 'New {p0} connection'],
  connectionName: ['连接名称', 'Connection name'],
  exampleLocalDevelopmentDatabase: ['例如：本地开发数据库', 'Example: Local development database'],
  host: ['主机', 'Host'],
  port: ['端口', 'Port'],
  database: ['数据库', 'Database'],
  leaveEmptyToChooseADatabaseInTheWorkbench: [
    '可留空，在工作台选择数据库',
    'Leave empty to choose a database in the workbench',
  ],
  username: ['用户名', 'Username'],
  sqliteFileOnTheDevice: ['设备上的 SQLite 文件', 'SQLite file on the device'],
  useAnAbsolutePathTheFileMustAlreadyExistOn: [
    '使用绝对路径；文件须位于当前设备并已存在。',
    'Use an absolute path; the file must already exist on the current device.',
  ],
  connectionPassword: ['连接密码', 'Connection password'],
  thePasswordIsRetainedTemporarilyForOpeningTheWorkbenchAnd: [
    '密码临时保留以便直接打开工作台，不写入连接配置。',
    'The password is retained temporarily for opening the workbench and is not saved in the connection configuration.',
  ],
  saveConnection: ['保存连接', 'Save connection'],
});
