import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  mustBeAnObject: ['{p0}须为对象', '{p0} must be an object'],
  containsUnsupportedFields: [
    '{p0}包含不支持的字段：{p1}',
    '{p0} contains unsupported fields: {p1}',
  ],
  invalid: ['{p0}无效', 'Invalid {p0}'],
  host: ['主机', 'host'],
  theHostMustBeADnsOrIp: ['主机须为 DNS 或 IP 地址', 'The host must be a DNS or IP address'],
  theHostMustBeAValidDnsOr: [
    '主机须为有效 DNS 或 IP 地址',
    'The host must be a valid DNS or IP address',
  ],
  advancedConnectionParameters: ['高级连接参数', 'advanced connection parameters'],
  advancedConnectionParametersAreMissing: [
    '高级连接参数缺少 {p0}',
    'Advanced connection parameters are missing {p0}',
  ],
  tlsParameters: ['TLS 参数', 'TLS parameters'],
  publicTlsParametersCertificatesPrivateKeysAndPasswords: [
    '公开 TLS 参数（不接受证书、私钥或口令）',
    'public TLS parameters (certificates, private keys, and passwords are not accepted)',
  ],
  tlsParametersAreMissing: ['TLS 参数缺少 {p0}', 'TLS parameters are missing {p0}'],
  connectionEntry: ['连接条目', 'connection entry'],
  connectionName: ['连接名称', 'connection name'],
  connectionConfiguration: ['连接配置', 'connection configuration'],
  sqliteConfiguration: ['SQLite 配置', 'SQLite configuration'],
  sqliteFilePath: ['SQLite 文件路径', 'SQLite file path'],
  sqliteFilePathsMustBeAbsolute: [
    'SQLite 文件路径须为绝对路径',
    'SQLite file paths must be absolute',
  ],
  configurationContainsANativeConnectionTypeThatIs: [
    '配置包含当前未支持的原生连接类型',
    'Configuration contains a native connection type that is not currently supported',
  ],
  publicConnectionConfigurationPasswordsAndUrisAreNot: [
    '公开连接配置（不接受密码或 URI）',
    'public connection configuration (passwords and URIs are not accepted)',
  ],
  port: ['端口', 'port'],
  username: ['用户名', 'username'],
  redisDatabaseIndex: ['Redis 数据库索引', 'Redis database index'],
  databaseName: ['数据库名称', 'database name'],
  mongodbAuthenticationDatabase: ['MongoDB 认证数据库', 'MongoDB authentication database'],
  invalidMongodbDatabaseName: ['MongoDB 数据库名称无效', 'Invalid MongoDB database name'],
  mongodbHostListDoesNotMatchThePrimary: [
    'MongoDB 主机列表与主连接地址不一致',
    'MongoDB host list does not match the primary connection address',
  ],
  mongodbAuthenticationDatabaseHasTwoConflictingSettings: [
    'MongoDB 认证数据库存在两处冲突设置',
    'MongoDB authentication database has two conflicting settings',
  ],
  configurationFile: ['配置文件', 'configuration file'],
  onlyTheCurrentFoucConfigurationFileFormatAnd: [
    '仅支持当前 Fouc 配置文件格式与版本',
    'Only the current Fouc configuration file format and version are supported',
  ],
  exportTime: ['导出时间', 'export time'],
  invalidConfigurationFileExportTime: [
    '配置文件导出时间无效',
    'Invalid configuration file export time',
  ],
  configurationFilesMustContainConnections: [
    '配置文件须包含 1–500 个连接',
    'Configuration files must contain 1–500 connections',
  ],
  invalidConfiguration: ['配置无效', 'Invalid configuration'],
  connection: ['第 {p0} 个连接：{p1}', 'Connection {p0}: {p1}'],
  publicConnectionConfigurationExceedsTheMibLimit: [
    '公开连接配置超过 2 MiB 限制',
    'Public connection configuration exceeds the 2 MiB limit',
  ],
  publicConfigurationFilesMustNotExceedMib: [
    '公开配置文件不能超过 2 MiB',
    'Public configuration files must not exceed 2 MiB',
  ],
  configurationFileIsNotValidJson: [
    '配置文件不是有效 JSON',
    'Configuration file is not valid JSON',
  ],
});
