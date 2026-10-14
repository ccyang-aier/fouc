import { type Locale, createTranslator, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './registry.messages';
import type { RelationalProvider } from '@fouc/shared';
import { functionDescriptions } from './descriptions';
/** DBX sqlCompletion.ts's native signatures, scoped to Fouc's actual three providers. */
const COMMON_FUNCTION_SIGNATURES = new Map<string, readonly string[]>([
  ['COUNT', ['expression']],
  ['SUM', ['expression']],
  ['AVG', ['expression']],
  ['MIN', ['expression']],
  ['MAX', ['expression']],
  ['CONCAT', ['value', '...values']],
  ['SUBSTRING', ['string', 'start', 'length']],
  ['SUBSTR', ['string', 'start', 'length']],
  ['REPLACE', ['string', 'old', 'new']],
  ['TRIM', ['string']],
  ['LTRIM', ['string']],
  ['RTRIM', ['string']],
  ['UPPER', ['string']],
  ['LOWER', ['string']],
  ['LENGTH', ['string']],
  ['EXTRACT', ['unit', 'date']],
  ['ROUND', ['number', 'decimals']],
  ['FLOOR', ['number']],
  ['CEIL', ['number']],
  ['CEILING', ['number']],
  ['ABS', ['number']],
  ['MOD', ['dividend', 'divisor']],
  ['POWER', ['base', 'exponent']],
  ['SQRT', ['number']],
  ['SIGN', ['number']],
  ['COALESCE', ['value', '...values']],
  ['NULLIF', ['expression1', 'expression2']],
  ['CAST', ['expression', 'type']],
  ['GREATEST', ['...values']],
  ['LEAST', ['...values']],
]);
const MYSQL_FUNCTION_SIGNATURES = new Map<string, readonly string[]>([
  ['CONVERT', ['expression', 'type']],
  ['DATE_FORMAT', ['date', 'format']],
  ['FROM_UNIXTIME', ['unix_timestamp']],
  ['DATE', ['expression']],
  ['TIME', ['expression']],
  ['DATE_ADD', ['date', 'INTERVAL expr unit']],
  ['DATE_SUB', ['date', 'INTERVAL expr unit']],
  ['DATEDIFF', ['date1', 'date2']],
  ['TIMESTAMPDIFF', ['unit', 'datetime_expr1', 'datetime_expr2']],
  ['YEAR', ['date']],
  ['MONTH', ['date']],
  ['DAY', ['date']],
  ['HOUR', ['datetime']],
  ['MINUTE', ['datetime']],
  ['SECOND', ['datetime']],
  ['DAYOFWEEK', ['date']],
  ['DAYOFYEAR', ['date']],
  ['LAST_DAY', ['date']],
  ['STR_TO_DATE', ['string', 'format']],
  ['MONTHNAME', ['date']],
  ['DAYOFMONTH', ['date']],
  ['WEEKDAY', ['date']],
  ['WEEK', ['date', 'mode']],
  ['QUARTER', ['date']],
  ['ADDDATE', ['date', 'days']],
  ['SUBDATE', ['date', 'days']],
  ['ADDTIME', ['datetime', 'time']],
  ['SUBTIME', ['datetime', 'time']],
  ['TIMEDIFF', ['datetime1', 'datetime2']],
  ['FROM_DAYS', ['day_number']],
  ['TO_DAYS', ['date']],
  ['MAKEDATE', ['year', 'day_of_year']],
  ['MAKETIME', ['hour', 'minute', 'second']],
  ['IFNULL', ['expression', 'fallback']],
  ['IF', ['condition', 'true_value', 'false_value']],
  ['CONCAT_WS', ['separator', '...values']],
  ['LEFT', ['string', 'length']],
  ['RIGHT', ['string', 'length']],
  ['SUBSTRING_INDEX', ['string', 'delimiter', 'count']],
  ['CHAR_LENGTH', ['string']],
  ['INSTR', ['string', 'substring']],
  ['LOCATE', ['substring', 'string']],
  ['LPAD', ['string', 'length', 'pad']],
  ['RPAD', ['string', 'length', 'pad']],
  ['REVERSE', ['string']],
  ['POSITION', ['substring', 'string']],
  ['REPEAT', ['string', 'count']],
  ['STRCMP', ['string1', 'string2']],
  ['FIND_IN_SET', ['string', 'string_list']],
  ['ELT', ['index', 'string1', '...strings']],
  ['FIELD', ['value', 'value1', '...values']],
  ['MAKE_SET', ['bits', 'string1', '...strings']],
  ['POW', ['base', 'exponent']],
  ['EXP', ['number']],
  ['LN', ['number']],
  ['LOG', ['base', 'number']],
  ['LOG10', ['number']],
  ['LOG2', ['number']],
  ['SIN', ['number']],
  ['COS', ['number']],
  ['TAN', ['number']],
  ['ASIN', ['number']],
  ['ACOS', ['number']],
  ['ATAN', ['number']],
  ['ATAN2', ['y', 'x']],
  ['DEGREES', ['radians']],
  ['RADIANS', ['degrees']],
  ['BIN', ['number']],
  ['HEX', ['value']],
  ['UNHEX', ['string']],
  ['OCT', ['number']],
  ['CONV', ['number', 'from_base', 'to_base']],
  ['TRUNCATE', ['number', 'decimals']],
  ['MD5', ['string']],
  ['SHA1', ['string']],
  ['SHA2', ['string', 'bit_length']],
  ['JSON_EXTRACT', ['json', 'path']],
  ['JSON_UNQUOTE', ['json']],
  ['JSON_OBJECT', ['key', 'value', '...pairs']],
  ['JSON_ARRAY', ['...values']],
  ['JSON_SET', ['json', 'path', 'value', '...path_value_pairs']],
  ['JSON_INSERT', ['json', 'path', 'value', '...path_value_pairs']],
  ['JSON_REPLACE', ['json', 'path', 'value', '...path_value_pairs']],
  ['JSON_REMOVE', ['json', 'path', '...paths']],
  ['JSON_CONTAINS', ['target', 'candidate']],
  ['JSON_LENGTH', ['json']],
  ['GROUP_CONCAT', ['expression']],
  ['COLLATION', ['string']],
  ['BENCHMARK', ['count', 'expression']],
  ['SLEEP', ['seconds']],
  ['SPACE', ['count']],
  ['FORMAT', ['number', 'decimals']],
  ['REGEXP_REPLACE', ['string', 'pattern', 'replacement']],
  ['REGEXP_SUBSTR', ['string', 'pattern']],
  ['JSON_VALUE', ['json', 'path']],
  ['JSON_KEYS', ['json']],
  ['JSON_TYPE', ['json']],
  ['JSON_PRETTY', ['json']],
  ['JSON_VALID', ['json']],
  ['JSON_ARRAYAGG', ['expression']],
  ['JSON_OBJECTAGG', ['key', 'value']],
  ['UNIX_TIMESTAMP', []],
  ['VERSION', []],
  ['SYSDATE', []],
  ['CURRENT_DATE', []],
  ['CURRENT_TIME', []],
  ['CURRENT_TIMESTAMP', []],
  ['CURDATE', []],
  ['CURTIME', []],
  ['LOCALTIME', []],
  ['LOCALTIMESTAMP', []],
  ['UTC_DATE', []],
  ['UTC_TIME', []],
  ['UTC_TIMESTAMP', []],
  ['RAND', []],
  ['PI', []],
  ['DATABASE', []],
  ['SCHEMA', []],
  ['USER', []],
  ['CURRENT_USER', []],
  ['FOUND_ROWS', []],
  ['LAST_INSERT_ID', []],
  ['UUID', []],
  ['UUID_SHORT', []],
  ['NOW', []],
]);
const POSTGRES_FUNCTION_SIGNATURES = new Map<string, readonly string[]>([
  ['JSONB_BUILD_OBJECT', ['key', 'value', '...pairs']],
  ['JSONB_AGG', ['expression']],
  ['TO_JSONB', ['value']],
  ['JSONB_SET', ['target', 'path', 'new_value']],
  ['ARRAY_AGG', ['expression']],
  ['STRING_AGG', ['expression', 'delimiter']],
  ['CONCAT_WS', ['separator', '...values']],
  ['LPAD', ['string', 'length', 'pad']],
  ['RPAD', ['string', 'length', 'pad']],
  ['REVERSE', ['string']],
  ['REPEAT', ['string', 'count']],
  ['REGEXP_REPLACE', ['string', 'pattern', 'replacement']],
  ['REGEXP_SUBSTR', ['string', 'pattern']],
  ['SPLIT_PART', ['string', 'delimiter', 'part']],
  ['MD5', ['string']],
  ['GEN_RANDOM_UUID', []],
  ['NOW', []],
]);
const SQLITE_FUNCTION_SIGNATURES = new Map<string, readonly string[]>([
  ['JSON_EXTRACT', ['json', 'path']],
  ['JSON_SET', ['json', 'path', 'value']],
  ['STRFTIME', ['format', 'time']],
  ['IFNULL', ['expression', 'fallback']],
  ['CONCAT_WS', ['separator', 'value', '...values']],
  ['GROUP_CONCAT', ['expression', 'separator']],
  ['STRING_AGG', ['expression', 'separator']],
  ['TOTAL', ['expression']],
  ['FORMAT', ['format', '...values']],
  ['PRINTF', ['format', '...values']],
  ['IIF', ['condition', 'true_value', 'false_value']],
  ['INSTR', ['string', 'substring']],
  ['HEX', ['value']],
  ['UNHEX', ['string']],
  ['OCTET_LENGTH', ['value']],
  ['QUOTE', ['value']],
  ['TYPEOF', ['value']],
  ['UNICODE', ['string']],
  ['CHAR', ['codepoint', '...codepoints']],
  ['RANDOM', []],
  ['RANDOMBLOB', ['length']],
  ['ZEROBLOB', ['length']],
  ['LIKELY', ['expression']],
  ['UNLIKELY', ['expression']],
  ['LIKELIHOOD', ['expression', 'probability']],
  ['SQLITE_VERSION', []],
  ['DATE', ['time_value', '...modifiers']],
  ['TIME', ['time_value', '...modifiers']],
  ['DATETIME', ['time_value', '...modifiers']],
  ['JULIANDAY', ['time_value', '...modifiers']],
  ['UNIXEPOCH', ['time_value', '...modifiers']],
  ['TIMEDIFF', ['time_value1', 'time_value2']],
  ['JSON', ['value']],
  ['JSONB', ['value']],
  ['JSON_ARRAY', ['...values']],
  ['JSON_OBJECT', ['key', 'value', '...pairs']],
  ['JSON_INSERT', ['json', 'path', 'value']],
  ['JSON_REPLACE', ['json', 'path', 'value']],
  ['JSON_REMOVE', ['json', 'path']],
  ['JSON_PATCH', ['target', 'patch']],
  ['JSON_TYPE', ['json', 'path']],
  ['JSON_VALID', ['json']],
  ['JSON_ARRAY_LENGTH', ['json', 'path']],
  ['JSON_QUOTE', ['value']],
  ['JSON_GROUP_ARRAY', ['expression']],
  ['JSON_GROUP_OBJECT', ['key', 'value']],
]);
const WINDOW_FUNCTION_SIGNATURES = new Map<string, readonly string[]>([
  ['ROW_NUMBER', []],
  ['RANK', []],
  ['DENSE_RANK', []],
  ['LAG', ['expression', 'offset', 'default_value']],
  ['LEAD', ['expression', 'offset', 'default_value']],
  ['FIRST_VALUE', ['expression']],
  ['LAST_VALUE', ['expression']],
  ['NTILE', ['buckets']],
]);
export type SqlFunctionCategory =
  'aggregate' | 'string' | 'date' | 'numeric' | 'conditional' | 'json' | 'system' | 'window';
export type SqlFunctionDefinition = {
  name: string;
  parameters: readonly string[];
  kind: 'builtin' | 'window';
  category: SqlFunctionCategory;
  description: string;
  documentation: string;
  parameterSeparator: ', ' | ' AS ' | ' FROM ' | ' IN ';
};
const aggregateNames = new Set([
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'GROUP_CONCAT',
  'STRING_AGG',
  'ARRAY_AGG',
  'TOTAL',
  'JSON_ARRAYAGG',
  'JSON_OBJECTAGG',
  'JSONB_AGG',
  'JSON_GROUP_ARRAY',
  'JSON_GROUP_OBJECT',
]);
const dateNames = new Set([
  'DATE_FORMAT',
  'FROM_UNIXTIME',
  'UNIX_TIMESTAMP',
  'SYSDATE',
  'CURRENT_DATE',
  'CURRENT_TIME',
  'CURRENT_TIMESTAMP',
  'CURDATE',
  'CURTIME',
  'LOCALTIME',
  'LOCALTIMESTAMP',
  'UTC_DATE',
  'UTC_TIME',
  'UTC_TIMESTAMP',
  'DATE',
  'TIME',
  'DATETIME',
  'DATE_ADD',
  'DATE_SUB',
  'DATEDIFF',
  'TIMESTAMPDIFF',
  'YEAR',
  'MONTH',
  'DAY',
  'HOUR',
  'MINUTE',
  'SECOND',
  'DAYOFWEEK',
  'DAYOFYEAR',
  'LAST_DAY',
  'STR_TO_DATE',
  'MONTHNAME',
  'DAYOFMONTH',
  'WEEKDAY',
  'WEEK',
  'QUARTER',
  'ADDDATE',
  'SUBDATE',
  'ADDTIME',
  'SUBTIME',
  'TIMEDIFF',
  'FROM_DAYS',
  'TO_DAYS',
  'MAKEDATE',
  'MAKETIME',
  'NOW',
  'STRFTIME',
  'EXTRACT',
  'JULIANDAY',
  'UNIXEPOCH',
]);
const numericNames = new Set([
  'ROUND',
  'FLOOR',
  'CEIL',
  'CEILING',
  'ABS',
  'MOD',
  'POWER',
  'POW',
  'SQRT',
  'SIGN',
  'TRUNCATE',
  'RAND',
  'EXP',
  'LN',
  'LOG',
  'LOG10',
  'LOG2',
  'SIN',
  'PI',
  'COS',
  'TAN',
  'ASIN',
  'ACOS',
  'ATAN',
  'ATAN2',
  'DEGREES',
  'RADIANS',
  'RANDOM',
]);
const conditionalNames = new Set([
  'COALESCE',
  'IFNULL',
  'IF',
  'IIF',
  'NULLIF',
  'CAST',
  'CONVERT',
  'GREATEST',
  'LEAST',
  'LIKELY',
  'UNLIKELY',
  'LIKELIHOOD',
]);
const systemNames = new Set([
  'VERSION',
  'SQLITE_VERSION',
  'DATABASE',
  'SCHEMA',
  'USER',
  'CURRENT_USER',
  'FOUND_ROWS',
  'LAST_INSERT_ID',
  'BENCHMARK',
  'SLEEP',
  'UUID',
  'UUID_SHORT',
  'GEN_RANDOM_UUID',
  'COLLATION',
]);
const providerSignatures = {
  mysql: MYSQL_FUNCTION_SIGNATURES,
  postgres: POSTGRES_FUNCTION_SIGNATURES,
  sqlite: SQLITE_FUNCTION_SIGNATURES,
};
const registries = new Map<string, ReadonlyMap<string, SqlFunctionDefinition>>();
const emptyRegistry: ReadonlyMap<string, SqlFunctionDefinition> = new Map();
const sqliteUnsupportedCommon = new Set(['EXTRACT', 'GREATEST', 'LEAST']);
// DBX preserves keywords which also have a distinct statement/join role.
const dualRoleKeywords = new Set([
  'LEFT',
  'RIGHT',
  'IF',
  'TRUNCATE',
  'REPEAT',
  'DATABASE',
  'SCHEMA',
  'USER',
  'CURRENT_USER',
]);
export function sqlFunctionReplacesKeyword(
  label: string,
  provider: RelationalProvider,
  locale?: Locale,
): boolean {
  const name = label.toUpperCase();
  return !dualRoleKeywords.has(name) && sqlFunctionRegistry(provider, locale).has(name);
}
export const FUNCTION_CATEGORY_LABELS = (locale?: Locale): Record<SqlFunctionCategory, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    aggregate: tConnector('aggregate'),
    string: tConnector('string'),
    date: tConnector('dateAndTime'),
    numeric: tConnector('numeric'),
    conditional: tConnector('conditionsAndConversions'),
    json: 'JSON',
    system: tConnector('system'),
    window: tConnector('window'),
  };
};
function category(name: string): SqlFunctionCategory {
  if (WINDOW_FUNCTION_SIGNATURES.has(name)) return 'window';
  if (aggregateNames.has(name)) return 'aggregate';
  if (name.startsWith('JSON') || name === 'TO_JSONB') return 'json';
  if (dateNames.has(name)) return 'date';
  if (numericNames.has(name)) return 'numeric';
  if (conditionalNames.has(name)) return 'conditional';
  if (systemNames.has(name)) return 'system';
  return 'string';
}
function documentation(provider: RelationalProvider, kind: SqlFunctionCategory): string {
  if (provider === 'mysql') {
    const pages: Record<SqlFunctionCategory, string> = {
      aggregate: 'aggregate-functions',
      string: 'string-functions',
      date: 'date-and-time-functions',
      numeric: 'mathematical-functions',
      conditional: 'flow-control-functions',
      json: 'json-functions',
      system: 'information-functions',
      window: 'window-function-descriptions',
    };
    return `https://dev.mysql.com/doc/refman/8.4/en/${pages[kind]}.html`;
  }
  if (provider === 'postgres') {
    const pages: Record<SqlFunctionCategory, string> = {
      aggregate: 'functions-aggregate',
      string: 'functions-string',
      date: 'functions-datetime',
      numeric: 'functions-math',
      conditional: 'functions-conditional',
      json: 'functions-json',
      system: 'functions-info',
      window: 'functions-window',
    };
    return `https://www.postgresql.org/docs/current/${pages[kind]}.html`;
  }
  const pages: Record<SqlFunctionCategory, string> = {
    aggregate: 'lang_aggfunc.html',
    string: 'lang_corefunc.html',
    date: 'lang_datefunc.html',
    numeric: 'lang_mathfunc.html',
    conditional: 'lang_corefunc.html',
    json: 'json1.html',
    system: 'lang_corefunc.html',
    window: 'windowfunctions.html',
  };
  return `https://www.sqlite.org/${pages[kind]}`;
}
/** Registry entries drive insertion, signature help and documentation; no driver guesses. */
export function sqlFunctionRegistry(
  provider: RelationalProvider,
  locale: Locale = getLocale(),
): ReadonlyMap<string, SqlFunctionDefinition> {
  if (!Object.hasOwn(providerSignatures, provider)) return emptyRegistry;
  const registryKey = `${provider}:${locale}`;
  const cached = registries.get(registryKey);
  if (cached) return cached;
  const signatures = new Map(
    [...COMMON_FUNCTION_SIGNATURES].filter(
      ([name]) => provider !== 'sqlite' || !sqliteUnsupportedCommon.has(name),
    ),
  );
  for (const [name, parameters] of providerSignatures[provider]) signatures.set(name, parameters);
  for (const [name, parameters] of WINDOW_FUNCTION_SIGNATURES) signatures.set(name, parameters);
  const result = new Map<string, SqlFunctionDefinition>();
  const descriptions = functionDescriptions(locale);
  for (const [name, parameters] of signatures) {
    const group = category(name);
    result.set(name, {
      name,
      parameters,
      kind: group === 'window' ? 'window' : 'builtin',
      category: group,
      description: descriptions.get(name)!,
      documentation: documentation(provider, group),
      parameterSeparator:
        name === 'CAST'
          ? ' AS '
          : name === 'EXTRACT'
            ? ' FROM '
            : name === 'POSITION'
              ? ' IN '
              : ', ',
    });
  }
  registries.set(registryKey, result);
  return result;
}
