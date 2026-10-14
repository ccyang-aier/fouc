import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  connectionUrlContainsAnInvalidPercentEscape: [
    '连接 URL 存在无效的百分号转义',
    'Connection URL contains an invalid percent escape',
  ],
  acceptsOnlyTrueFalse: ['{p0} 只接受 true / false', '{p0} accepts only true / false'],
  mustBeAnInteger: ['{p0} 必须为整数', '{p0} must be an integer'],
  mustBeInTheRange: ['{p0} 超出 {p1}–{p2} 范围', '{p0} must be in the {p1}–{p2} range'],
  invalidConnectionHost: ['连接主机无效', 'Invalid connection host'],
  theConnectionHostMustBeADnsName: [
    '连接主机须为 DNS 名称或有效 IPv4 / IPv6 地址',
    'The connection host must be a DNS name or a valid IPv4 / IPv6 address',
  ],
  invalid: ['{p0} 无效', 'Invalid {p0}'],
  invalidMongodbHostOrConnectionParameters: [
    'MongoDB 主机与连接参数无效',
    'Invalid MongoDB host or connection parameters',
  ],
  unsupportedMongodbConnectionParameters: [
    '不支持的 MongoDB 连接参数：{p0}',
    'Unsupported MongoDB connection parameters: {p0}',
  ],
  invalidMongodbSrvOrHostListParameters: [
    'MongoDB SRV 与主机列表参数无效',
    'Invalid MongoDB SRV or host list parameters',
  ],
  invalidMongodbHostListParameters: [
    'MongoDB 主机列表参数无效',
    'Invalid MongoDB host list parameters',
  ],
  invalidMongodbParameters: ['MongoDB {p0} 参数无效', 'Invalid MongoDB {p0} parameters'],
  invalidMongodbUriExtraParameters: [
    'MongoDB URI 附加参数无效',
    'Invalid MongoDB URI extra parameters',
  ],
  unsupportedMongodbParameters: [
    '不支持的 MongoDB 参数：{p0}',
    'Unsupported MongoDB parameters: {p0}',
  ],
  invalidReadpreference: ['readPreference 无效', 'Invalid readPreference'],
  theCurrentMongodbAuthmechanismIsNotAvailable: [
    '当前 MongoDB authMechanism 未开放',
    'The current MongoDB authMechanism is not available',
  ],
  duplicateOrConflictingConnectionOptions: [
    '重复或冲突的连接选项：{p0}',
    'Duplicate or conflicting connection options: {p0}',
  ],
  duplicateConnectionOption: ['连接选项重复：{p0}', 'Duplicate connection option: {p0}'],
  thisConnectionSettingDisablesServerCertificateValidationWhic: [
    '此连接设置会关闭服务器证书校验，当前连接器不支持',
    'This connection setting disables server certificate validation, which the current connector does not support',
  ],
  serverCertificateAndHostnameValidationAlwaysRemainEnabled: [
    '{p0}：服务器证书与主机名校验始终开启',
    '{p0}: server certificate and hostname validation always remain enabled',
  ],
  filePathsOrPasswordsAreNotReadFrom: [
    '{p0} 文件路径或口令不从 URL 读取，请使用 TLS 证书上传区',
    '{p0} file paths or passwords are not read from the URL; use the TLS certificate upload section',
  ],
  password: ['密码', 'password'],
  username: ['用户名', 'username'],
  theUrlIncludesTwiceRemoveTheDuplicateParameter: [
    'URL 同时包含两处{p0}，请移除重复参数',
    'The URL includes {p0} twice. Remove the duplicate parameter',
  ],
  supportsOnlyDisabledTlsOrFullValidationVerify: [
    '{p0} 仅支持关闭 TLS 或完整校验（verify-full / VERIFY_IDENTITY）',
    '{p0} supports only disabled TLS or full validation (verify-full / VERIFY_IDENTITY)',
  ],
  postgresqlOptionsCurrentlySupportOnlyCStatementTimeout: [
    'PostgreSQL options 目前仅支持 -c statement_timeout=<毫秒>',
    'PostgreSQL options currently support only -c statement_timeout=<milliseconds>',
  ],
  unsupportedUrlParameterAdjustTheParameterExplicitlyBefore: [
    '不支持的 {p0} URL 参数：{p1}。请明确调整参数后再应用。',
    'Unsupported {p0} URL parameter: {p1}. Adjust the parameter explicitly before applying.',
  ],
  invalidDsnParameterName: ['DSN 参数名称无效', 'Invalid DSN parameter name'],
  dsnParameterIsMissingAnEqualsSign: [
    'DSN 参数 {p0} 缺少等号',
    'DSN parameter {p0} is missing an equals sign',
  ],
  incompleteDsnBackslashEscape: ['DSN 反斜线转义未完成', 'Incomplete DSN backslash escape'],
  dsnSingleQuoteIsNotClosed: ['DSN 单引号未闭合', 'DSN single quote is not closed'],
  aSpaceIsRequiredAfterADsnQuote: ['DSN 引号后须有空格', 'A space is required after a DSN quote'],
  duplicateDsnParameter: ['DSN 参数重复：{p0}', 'Duplicate DSN parameter: {p0}'],
  connectionUrlDsnMustBeSingleLineText: [
    '连接 URL / DSN 须为不超过 8,192 字符的单行文本',
    'Connection URL / DSN must be single-line text no longer than 8,192 characters',
  ],
  theCurrentNativeConnectorProvidesLibpqDsnOnly: [
    '当前原生连接器只为 PostgreSQL 提供 libpq DSN',
    'The current native connector provides libpq DSN only for PostgreSQL',
  ],
  port: ['端口', 'port'],
  database: ['数据库', 'database'],
  pasteTheConnectionUrlItselfCommandLineFlags: [
    '请粘贴连接 URL 本身；命令行标志与未转义空格不受支持',
    'Paste the connection URL itself; command-line flags and unescaped spaces are unsupported',
  ],
  onlyPostgresqlMysqlRedisAndMongodbConnectionUrls: [
    '当前仅支持 PostgreSQL、MySQL、Redis 与 MongoDB 连接 URL',
    'Only PostgreSQL, MySQL, Redis, and MongoDB connection URLs are currently supported',
  ],
  urlTypeDoesNotMatchTheCurrentConnection: [
    'URL 的 {p0} 类型与当前 {p1} 连接不一致',
    'URL type {p0} does not match the current {p1} connection',
  ],
  connectionAddressContainsAnUnsupportedHostList: [
    '连接地址包含不支持的主机列表',
    'Connection address contains an unsupported host list',
  ],
  invalidConnectionUrlCheckTheHostIpvBrackets: [
    '连接 URL 无效，检查主机、IPv6 括号与端口',
    'Invalid connection URL. Check the host, IPv6 brackets, and port',
  ],
  connectionUrlsDoNotSupportFragmentsRemoveSettings: [
    '连接 URL 不支持片段标记；请移除 # 后的设置',
    'Connection URLs do not support fragments. Remove settings after #',
  ],
  theDatabasePathSupportsOnlyOneEscapedName: [
    '数据库路径仅支持一个已转义名称',
    'The database path supports only one escaped name',
  ],
  redisDatabaseIndex: ['Redis 数据库索引', 'Redis database index'],
  mongodbSrvRequiresOneDnsHostWithoutA: [
    'MongoDB SRV 需要一个不带端口的 DNS 主机',
    'MongoDB SRV requires one DNS host without a port',
  ],
  multiHostMongodbUrlsMustRetainTheHost: [
    '多主机 MongoDB URL 必须保留主机列表；不能降为单主机配置',
    'Multi-host MongoDB URLs must retain the host list and cannot become single-host configurations',
  ],
  theRedissProtocolConflictsWithTheDisabledTls: [
    'rediss 协议与关闭 TLS 的选项冲突',
    'The rediss protocol conflicts with the disabled TLS option',
  ],
  mongodbSrvDoesNotSupportDirectconnectionTrue: [
    'MongoDB SRV 不支持 directConnection=true',
    'MongoDB SRV does not support directConnection=true',
  ],
  multiHostMongodbUrlsDoNotSupportDirectconnection: [
    '多主机 MongoDB URL 不支持 directConnection=true',
    'Multi-host MongoDB URLs do not support directConnection=true',
  ],
  urlDsnDoesNotIncludeCertificateContentsRequired: [
    'URL / DSN 不包含证书内容；建立连接时仍需提供所需文件',
    'URL / DSN does not include certificate contents; required files must still be provided when connecting',
  ],
  customTlsServerNamesAreKeptOnlyIn: [
    '自定义 TLS 服务器名称仅保留在高级连接设置中',
    'Custom TLS server names are kept only in advanced connection settings',
  ],
  theMinimumTlsVersionIsKeptOnlyIn: [
    '最低 TLS 版本仅保留在高级连接设置中，URL / DSN 无法表达该限制',
    'The minimum TLS version is kept only in advanced connection settings; URL / DSN cannot express this limit',
  ],
  libpqDsnAppliesOnlyToPostgresql: [
    'libpq DSN 只适用于 PostgreSQL',
    'libpq DSN applies only to PostgreSQL',
  ],
  libpqConnectTimeoutCanExpressOnlyWholeSecond: [
    'libpq connect_timeout 只能表达整秒连接超时',
    'libpq connect_timeout can express only whole-second connection timeouts',
  ],
  connectionPoolIdleTimeoutIsNotIncludedIn: [
    '连接池空闲回收超时不包含在 libpq DSN 中',
    'Connection pool idle timeout is not included in libpq DSN',
  ],
  postgresqlUrlConnectTimeoutCanExpressOnlyWhole: [
    'PostgreSQL URL connect_timeout 只能表达整秒连接超时',
    'PostgreSQL URL connect_timeout can express only whole-second connection timeouts',
  ],
  mysqlQueryDeadlinesAreKeptOnlyInAdvanced: [
    'MySQL 查询截止时间仅保留在高级连接设置中',
    'MySQL query deadlines are kept only in advanced connection settings',
  ],
  connectionPoolIdleTimeoutIsKeptOnlyIn: [
    '连接池空闲回收超时仅保留在高级连接设置中',
    'Connection pool idle timeout is kept only in advanced connection settings',
  ],
  mongodbHostListsMustContainEntries: [
    'MongoDB 主机列表须为 1–20 项',
    'MongoDB host lists must contain 1–20 entries',
  ],
  mongodbSrvRequiresASingleDnsHost: [
    'MongoDB SRV 需要单个 DNS 主机',
    'MongoDB SRV requires a single DNS host',
  ],
  directconnectionTrueAppliesOnlyToSingleHostMongodb: [
    'directConnection=true 仅适用于单主机 MongoDB URL',
    'directConnection=true applies only to single-host MongoDB URLs',
  ],
});
