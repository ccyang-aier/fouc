import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  invalidImportPlan: ['导入计划无效', 'Invalid import plan'],
  configurationFilesMustNotExceedMib: [
    '配置文件不能超过 3 MiB',
    'Configuration files must not exceed 3 MiB',
  ],
  theConfigurationFileMustBeUtfJsonText: [
    '配置文件须为 UTF-8 JSON 文本',
    'The configuration file must be UTF-8 JSON text',
  ],
  theConfigurationFileIsNotValidJson: [
    '配置文件不是有效 JSON',
    'The configuration file is not valid JSON',
  ],
  couldNotReadTheFile: ['文件读取失败', 'Could not read the file'],
  configurationValidationFailed: ['配置校验失败', 'Configuration validation failed'],
  cancelled: [' · 取消 {p0}', ' · Cancelled {p0}'],
  savedFailedSkipped: [
    '已保存 {p0} · 失败 {p1} · 跳过 {p2}{p3}',
    'Saved {p0} · Failed {p1} · Skipped {p2}{p3}',
  ],
  cancelledBeforeSavingAnyConnections: [
    '已取消，尚未开始保存连接',
    'Cancelled before saving any connections',
  ],
  couldNotImportConfigurations: ['配置导入失败', 'Could not import configurations'],
  stoppingSubsequentImportsActualResultsWillAppearAfterTheCurrent: [
    '正在停止后续导入；当前保存请求完成后会显示实际结果。',
    'Stopping subsequent imports. Actual results will appear after the current save request finishes.',
  ],
  importConnectionConfigurations: ['导入连接配置', 'Import connection configurations'],
  importToTheCurrentDeviceFoucPublicConfigurationsOnlySaving: [
    '导入到当前设备 · 仅 Fouc 公开连接配置 · 完整校验后才会开始保存',
    'Import to the current device · Fouc public configurations only · Saving starts after full validation',
  ],
  chooseAConnectionConfigurationFile: [
    '选择连接配置文件',
    'Choose a connection configuration file',
  ],
  publicJsonOrPassphraseEncryptedFoucJsonMaximumMib: [
    '公开 JSON 或使用口令加密的 Fouc JSON · 最大 3 MiB',
    'Public JSON or passphrase-encrypted Fouc JSON · Maximum 3 MiB',
  ],
  decryptionPassphrase: ['解密口令', 'Decryption passphrase'],
  supportsPostgresqlMysqlSqliteRedisAndMongodbFormatsAndCredential: [
    '支持 PostgreSQL、MySQL、SQLite、Redis 和 MongoDB。其他工具的格式及凭据存储不在本次导入范围内。',
    'Supports PostgreSQL, MySQL, SQLite, Redis and MongoDB. Formats and credential stores from other tools are not included.',
  ],
  validatedConnections: ['个已校验连接', ' validated connections'],
  eachTypeImportsIntoItsCorrespondingConnectionDirectory: [
    '· 各类型会导入其相应连接目录',
    '· Each type imports into its corresponding connection directory',
  ],
  chooseAgain: ['重新选择', 'Choose again'],
  newConnectionsAreCreatedByDefaultWithDuplicatesRenamedExisting: [
    '默认新建并为同名连接改名。只有明确选择“替换现有同名配置”才会更新现有连接。',
    'New connections are created by default, with duplicates renamed. Existing connections change only when Replace existing configuration is explicitly selected.',
  ],
  savingCompleted: ['正在保存 · 已完成 {p0} / {p1}', 'Saving · Completed {p0} / {p1}'],
  readingDecryptingAndValidatingConfigurations: [
    '正在读取、解密与校验配置…',
    'Reading, decrypting and validating configurations…',
  ],
  createUpdateSkip: ['新建 {p0} · 更新 {p1} · 跳过 {p2}', 'Create {p0} · Update {p1} · Skip {p2}'],
  doesNotReadDatabaseContents: ['不读取数据库内容', 'Does not read database contents'],
  stopSubsequentImports: ['停止后续导入', 'Stop subsequent imports'],
  close: ['关闭', 'Close'],
  cancel: ['取消', 'Cancel'],
  validateAndPreview: ['校验并预览', 'Validate and preview'],
  confirmImport: ['确认导入', 'Confirm import'],
  connections: ['个连接', ' connections'],
});
