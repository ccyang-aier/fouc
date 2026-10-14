import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import {
  defaultConnectionOptions,
  publicConnectionOptions,
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
  type NativeNetworkProvider,
} from './connection-options';
export type ConnectionUrlHost = {
  host: string;
  port: number;
};
export type ConnectionUrlFields = {
  provider: NativeNetworkProvider;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionOptions: DatabaseConnectionOptionsInput;
  mongo?: {
    srv: boolean;
    hosts: ConnectionUrlHost[];
    authSource?: string;
    replicaSet?: string;
    directConnection?: boolean;
    retryWrites?: boolean;
    parameters?: Record<string, string>;
  };
};
export type ParsedConnectionSource = {
  fields: ConnectionUrlFields;
  format: 'url' | 'dsn';
  warnings: ValidationIssue[];
  containsPassword: boolean;
};
export type BuiltConnectionSource = {
  text: string;
  warnings: ValidationIssue[];
  containsPassword: boolean;
};
const ports: Record<NativeNetworkProvider, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  mongodb: 27017,
};
const providers: Record<string, NativeNetworkProvider> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  redis: 'redis',
  rediss: 'redis',
  mongodb: 'mongodb',
  'mongodb+srv': 'mongodb',
};
const mongoExtraNames: Record<string, string> = {
  appname: 'appName',
  w: 'w',
  readpreference: 'readPreference',
  authmechanism: 'authMechanism',
};
function decode(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-options-url.connectionUrlContainsAnInvalidPercentEscape',
        '连接 URL 存在无效的百分号转义',
      ),
    );
  }
}
function bool(text: string, name: ValidationValue) {
  if (/^(?:true|1)$/i.test(text)) return true;
  if (/^(?:false|0)$/i.test(text)) return false;
  throw new ValidationError(
    validationIssue('connection-options-url.acceptsOnlyTrueFalse', '{p0} 只接受 true / false', {
      p0: validationValue(name),
    }),
  );
}
function integer(text: string, name: ValidationValue, minimum: number, maximum: number) {
  if (!/^\d+$/.test(text))
    throw new ValidationError(
      validationIssue('connection-options-url.mustBeAnInteger', '{p0} 必须为整数', {
        p0: validationValue(name),
      }),
    );
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new ValidationError(
      validationIssue('connection-options-url.mustBeInTheRange', '{p0} 超出 {p1}–{p2} 范围', {
        p0: validationValue(name),
        p1: validationValue(minimum),
        p2: validationValue(maximum),
      }),
    );
  return value;
}
function validHost(host: string) {
  if (!host || host.length > 253 || /[\s\0/@?#\\]/u.test(host))
    throw new ValidationError(
      validationIssue('connection-options-url.invalidConnectionHost', '连接主机无效'),
    );
  const bare = host.replace(/^\[|\]$/g, '');
  try {
    const normalized = new URL(
      `http://${bare.includes(':') ? `[${bare}]` : bare}`,
    ).hostname.replace(/^\[|\]$/g, '');
    if (!normalized.includes(':') && !/^[a-zA-Z0-9_.-]+$/.test(normalized)) throw new Error();
    return normalized;
  } catch {
    throw new ValidationError(
      validationIssue(
        'connection-options-url.theConnectionHostMustBeADnsName',
        '连接主机须为 DNS 名称或有效 IPv4 / IPv6 地址',
      ),
    );
  }
}
function validText(text: string, name: ValidationValue, max = 1024) {
  if (typeof text !== 'string' || text.length > max || /[\r\n\0]/u.test(text))
    throw new ValidationError(
      validationIssue('connection-options-url.invalid', '{p0} 无效', { p0: validationValue(name) }),
    );
  return text;
}
function validateMongoOptions(value: ConnectionUrlFields['mongo']) {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError(
      validationIssue(
        'connection-options-url.invalidMongodbHostOrConnectionParameters',
        'MongoDB 主机与连接参数无效',
      ),
    );
  for (const key of Object.keys(value))
    if (
      ![
        'srv',
        'hosts',
        'authSource',
        'replicaSet',
        'directConnection',
        'retryWrites',
        'parameters',
      ].includes(key)
    )
      throw new ValidationError(
        validationIssue(
          'connection-options-url.unsupportedMongodbConnectionParameters',
          '不支持的 MongoDB 连接参数：{p0}',
          { p0: validationValue(key) },
        ),
      );
  if (typeof value.srv !== 'boolean' || !Array.isArray(value.hosts))
    throw new ValidationError(
      validationIssue(
        'connection-options-url.invalidMongodbSrvOrHostListParameters',
        'MongoDB SRV 与主机列表参数无效',
      ),
    );
  for (const host of value.hosts)
    if (
      !host ||
      typeof host !== 'object' ||
      Object.keys(host).some((key) => key !== 'host' && key !== 'port') ||
      typeof host.host !== 'string' ||
      typeof host.port !== 'number'
    )
      throw new ValidationError(
        validationIssue(
          'connection-options-url.invalidMongodbHostListParameters',
          'MongoDB 主机列表参数无效',
        ),
      );
  for (const key of ['directConnection', 'retryWrites'] as const)
    if (value[key] !== undefined && typeof value[key] !== 'boolean')
      throw new ValidationError(
        validationIssue(
          'connection-options-url.invalidMongodbParameters',
          'MongoDB {p0} 参数无效',
          { p0: validationValue(key) },
        ),
      );
  for (const key of ['authSource', 'replicaSet'] as const)
    if (value[key] !== undefined) validText(value[key], key, 256);
  if (
    value.parameters !== undefined &&
    (!value.parameters || typeof value.parameters !== 'object' || Array.isArray(value.parameters))
  )
    throw new ValidationError(
      validationIssue(
        'connection-options-url.invalidMongodbUriExtraParameters',
        'MongoDB URI 附加参数无效',
      ),
    );
}
function mongoExtra(key: string, value: string) {
  if (!mongoExtraNames[key.toLowerCase()])
    throw new ValidationError(
      validationIssue(
        'connection-options-url.unsupportedMongodbParameters',
        '不支持的 MongoDB 参数：{p0}',
        { p0: validationValue(key) },
      ),
    );
  if (key.toLowerCase() === 'w' && value !== 'majority') integer(value, 'w', 0, 2147483647);
  if (
    key.toLowerCase() === 'readpreference' &&
    !['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'].includes(value)
  )
    throw new ValidationError(
      validationIssue('connection-options-url.invalidReadpreference', 'readPreference 无效'),
    );
  if (
    key.toLowerCase() === 'authmechanism' &&
    !['SCRAM-SHA-1', 'SCRAM-SHA-256', 'MONGODB-X509', 'PLAIN', 'GSSAPI'].includes(value)
  )
    throw new ValidationError(
      validationIssue(
        'connection-options-url.theCurrentMongodbAuthmechanismIsNotAvailable',
        '当前 MongoDB authMechanism 未开放',
      ),
    );
  return validText(value, key, key.toLowerCase() === 'appname' ? 128 : 256);
}
function parseParameters(
  fields: ConnectionUrlFields,
  entries: Iterable<[string, string]>,
  warnings: ValidationIssue[],
) {
  const seen = new Set<string>(),
    logical = new Set<string>(),
    options = fields.connectionOptions,
    tls = (options.tls ??= {});
  function once(key: string) {
    if (logical.has(key))
      throw new ValidationError(
        validationIssue(
          'connection-options-url.duplicateOrConflictingConnectionOptions',
          '重复或冲突的连接选项：{p0}',
          { p0: validationValue(key) },
        ),
      );
    logical.add(key);
  }
  for (const [original, value] of entries) {
    const key = original.toLowerCase();
    if (seen.has(key))
      throw new ValidationError(
        validationIssue('connection-options-url.duplicateConnectionOption', '连接选项重复：{p0}', {
          p0: validationValue(original),
        }),
      );
    seen.add(key);
    if (
      [
        'tlsinsecure',
        'tlsallowinvalidcertificates',
        'tlsallowinvalidhostnames',
        'insecure',
        'rejectunauthorized',
        'verifyservercertificate',
      ].includes(key)
    ) {
      const disabling =
        key === 'rejectunauthorized' || key === 'verifyservercertificate'
          ? !bool(value, original)
          : bool(value, original);
      if (disabling)
        throw new ValidationError(
          validationIssue(
            'connection-options-url.thisConnectionSettingDisablesServerCertificateValidationWhic',
            '此连接设置会关闭服务器证书校验，当前连接器不支持',
          ),
        );
      warnings.push(
        validationIssue(
          'connection-options-url.serverCertificateAndHostnameValidationAlwaysRemainEnabled',
          '{p0}：服务器证书与主机名校验始终开启',
          { p0: validationValue(original) },
        ),
      );
      continue;
    }
    if (
      [
        'sslrootcert',
        'sslcert',
        'sslkey',
        'tlscafile',
        'tlscertificatekeyfile',
        'tlscertificatekeyfilepassword',
      ].includes(key)
    )
      throw new ValidationError(
        validationIssue(
          'connection-options-url.filePathsOrPasswordsAreNotReadFrom',
          '{p0} 文件路径或口令不从 URL 读取，请使用 TLS 证书上传区',
          { p0: validationValue(original) },
        ),
      );
    if (
      ['user', 'username', 'password'].includes(key) &&
      (fields.provider === 'mysql' || fields.provider === 'postgres')
    ) {
      const target = key === 'password' ? 'password' : 'username';
      once(target);
      if (fields[target])
        throw new ValidationError(
          validationIssue(
            'connection-options-url.theUrlIncludesTwiceRemoveTheDuplicateParameter',
            'URL 同时包含两处{p0}，请移除重复参数',
            {
              p0: validationValue(
                target === 'password'
                  ? validationIssue('connection-options-url.password', '密码')
                  : validationIssue('connection-options-url.username', '用户名'),
              ),
            },
          ),
        );
      fields[target] = validText(
        value,
        target === 'password'
          ? validationIssue('connection-options-url.password', '密码')
          : validationIssue('connection-options-url.username', '用户名'),
        target === 'password' ? 4096 : 256,
      );
    } else if (
      (fields.provider === 'postgres' && key === 'sslmode') ||
      (fields.provider === 'mysql' && ['sslmode', 'ssl-mode'].includes(key))
    ) {
      once('tls');
      const mode = value.toLowerCase();
      if (mode === 'disable' || mode === 'disabled') tls.enabled = false;
      else if (mode === 'verify-full' || mode === 'verify_identity' || mode === 'verify-identity')
        tls.enabled = true;
      else
        throw new ValidationError(
          validationIssue(
            'connection-options-url.supportsOnlyDisabledTlsOrFullValidationVerify',
            '{p0} 仅支持关闭 TLS 或完整校验（verify-full / VERIFY_IDENTITY）',
            { p0: validationValue(original) },
          ),
        );
    } else if (['ssl', 'tls', 'usessl'].includes(key)) {
      once('tls');
      tls.enabled = bool(value, original);
    } else if (key === 'servername' || key === 'tlsservername') {
      once('servername');
      tls.serverName = value;
    } else if (key === 'connect_timeout' && fields.provider === 'postgres') {
      once('connect');
      options.connectTimeoutMs = integer(value, original, 1, 300) * 1000;
    } else if (key === 'connecttimeout' || key === 'connecttimeoutms') {
      once('connect');
      options.connectTimeoutMs = integer(value, original, 1000, 300000);
    } else if (key === 'options' && fields.provider === 'postgres') {
      once('query');
      const match = /^-c\s+statement_timeout=(\d+)(ms|s)?$/.exec(value.trim());
      if (!match)
        throw new ValidationError(
          validationIssue(
            'connection-options-url.postgresqlOptionsCurrentlySupportOnlyCStatementTimeout',
            'PostgreSQL options 目前仅支持 -c statement_timeout=<毫秒>',
          ),
        );
      options.queryTimeoutMs =
        integer(
          match[1],
          'statement_timeout',
          match[2] === 's' ? 1 : 1000,
          match[2] === 's' ? 3600 : 3600000,
        ) * (match[2] === 's' ? 1000 : 1);
    } else if (
      (key === 'commandtimeout' && fields.provider === 'redis') ||
      (key === 'sockettimeoutms' && fields.provider === 'mongodb')
    ) {
      once('query');
      options.queryTimeoutMs = integer(value, original, 1000, 3600000);
    } else if (key === 'maxidletimems' && fields.provider === 'mongodb') {
      once('idle');
      options.idleTimeoutMs = integer(value, original, 1000, 3600000);
    } else if (fields.provider === 'mongodb' && key === 'authsource') {
      fields.mongo!.authSource = validText(value, 'authSource', 128);
    } else if (fields.provider === 'mongodb' && key === 'replicaset') {
      fields.mongo!.replicaSet = validText(value, 'replicaSet', 256);
    } else if (fields.provider === 'mongodb' && key === 'directconnection') {
      fields.mongo!.directConnection = bool(value, original);
    } else if (fields.provider === 'mongodb' && key === 'retrywrites') {
      fields.mongo!.retryWrites = bool(value, original);
    } else if (fields.provider === 'mongodb' && mongoExtraNames[key]) {
      (fields.mongo!.parameters ??= {})[mongoExtraNames[key]] = mongoExtra(key, value);
    } else
      throw new ValidationError(
        validationIssue(
          'connection-options-url.unsupportedUrlParameterAdjustTheParameterExplicitlyBefore',
          '不支持的 {p0} URL 参数：{p1}。请明确调整参数后再应用。',
          { p0: validationValue(fields.provider), p1: validationValue(original) },
        ),
      );
  }
  fields.connectionOptions = publicConnectionOptions(
    fields.provider,
    options,
    fields.provider === 'mongodb' && fields.mongo?.srv === true,
  );
}
/** Parse libpq key/value quoting and backslash escapes without evaluating shell text. */
export function parsePostgresDsn(source: string): Map<string, string> {
  const entries = new Map<string, string>();
  let index = 0;
  while (index < source.length) {
    while (/\s/u.test(source[index] ?? '') && index < source.length) index++;
    if (index >= source.length) break;
    const key = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(source.slice(index))?.[0];
    if (!key)
      throw new ValidationError(
        validationIssue('connection-options-url.invalidDsnParameterName', 'DSN 参数名称无效'),
      );
    index += key.length;
    while (/\s/u.test(source[index] ?? '') && index < source.length) index++;
    if (source[index++] !== '=')
      throw new ValidationError(
        validationIssue(
          'connection-options-url.dsnParameterIsMissingAnEqualsSign',
          'DSN 参数 {p0} 缺少等号',
          { p0: validationValue(key) },
        ),
      );
    while (/\s/u.test(source[index] ?? '') && index < source.length) index++;
    const quoted = source[index] === "'";
    if (quoted) index++;
    let value = '',
      closed = !quoted;
    while (index < source.length) {
      const character = source[index++];
      if (character === '\\') {
        if (index >= source.length)
          throw new ValidationError(
            validationIssue(
              'connection-options-url.incompleteDsnBackslashEscape',
              'DSN 反斜线转义未完成',
            ),
          );
        value += source[index++];
      } else if (quoted && character === "'") {
        closed = true;
        break;
      } else if (!quoted && /\s/u.test(character)) break;
      else value += character;
    }
    if (!closed)
      throw new ValidationError(
        validationIssue('connection-options-url.dsnSingleQuoteIsNotClosed', 'DSN 单引号未闭合'),
      );
    if (quoted && index < source.length && !/\s/u.test(source[index]))
      throw new ValidationError(
        validationIssue(
          'connection-options-url.aSpaceIsRequiredAfterADsnQuote',
          'DSN 引号后须有空格',
        ),
      );
    const normalized = key.toLowerCase();
    if (entries.has(normalized))
      throw new ValidationError(
        validationIssue('connection-options-url.duplicateDsnParameter', 'DSN 参数重复：{p0}', {
          p0: validationValue(key),
        }),
      );
    entries.set(normalized, value);
  }
  return entries;
}
export function parseConnectionSource(
  source: string,
  expectedProvider?: NativeNetworkProvider,
): ParsedConnectionSource {
  const text = source.trim();
  if (!text || text.length > 8192 || /[\r\n\0]/u.test(text))
    throw new ValidationError(
      validationIssue(
        'connection-options-url.connectionUrlDsnMustBeSingleLineText',
        '连接 URL / DSN 须为不超过 8,192 字符的单行文本',
      ),
    );
  const warnings: ValidationIssue[] = [];
  let fields: ConnectionUrlFields, format: 'url' | 'dsn';
  if (!/^(?:jdbc:)?[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text)) {
    if (expectedProvider && expectedProvider !== 'postgres')
      throw new ValidationError(
        validationIssue(
          'connection-options-url.theCurrentNativeConnectorProvidesLibpqDsnOnly',
          '当前原生连接器只为 PostgreSQL 提供 libpq DSN',
        ),
      );
    const entries = parsePostgresDsn(text),
      host = entries.get('host') ?? 'localhost';
    fields = {
      provider: 'postgres',
      host: validHost(host),
      port: integer(
        entries.get('port') ?? '5432',
        validationIssue('connection-options-url.port', '端口'),
        1,
        65535,
      ),
      username: validText(
        entries.get('user') ?? '',
        validationIssue('connection-options-url.username', '用户名'),
        256,
      ),
      password: validText(
        entries.get('password') ?? '',
        validationIssue('connection-options-url.password', '密码'),
        4096,
      ),
      database: validText(
        entries.get('dbname') ?? '',
        validationIssue('connection-options-url.database', '数据库'),
      ),
      connectionOptions: {},
    };
    for (const key of ['host', 'port', 'user', 'password', 'dbname']) entries.delete(key);
    parseParameters(fields, entries, warnings);
    format = 'dsn';
  } else {
    if (/\s/u.test(text))
      throw new ValidationError(
        validationIssue(
          'connection-options-url.pasteTheConnectionUrlItselfCommandLineFlags',
          '请粘贴连接 URL 本身；命令行标志与未转义空格不受支持',
        ),
      );
    const jdbc = text.startsWith('jdbc:'),
      normalized = jdbc ? text.slice(5) : text,
      scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(normalized)?.[1].toLowerCase(),
      provider = scheme ? providers[scheme] : undefined;
    if (!provider || (jdbc && provider !== 'postgres' && provider !== 'mysql'))
      throw new ValidationError(
        validationIssue(
          'connection-options-url.onlyPostgresqlMysqlRedisAndMongodbConnectionUrls',
          '当前仅支持 PostgreSQL、MySQL、Redis 与 MongoDB 连接 URL',
        ),
      );
    if (expectedProvider && provider !== expectedProvider)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.urlTypeDoesNotMatchTheCurrentConnection',
          'URL 的 {p0} 类型与当前 {p1} 连接不一致',
          { p0: validationValue(provider), p1: validationValue(expectedProvider) },
        ),
      );
    const remainder = normalized.slice(normalized.indexOf('://') + 3),
      end = remainder.search(/[/?#]/u),
      authority = end < 0 ? remainder : remainder.slice(0, end),
      tail = end < 0 ? '' : remainder.slice(end),
      at = authority.lastIndexOf('@'),
      credentials = at < 0 ? '' : authority.slice(0, at + 1),
      hostText = at < 0 ? authority : authority.slice(at + 1);
    const hostParts = provider === 'mongodb' ? hostText.split(',') : [hostText];
    if (hostParts.length > 20 || (provider !== 'mongodb' && hostText.includes(',')))
      throw new ValidationError(
        validationIssue(
          'connection-options-url.connectionAddressContainsAnUnsupportedHostList',
          '连接地址包含不支持的主机列表',
        ),
      );
    let first: URL | null = null;
    const hosts = hostParts.map((part) => {
      let url: URL;
      try {
        url = new URL(`${scheme}://${credentials}${part}${tail}`);
      } catch {
        throw new ValidationError(
          validationIssue(
            'connection-options-url.invalidConnectionUrlCheckTheHostIpvBrackets',
            '连接 URL 无效，检查主机、IPv6 括号与端口',
          ),
        );
      }
      first ??= url;
      return {
        host: validHost(decode(url.hostname.replace(/^\[|\]$/g, ''))),
        port: integer(
          url.port || String(ports[provider]),
          validationIssue('connection-options-url.port', '端口'),
          1,
          65535,
        ),
      };
    });
    const url = first!;
    if (url.hash)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.connectionUrlsDoNotSupportFragmentsRemoveSettings',
          '连接 URL 不支持片段标记；请移除 # 后的设置',
        ),
      );
    const database = decode(url.pathname.replace(/^\//, ''));
    if (url.pathname.slice(1).includes('/'))
      throw new ValidationError(
        validationIssue(
          'connection-options-url.theDatabasePathSupportsOnlyOneEscapedName',
          '数据库路径仅支持一个已转义名称',
        ),
      );
    fields = {
      provider,
      host: hosts[0].host,
      port: hosts[0].port,
      username: validText(
        decode(url.username),
        validationIssue('connection-options-url.username', '用户名'),
        256,
      ),
      password: validText(
        decode(url.password),
        validationIssue('connection-options-url.password', '密码'),
        4096,
      ),
      database: validText(
        database || (provider === 'redis' ? '0' : provider === 'mongodb' ? 'admin' : ''),
        validationIssue('connection-options-url.database', '数据库'),
      ),
      connectionOptions: {
        tls: { enabled: scheme === 'rediss' || scheme === 'mongodb+srv' },
      },
    };
    if (provider === 'redis')
      integer(
        fields.database,
        validationIssue('connection-options-url.redisDatabaseIndex', 'Redis 数据库索引'),
        0,
        2147483646,
      );
    if (provider === 'mongodb') {
      const srv = scheme === 'mongodb+srv';
      if (
        srv &&
        (hosts.length !== 1 || /[:\[\]]/.test(hostText) || /^\d+\.\d+\.\d+\.\d+$/.test(hostText))
      )
        throw new ValidationError(
          validationIssue(
            'connection-options-url.mongodbSrvRequiresOneDnsHostWithoutA',
            'MongoDB SRV 需要一个不带端口的 DNS 主机',
          ),
        );
      fields.mongo = { srv, hosts };
      if (hosts.length > 1)
        warnings.push(
          validationIssue(
            'connection-options-url.multiHostMongodbUrlsMustRetainTheHost',
            '多主机 MongoDB URL 必须保留主机列表；不能降为单主机配置',
          ),
        );
    }
    parseParameters(fields, url.searchParams, warnings);
    if (scheme === 'rediss' && fields.connectionOptions.tls?.enabled === false)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.theRedissProtocolConflictsWithTheDisabledTls',
          'rediss 协议与关闭 TLS 的选项冲突',
        ),
      );
    if (fields.mongo?.srv && fields.mongo.directConnection)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.mongodbSrvDoesNotSupportDirectconnectionTrue',
          'MongoDB SRV 不支持 directConnection=true',
        ),
      );
    if (fields.mongo && fields.mongo.hosts.length > 1 && fields.mongo.directConnection)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.multiHostMongodbUrlsDoNotSupportDirectconnection',
          '多主机 MongoDB URL 不支持 directConnection=true',
        ),
      );
    format = 'url';
  }
  return { fields, format, warnings, containsPassword: !!fields.password };
}
function quotedDsn(value: string) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}
/** The default copy omits passwords. Inclusion is a separate, explicit caller choice. */
export function buildConnectionSource(
  fields: ConnectionUrlFields,
  format: 'url' | 'dsn' = 'url',
  includePassword = false,
): BuiltConnectionSource {
  if (fields.provider === 'mongodb') validateMongoOptions(fields.mongo);
  const options = resolveConnectionOptions(fields.provider, fields.connectionOptions, false, false),
    defaults = defaultConnectionOptions(fields.provider),
    warnings: ValidationIssue[] = [],
    host = validHost(fields.host),
    port = integer(
      String(fields.port),
      validationIssue('connection-options-url.port', '端口'),
      1,
      65535,
    ),
    user = validText(
      fields.username,
      validationIssue('connection-options-url.username', '用户名'),
      256,
    ),
    database = validText(
      fields.database,
      validationIssue('connection-options-url.database', '数据库'),
    ),
    password = includePassword
      ? validText(fields.password, validationIssue('connection-options-url.password', '密码'), 4096)
      : '';
  if (
    options.tls.caRequired ||
    options.tls.clientCertificateRequired ||
    options.tls.caPem ||
    options.tls.certificatePem ||
    options.tls.privateKeyPem
  )
    warnings.push(
      validationIssue(
        'connection-options-url.urlDsnDoesNotIncludeCertificateContentsRequired',
        'URL / DSN 不包含证书内容；建立连接时仍需提供所需文件',
      ),
    );
  if (options.tls.serverName)
    warnings.push(
      validationIssue(
        'connection-options-url.customTlsServerNamesAreKeptOnlyIn',
        '自定义 TLS 服务器名称仅保留在高级连接设置中',
      ),
    );
  if (options.tls.enabled && options.tls.minVersion !== defaults.tls.minVersion)
    warnings.push(
      validationIssue(
        'connection-options-url.theMinimumTlsVersionIsKeptOnlyIn',
        '最低 TLS 版本仅保留在高级连接设置中，URL / DSN 无法表达该限制',
      ),
    );
  if (fields.provider === 'redis')
    integer(
      database || '0',
      validationIssue('connection-options-url.redisDatabaseIndex', 'Redis 数据库索引'),
      0,
      2147483646,
    );
  if (format === 'dsn') {
    if (fields.provider !== 'postgres')
      throw new ValidationError(
        validationIssue(
          'connection-options-url.libpqDsnAppliesOnlyToPostgresql',
          'libpq DSN 只适用于 PostgreSQL',
        ),
      );
    const parts = [`host=${quotedDsn(host)}`, `port=${port}`];
    if (user) parts.push(`user=${quotedDsn(user)}`);
    if (password) parts.push(`password=${quotedDsn(password)}`);
    if (database) parts.push(`dbname=${quotedDsn(database)}`);
    if (options.connectTimeoutMs % 1000)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.libpqConnectTimeoutCanExpressOnlyWholeSecond',
          'libpq connect_timeout 只能表达整秒连接超时',
        ),
      );
    parts.push(
      `connect_timeout=${options.connectTimeoutMs / 1000}`,
      `sslmode=${options.tls.enabled ? 'verify-full' : 'disable'}`,
      `options=${quotedDsn(`-c statement_timeout=${options.queryTimeoutMs}`)}`,
    );
    if (options.idleTimeoutMs !== defaults.idleTimeoutMs)
      warnings.push(
        validationIssue(
          'connection-options-url.connectionPoolIdleTimeoutIsNotIncludedIn',
          '连接池空闲回收超时不包含在 libpq DSN 中',
        ),
      );
    return { text: parts.join(' '), warnings, containsPassword: !!password };
  }
  let scheme: string =
    fields.provider === 'postgres'
      ? 'postgresql'
      : fields.provider === 'redis' && options.tls.enabled
        ? 'rediss'
        : fields.provider;
  const params = new URLSearchParams();
  if (fields.provider === 'postgres') {
    if (options.connectTimeoutMs % 1000)
      throw new ValidationError(
        validationIssue(
          'connection-options-url.postgresqlUrlConnectTimeoutCanExpressOnlyWhole',
          'PostgreSQL URL connect_timeout 只能表达整秒连接超时',
        ),
      );
    params.set('connect_timeout', String(options.connectTimeoutMs / 1000));
    params.set('sslmode', options.tls.enabled ? 'verify-full' : 'disable');
    params.set('options', `-c statement_timeout=${options.queryTimeoutMs}`);
  } else if (fields.provider === 'mysql') {
    params.set('connectTimeout', String(options.connectTimeoutMs));
    params.set('sslMode', options.tls.enabled ? 'VERIFY_IDENTITY' : 'DISABLED');
    if (options.queryTimeoutMs !== defaults.queryTimeoutMs)
      warnings.push(
        validationIssue(
          'connection-options-url.mysqlQueryDeadlinesAreKeptOnlyInAdvanced',
          'MySQL 查询截止时间仅保留在高级连接设置中',
        ),
      );
  } else if (fields.provider === 'redis') {
    params.set('connectTimeout', String(options.connectTimeoutMs));
    params.set('commandTimeout', String(options.queryTimeoutMs));
  } else {
    if (fields.mongo?.srv) scheme = 'mongodb+srv';
    params.set('tls', String(options.tls.enabled));
    params.set('connectTimeoutMS', String(options.connectTimeoutMs));
    params.set('socketTimeoutMS', String(options.queryTimeoutMs));
    params.set('maxIdleTimeMS', String(options.idleTimeoutMs));
    if (fields.mongo?.authSource) params.set('authSource', fields.mongo.authSource);
    if (fields.mongo?.replicaSet) params.set('replicaSet', fields.mongo.replicaSet);
    if (fields.mongo?.directConnection !== undefined)
      params.set('directConnection', String(fields.mongo.directConnection));
    if (fields.mongo?.retryWrites !== undefined)
      params.set('retryWrites', String(fields.mongo.retryWrites));
    for (const [key, value] of Object.entries(fields.mongo?.parameters ?? {}))
      params.set(mongoExtraNames[key.toLowerCase()], mongoExtra(key, value));
  }
  if (fields.provider !== 'mongodb' && options.idleTimeoutMs !== defaults.idleTimeoutMs)
    warnings.push(
      validationIssue(
        'connection-options-url.connectionPoolIdleTimeoutIsKeptOnlyIn',
        '连接池空闲回收超时仅保留在高级连接设置中',
      ),
    );
  const authority = (entry: ConnectionUrlHost, srv = false) => {
    const address = entry.host.includes(':') ? `[${validHost(entry.host)}]` : validHost(entry.host);
    return srv
      ? address
      : `${address}:${integer(String(entry.port), validationIssue('connection-options-url.port', '端口'), 1, 65535)}`;
  };
  const hosts =
    fields.provider === 'mongodb' ? (fields.mongo?.hosts ?? [{ host, port }]) : [{ host, port }];
  if (!hosts.length || hosts.length > 20)
    throw new ValidationError(
      validationIssue(
        'connection-options-url.mongodbHostListsMustContainEntries',
        'MongoDB 主机列表须为 1–20 项',
      ),
    );
  if (
    fields.mongo?.srv &&
    (hosts.length !== 1 ||
      hosts[0].host.includes(':') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hosts[0].host))
  )
    throw new ValidationError(
      validationIssue(
        'connection-options-url.mongodbSrvRequiresASingleDnsHost',
        'MongoDB SRV 需要单个 DNS 主机',
      ),
    );
  if (fields.mongo?.directConnection && (fields.mongo.srv || hosts.length > 1))
    throw new ValidationError(
      validationIssue(
        'connection-options-url.directconnectionTrueAppliesOnlyToSingleHostMongodb',
        'directConnection=true 仅适用于单主机 MongoDB URL',
      ),
    );
  const credentials =
    user || password
      ? `${encodeURIComponent(user)}${password ? `:${encodeURIComponent(password)}` : ''}@`
      : '';
  return {
    text: `${scheme}://${credentials}${hosts.map((entry) => authority(entry, !!fields.mongo?.srv)).join(',')}/${encodeURIComponent(database)}?${params}`,
    warnings,
    containsPassword: !!password,
  };
}
