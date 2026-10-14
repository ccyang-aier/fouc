import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  jsonPathsMustContainCharacters: [
    'JSON 路径不能为空，最多 1024 字符',
    'JSON paths must contain 1–1,024 characters',
  ],
  pathsSupportFieldIndexOrFieldWildcardsAreNotSupported: [
    '路径支持 $.字段、[索引] 或 ["字段"]，不支持通配符',
    'Paths support $.field, [index] or ["field"]; wildcards are not supported',
  ],
  useANonNegativeIndexOrAJsonDoubleQuoted: [
    '方括号中请使用非负索引或 JSON 双引号字段名',
    'Use a non-negative index or a JSON double-quoted field name in brackets',
  ],
  theJsonArrayIndexExceedsTheSafeRange: [
    'JSON 数组索引超出安全范围',
    'The JSON array index exceeds the safe range',
  ],
  invalidJsonPathSyntax: ['JSON 路径语法无效', 'Invalid JSON path syntax'],
  jsonPathsSupportUpToLevels: ['JSON 路径最多 32 层', 'JSON paths support up to 32 levels'],
  invalidFormattingSettings: ['格式设置无效', 'Invalid formatting settings'],
  selectATimeUnit: ['请选择时间单位', 'Select a time unit'],
  selectAValidTimeZone: ['请选择有效时区', 'Select a valid time zone'],
  dateFormatsSupportYyyyMmDdHhMmSsSss: [
    '日期格式支持 YYYY、MM、DD、HH、mm、ss、SSS、Z 及 [字面文本]',
    'Date formats support YYYY, MM, DD, HH, mm, ss, SSS, Z and [literal text]',
  ],
  enterAJsonPath: ['请填写 JSON 路径', 'Enter a JSON path'],
  theNumberOfVisibleCharactersMustBeAnIntegerFrom: [
    '保留字符数须为 0–1000 的整数',
    'The number of visible characters must be an integer from 0 to 1,000',
  ],
  templatesSupportUpToCharacters: [
    '模板最多 4096 字符',
    'Templates support up to 4,096 characters',
  ],
  templatesSupportOnlyAnd: [
    '模板仅支持 ${{value}}、${{upper}}、${{lower}}、${{length}}',
    'Templates support only ${{value}}, ${{upper}}, ${{lower}} and ${{length}}',
  ],
  unsupportedDisplayFormat: ['不支持的显示格式', 'Unsupported display format'],
  timestampsMustBeExactIntegers: ['时间戳须为精确整数', 'Timestamps must be exact integers'],
  automaticTimestampsRecognizeDigitSecondsOrDigitMillisecondsOnlySpecify: [
    '自动时间戳仅识别 10 位秒或 13 位毫秒，请明确单位',
    'Automatic timestamps recognize 10-digit seconds or 13-digit milliseconds only. Specify the unit',
  ],
  timestampIsOutsideTheSupportedDateRange: [
    '时间戳超出日期范围',
    'Timestamp is outside the supported date range',
  ],
  supportsIsoDatesWithTimeZonesDatesOrIntegerTimestamps: [
    '支持带时区的 ISO 日期、日期或整数时间戳；无时区时间保持原值',
    'Supports ISO dates with time zones, dates or integer timestamps; times without a zone retain their original value',
  ],
  theDateDoesNotExist: ['日期不存在', 'The date does not exist'],
  invalidDateOrTimeZoneOffset: ['日期或时区偏移无效', 'Invalid date or time zone offset'],
  jsonExceedsMbShowingTheOriginalValue: [
    'JSON 超过 1 MB，显示原值',
    'JSON exceeds 1 MB; showing the original value',
  ],
  cannotDisplayThisFormat: ['无法显示此格式', 'Cannot display this format'],
});
