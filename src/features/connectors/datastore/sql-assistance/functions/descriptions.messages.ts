import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  extractsASubstringFromASpecifiedPosition: [
    '从指定位置提取字符串片段。',
    'Extracts a substring from a specified position.',
  ],
  removesLeadingSpacesOrSpecifiedCharactersFromAString: [
    '移除字符串开头的空格或指定字符。',
    'Removes leading spaces or specified characters from a string.',
  ],
  removesTrailingSpacesOrSpecifiedCharactersFromAString: [
    '移除字符串结尾的空格或指定字符。',
    'Removes trailing spaces or specified characters from a string.',
  ],
  roundsTowardPositiveInfinity: ['向正无穷方向取整。', 'Rounds toward positive infinity.'],
  raisesTheBaseToTheSpecifiedPower: [
    '计算底数的指定次幂。',
    'Raises the base to the specified power.',
  ],
  calculatesTheSquareRoot: ['计算平方根。', 'Calculates the square root.'],
  returnsTheSignOfANumberForNegativeForZero: [
    '返回数值的符号：负数 -1、零 0、正数 1。',
    'Returns the sign of a number: -1 for negative, 0 for zero, and 1 for positive.',
  ],
  returnsTheGreatestArgumentValue: ['返回参数中的最大值。', 'Returns the greatest argument value.'],
  returnsTheLeastArgumentValue: ['返回参数中的最小值。', 'Returns the least argument value.'],
  convertsAnExpressionToTheSpecifiedDataType: [
    '将表达式转换为指定数据类型。',
    'Converts an expression to the specified data type.',
  ],
  convertsAUnixTimestampToADateAndTime: [
    '将 Unix 时间戳转换为日期时间。',
    'Converts a Unix timestamp to a date and time.',
  ],
  returnsTheMonthNameOfADate: ['返回日期的月份名称。', 'Returns the month name of a date.'],
  returnsTheDayOfTheMonthForADate: [
    '返回日期在月份中的日序号。',
    'Returns the day of the month for a date.',
  ],
  returnsTheWeekdayIndexMondayIsAndSundayIs: [
    '返回星期索引：星期一为 0，星期日为 6。',
    'Returns the weekday index: Monday is 0 and Sunday is 6.',
  ],
  returnsTheWeekNumberUsingTheSpecifiedWeekNumberingMode: [
    '按指定周编号模式返回日期的周序号。',
    'Returns the week number using the specified week numbering mode.',
  ],
  returnsTheQuarterNumberOfADate: ['返回日期的季度序号。', 'Returns the quarter number of a date.'],
  addsTheSpecifiedNumberOfDaysToADate: [
    '为日期增加指定天数。',
    'Adds the specified number of days to a date.',
  ],
  subtractsTheSpecifiedNumberOfDaysFromADate: [
    '从日期减去指定天数。',
    'Subtracts the specified number of days from a date.',
  ],
  addsAnIntervalToATimeOrDatetime: [
    '为时间或日期时间增加时间间隔。',
    'Adds an interval to a time or datetime.',
  ],
  subtractsAnIntervalFromATimeOrDatetime: [
    '从时间或日期时间减去时间间隔。',
    'Subtracts an interval from a time or datetime.',
  ],
  returnsTheDifferenceBetweenTwoTimeValues: [
    '返回两个时间值之间的差值。',
    'Returns the difference between two time values.',
  ],
  convertsADayNumberToADate: ['将日序号转换为日期。', 'Converts a day number to a date.'],
  convertsADateToADayNumber: ['将日期转换为日序号。', 'Converts a date to a day number.'],
  constructsADateFromAYearAndDayOfYear: [
    '按年份和年内日序号构造日期。',
    'Constructs a date from a year and day of year.',
  ],
  constructsATimeFromHoursMinutesAndSeconds: [
    '按小时、分钟、秒构造时间。',
    'Constructs a time from hours, minutes, and seconds.',
  ],
  reversesTheCharacterOrderInAString: [
    '反转字符串中的字符顺序。',
    'Reverses the character order in a string.',
  ],
  returnsThePositionOfTheFirstOccurrenceOfASubstring: [
    '返回子串首次出现的位置。',
    'Returns the position of the first occurrence of a substring.',
  ],
  repeatsAStringTheSpecifiedNumberOfTimes: [
    '按指定次数重复字符串。',
    'Repeats a string the specified number of times.',
  ],
  comparesTwoStringsAndReturnsOr: [
    '比较两个字符串，返回 -1、0 或 1。',
    'Compares two strings and returns -1, 0, or 1.',
  ],
  returnsAStringFromTheArgumentListByIndex: [
    '按索引返回参数列表中的字符串。',
    'Returns a string from the argument list by index.',
  ],
  returnsThePositionOfAValueInTheArgumentList: [
    '返回值在参数列表中的位置，找不到时返回 0。',
    'Returns the position of a value in the argument list, or 0 if not found.',
  ],
  selectsStringsUsingABitMaskAndConcatenatesThemAs: [
    '按照位掩码选择字符串并拼接为集合。',
    'Selects strings using a bit mask and concatenates them as a set.',
  ],
  raisesTheNaturalConstantEToTheSpecifiedPower: [
    '计算自然常数 e 的指定次幂。',
    'Raises the natural constant e to the specified power.',
  ],
  calculatesTheNaturalLogarithm: ['计算自然对数。', 'Calculates the natural logarithm.'],
  calculatesALogarithmWithTheSpecifiedBase: [
    '计算指定底数的对数。',
    'Calculates a logarithm with the specified base.',
  ],
  calculatesTheBaseLogarithm: ['计算以 10 为底的对数。', 'Calculates the base-10 logarithm.'],
  calculatesTheBaseLogarithm2549: ['计算以 2 为底的对数。', 'Calculates the base-2 logarithm.'],
  calculatesTheSineOfAnAngleInRadians: [
    '计算弧度角的正弦。',
    'Calculates the sine of an angle in radians.',
  ],
  calculatesTheCosineOfAnAngleInRadians: [
    '计算弧度角的余弦。',
    'Calculates the cosine of an angle in radians.',
  ],
  calculatesTheTangentOfAnAngleInRadians: [
    '计算弧度角的正切。',
    'Calculates the tangent of an angle in radians.',
  ],
  calculatesTheArcsineInRadians: [
    '计算反正弦，结果以弧度表示。',
    'Calculates the arcsine in radians.',
  ],
  calculatesTheArccosineInRadians: [
    '计算反余弦，结果以弧度表示。',
    'Calculates the arccosine in radians.',
  ],
  calculatesTheArctangentInRadians: [
    '计算反正切，结果以弧度表示。',
    'Calculates the arctangent in radians.',
  ],
  calculatesTheAngleFromYAndXCoordinatesInRadians: [
    '按 y、x 坐标计算角度，结果以弧度表示。',
    'Calculates the angle from y and x coordinates in radians.',
  ],
  convertsRadiansToDegrees: ['将弧度转换为角度。', 'Converts radians to degrees.'],
  convertsDegreesToRadians: ['将角度转换为弧度。', 'Converts degrees to radians.'],
  returnsTheBinaryStringRepresentationOfAnInteger: [
    '返回整数的二进制字符串。',
    'Returns the binary string representation of an integer.',
  ],
  returnsTheHexadecimalStringRepresentationOfAValue: [
    '返回值的十六进制字符串。',
    'Returns the hexadecimal string representation of a value.',
  ],
  convertsAHexadecimalStringToABinaryValue: [
    '将十六进制字符串转换为二进制值。',
    'Converts a hexadecimal string to a binary value.',
  ],
  returnsTheOctalStringRepresentationOfAnInteger: [
    '返回整数的八进制字符串。',
    'Returns the octal string representation of an integer.',
  ],
  convertsANumericStringBetweenSpecifiedBases: [
    '在指定进制之间转换数值字符串。',
    'Converts a numeric string between specified bases.',
  ],
  truncatesANumberToTheSpecifiedDecimalPlaces: [
    '截断数值到指定小数位数。',
    'Truncates a number to the specified decimal places.',
  ],
  removesQuotesFromAJsonStringAndUnescapesItsContents: [
    '移除 JSON 字符串的引号并还原转义。',
    'Removes quotes from a JSON string and unescapes its contents.',
  ],
  insertsOrReplacesAValueAtAJsonPath: [
    '按 JSON 路径插入或替换值。',
    'Inserts or replaces a value at a JSON path.',
  ],
  insertsAJsonValueOnlyIfTheTargetPathDoes: [
    '只在目标路径尚不存在时插入 JSON 值。',
    'Inserts a JSON value only if the target path does not exist.',
  ],
  replacesAJsonValueOnlyIfTheTargetPathAlready: [
    '只替换目标路径已经存在的 JSON 值。',
    'Replaces a JSON value only if the target path already exists.',
  ],
  removesAJsonValueAtTheSpecifiedPath: [
    '移除指定路径的 JSON 值。',
    'Removes a JSON value at the specified path.',
  ],
  checksWhetherTheTargetJsonContainsTheCandidateJson: [
    '判断目标 JSON 是否包含候选 JSON。',
    'Checks whether the target JSON contains the candidate JSON.',
  ],
  returnsTheLengthOfAJsonValueArrayOrObject: [
    '返回 JSON 值、数组或对象的长度。',
    'Returns the length of a JSON value, array, or object.',
  ],
  returnsTheCollationNameOfAStringExpression: [
    '返回字符串表达式的排序规则名称。',
    'Returns the collation name of a string expression.',
  ],
  repeatsAnExpressionToMeasureExecutionTime: [
    '重复执行表达式以测量执行耗时。',
    'Repeats an expression to measure execution time.',
  ],
  pausesExecutionForTheSpecifiedSecondsQueryTimeoutAndCancellation: [
    '暂停执行指定秒数。查询超时和取消仍由设备服务控制。',
    'Pauses execution for the specified seconds. Query timeout and cancellation remain controlled by the device service.',
  ],
  generatesTheSpecifiedNumberOfSpaces: [
    '生成指定数量的空格。',
    'Generates the specified number of spaces.',
  ],
  generatesAStringAccordingToAFormat: [
    '按格式要求生成字符串。',
    'Generates a string according to a format.',
  ],
  extractsASubstringMatchingARegularExpression: [
    '提取匹配正则表达式的子串。',
    'Extracts a substring matching a regular expression.',
  ],
  returnsAnArrayOfJsonObjectKeys: [
    '返回 JSON 对象的键数组。',
    'Returns an array of JSON object keys.',
  ],
  returnsTheTypeNameOfAJsonValue: [
    '返回 JSON 值的类型名称。',
    'Returns the type name of a JSON value.',
  ],
  generatesReadableJsonText: ['生成便于阅读的 JSON 文本。', 'Generates readable JSON text.'],
  checksWhetherTheInputIsValidJson: [
    '检查输入是否为有效的 JSON。',
    'Checks whether the input is valid JSON.',
  ],
  aggregatesExpressionValuesIntoAJsonArray: [
    '将一组表达式值聚合为 JSON 数组。',
    'Aggregates expression values into a JSON array.',
  ],
  aggregatesKeyValuePairsIntoAJsonObject: [
    '将一组键值对聚合为 JSON 对象。',
    'Aggregates key-value pairs into a JSON object.',
  ],
  returnsAUnixTimestamp: ['返回 Unix 时间戳。', 'Returns a Unix timestamp.'],
  returnsTheDatabaseServerVersion: ['返回数据库服务版本。', 'Returns the database server version.'],
  returnsTheConstant: ['返回圆周率 π。', 'Returns the constant π.'],
  returnsTheCurrentDefaultDatabaseName: [
    '返回当前默认数据库名称。',
    'Returns the current default database name.',
  ],
  returnsTheCurrentDefaultDatabaseNameASynonymForDatabase: [
    '返回当前默认数据库名称，是 DATABASE 的同义函数。',
    'Returns the current default database name; a synonym for DATABASE.',
  ],
  returnsTheUserAndHostUsedByTheDatabaseConnection: [
    '返回数据库连接使用的用户和主机。',
    'Returns the user and host used by the database connection.',
  ],
  returnsTheAuthenticatedAccountUsedForPermissionChecks: [
    '返回权限检查所使用的认证账户。',
    'Returns the authenticated account used for permission checks.',
  ],
  returnsTheRowCountFromTheLastSqlCalcFound: [
    '返回上一次 SQL_CALC_FOUND_ROWS 查询的行数；MySQL 已弃用此接口。',
    'Returns the row count from the last SQL_CALC_FOUND_ROWS query; MySQL has deprecated this interface.',
  ],
  returnsTheMostRecentAutoIncrementIdentifierGeneratedByThe: [
    '返回当前连接最近生成的自动增长标识。',
    'Returns the most recent auto-increment identifier generated by the current connection.',
  ],
  generatesAUuid: ['生成 UUID 标识。', 'Generates a UUID.'],
  generatesABitShortUuid: ['生成 64 位短 UUID 标识。', 'Generates a 64-bit short UUID.'],
  assignsConsecutiveRowNumbersWithinAWindowPartition: [
    '为窗口分区中的每一行分配连续序号。',
    'Assigns consecutive row numbers within a window partition.',
  ],
  returnsAWindowRankSharingRanksForEqualValuesAnd: [
    '返回窗口排名，相同值共享名次并保留名次间隔。',
    'Returns a window rank, sharing ranks for equal values and leaving gaps.',
  ],
  returnsAWindowRankSharingRanksForEqualValuesWithout: [
    '返回窗口排名，相同值共享名次且不产生名次间隔。',
    'Returns a window rank, sharing ranks for equal values without gaps.',
  ],
  readsTheRowValueAtASpecifiedPrecedingOffsetWithin: [
    '读取窗口内之前指定偏移的行值。',
    'Reads the row value at a specified preceding offset within a window.',
  ],
  readsTheRowValueAtASpecifiedFollowingOffsetWithin: [
    '读取窗口内之后指定偏移的行值。',
    'Reads the row value at a specified following offset within a window.',
  ],
  returnsTheFirstValueInTheCurrentWindowFrame: [
    '返回当前窗口框架的第一个值。',
    'Returns the first value in the current window frame.',
  ],
  returnsTheLastValueInTheCurrentWindowFrame: [
    '返回当前窗口框架的最后一个值。',
    'Returns the last value in the current window frame.',
  ],
  dividesRowsInAWindowPartitionIntoTheSpecifiedNumber: [
    '将窗口分区中的行划分为指定数量的桶。',
    'Divides rows in a window partition into the specified number of buckets.',
  ],
  constructsAPostgresqlJsonbObjectFromKeyValuePairs: [
    '按键值对构造 PostgreSQL JSONB 对象。',
    'Constructs a PostgreSQL JSONB object from key-value pairs.',
  ],
  aggregatesExpressionValuesIntoAJsonbArray: [
    '将表达式值聚合为 JSONB 数组。',
    'Aggregates expression values into a JSONB array.',
  ],
  convertsAnSqlValueToJsonb: ['将 SQL 值转换为 JSONB。', 'Converts an SQL value to JSONB.'],
  replacesAJsonbValueAtAPath: ['按路径替换 JSONB 值。', 'Replaces a JSONB value at a path.'],
  aggregatesExpressionValuesIntoAnArray: [
    '将一组表达式值聚合为数组。',
    'Aggregates expression values into an array.',
  ],
  splitsAStringUsingADelimiterAndReturnsTheSpecified: [
    '按分隔符拆分字符串并返回指定片段。',
    'Splits a string using a delimiter and returns the specified segment.',
  ],
  generatesARandomUuid: ['生成随机 UUID。', 'Generates a random UUID.'],
  formatsASqliteDateAndTimeUsingAFormatString: [
    '按格式字符串输出 SQLite 日期和时间。',
    'Formats a SQLite date and time using a format string.',
  ],
  returnsTheFloatingPointSumOfNonNullValuesOr: [
    '返回非 NULL 值的浮点总和，空集合返回 0.0。',
    'Returns the floating-point sum of non-NULL values, or 0.0 for an empty set.',
  ],
  generatesTextUsingAFormatString: [
    '按格式字符串生成文本。',
    'Generates text using a format string.',
  ],
  choosesBetweenTwoValuesBasedOnAConditionEquivalentTo: [
    '按条件在两个值之间选择，等价于 CASE 条件表达式。',
    'Chooses between two values based on a condition, equivalent to a CASE expression.',
  ],
  returnsTheByteLengthOfAStringOrBinaryValue: [
    '返回字符串或二进制值的字节长度。',
    'Returns the byte length of a string or binary value.',
  ],
  returnsSqlLiteralTextRepresentingAValue: [
    '返回能够表示该值的 SQL 字面量文本。',
    'Returns SQL literal text representing a value.',
  ],
  returnsTheSqliteStorageTypeOfAValue: [
    '返回值的 SQLite 存储类型。',
    'Returns the SQLite storage type of a value.',
  ],
  returnsTheUnicodeCodePointOfTheFirstCharacterIn: [
    '返回字符串首字符的 Unicode 码点。',
    'Returns the Unicode code point of the first character in a string.',
  ],
  constructsAStringFromUnicodeCodePoints: [
    '按 Unicode 码点构造字符串。',
    'Constructs a string from Unicode code points.',
  ],
  returnsASqliteRandomInteger: ['返回 SQLite 的随机整数。', 'Returns a SQLite random integer.'],
  generatesARandomBinaryValueWithTheSpecifiedByteLength: [
    '生成指定字节长度的随机二进制值。',
    'Generates a random binary value with the specified byte length.',
  ],
  generatesZeroFilledBinaryContentWithTheSpecifiedByteLength: [
    '生成指定字节长度的零值二进制内容。',
    'Generates zero-filled binary content with the specified byte length.',
  ],
  preservesTheExpressionValueAndHintsToTheQueryPlanner: [
    '保持表达式值，并向查询规划器提示该条件通常为真。',
    'Preserves the expression value and hints to the query planner that the condition is usually true.',
  ],
  preservesTheExpressionValueAndHintsToTheQueryPlanner2623: [
    '保持表达式值，并向查询规划器提示该条件通常为假。',
    'Preserves the expression value and hints to the query planner that the condition is usually false.',
  ],
  preservesTheExpressionValueAndProvidesTheQueryPlannerWith: [
    '保持表达式值，并向查询规划器提供条件概率。',
    'Preserves the expression value and provides the query planner with the condition probability.',
  ],
  returnsTheCurrentSqliteRuntimeVersion: [
    '返回当前 SQLite 运行时版本。',
    'Returns the current SQLite runtime version.',
  ],
  generatesDatetimeTextFromATimeValueAndModifiers: [
    '按时间值和修饰符生成日期时间文本。',
    'Generates datetime text from a time value and modifiers.',
  ],
  convertsATimeValueToAJulianDayNumber: [
    '将时间值转换为儒略日数。',
    'Converts a time value to a Julian day number.',
  ],
  convertsATimeValueToAUnixTimestamp: [
    '将时间值转换为 Unix 时间戳。',
    'Converts a time value to a Unix timestamp.',
  ],
  validatesAndNormalizesJsonText: [
    '验证并规范化 JSON 文本。',
    'Validates and normalizes JSON text.',
  ],
  convertsJsonToSqliteSBinaryJsonbFormat: [
    '将 JSON 转换为 SQLite JSONB 二进制格式。',
    "Converts JSON to SQLite's binary JSONB format.",
  ],
  mergesObjectsUsingJsonMergePatchRules: [
    '按 JSON Merge Patch 规则合并对象。',
    'Merges objects using JSON Merge Patch rules.',
  ],
  returnsTheNumberOfElementsInAJsonArray: [
    '返回 JSON 数组的元素数量。',
    'Returns the number of elements in a JSON array.',
  ],
  convertsAnSqlValueToItsJsonRepresentation: [
    '将 SQL 值转换为对应的 JSON 表示。',
    'Converts an SQL value to its JSON representation.',
  ],
  aggregatesValuesInAQueryGroupIntoAJsonArray: [
    '将查询分组中的值聚合为 JSON 数组。',
    'Aggregates values in a query group into a JSON array.',
  ],
  aggregatesKeyValuePairsInAQueryGroupIntoA: [
    '将查询分组中的键值对聚合为 JSON 对象。',
    'Aggregates key-value pairs in a query group into a JSON object.',
  ],
  countHelp: ['返回行数。', 'Returns the number of rows'],
  sumHelp: ['返回数值列的总和。', 'Returns the sum of a numeric column'],
  avgHelp: ['返回数值列的平均值。', 'Returns the average of a numeric column'],
  minHelp: ['返回最小值。', 'Returns the minimum value'],
  maxHelp: ['返回最大值。', 'Returns the maximum value'],
  group_concatHelp: ['将分组中的值拼接为字符串。', 'Concatenates group values into a string'],
  string_aggHelp: ['拼接分组中的字符串。', 'Concatenates strings in a group'],
  concatHelp: ['拼接多个字符串。', 'Concatenates multiple strings'],
  concat_wsHelp: ['使用分隔符拼接字符串。', 'Concatenates strings with a separator'],
  substringHelp: ['提取字符串片段。', 'Extracts a substring'],
  replaceHelp: ['替换字符串中的内容。', 'Replaces content in a string'],
  trimHelp: ['移除字符串首尾空格。', 'Removes leading and trailing spaces'],
  upperHelp: ['转换为大写。', 'Converts to uppercase'],
  lowerHelp: ['转换为小写。', 'Converts to lowercase'],
  lengthHelp: ['返回字符串长度。', 'Returns string length'],
  regexp_replaceHelp: ['使用正则表达式进行替换。', 'Replaces using a regular expression'],
  date_formatHelp: ['按格式模板输出日期。', 'Formats a date with a pattern'],
  datediffHelp: ['计算两个日期的差值。', 'Calculates the difference between two dates'],
  date_addHelp: ['为日期增加时间间隔。', 'Adds to a date'],
  date_subHelp: ['从日期减去时间间隔。', 'Subtracts from a date'],
  extractHelp: ['提取日期的指定部分。', 'Extracts a part from a date'],
  nowHelp: ['返回当前日期和时间。', 'Returns the current date and time'],
  current_dateHelp: ['返回当前日期。', 'Returns the current date'],
  current_timeHelp: ['返回当前时间。', 'Returns the current time'],
  current_timestampHelp: ['返回当前日期和时间。', 'Returns the current date and time'],
  curdateHelp: ['返回当前日期。', 'Returns the current date'],
  curtimeHelp: ['返回当前时间。', 'Returns the current time'],
  localtimeHelp: ['返回当前本地时间。', 'Returns the current local time'],
  localtimestampHelp: ['返回当前本地日期和时间。', 'Returns the current local date and time'],
  utc_dateHelp: ['返回当前 UTC 日期。', 'Returns the current UTC date'],
  utc_timeHelp: ['返回当前 UTC 时间。', 'Returns the current UTC time'],
  utc_timestampHelp: ['返回当前 UTC 日期和时间。', 'Returns the current UTC date and time'],
  sysdateHelp: ['返回当前日期和时间。', 'Returns the current date and time'],
  dateHelp: ['提取日期部分。', 'Extracts the date part'],
  timeHelp: ['提取时间部分。', 'Extracts the time part'],
  timestampdiffHelp: ['返回两个日期时间的差值。', 'Returns the difference between two datetimes'],
  yearHelp: ['提取年份。', 'Extracts the year'],
  monthHelp: ['提取月份。', 'Extracts the month'],
  dayHelp: ['提取日序号。', 'Extracts the day'],
  hourHelp: ['提取小时。', 'Extracts the hour'],
  minuteHelp: ['提取分钟。', 'Extracts the minute'],
  secondHelp: ['提取秒。', 'Extracts the second'],
  dayofweekHelp: ['返回星期索引。', 'Returns the weekday index'],
  dayofyearHelp: ['返回一年中的日序号。', 'Returns the day of year'],
  last_dayHelp: ['返回月份的最后一天。', 'Returns the last day of the month'],
  str_to_dateHelp: ['将字符串转换为日期。', 'Converts a string to a date'],
  ifHelp: ['根据条件返回一个值。', 'Returns a value based on a condition'],
  leftHelp: ['返回最左侧的字符。', 'Returns the leftmost characters'],
  rightHelp: ['返回最右侧的字符。', 'Returns the rightmost characters'],
  substring_indexHelp: [
    '返回指定分隔符出现次数之前的字符串片段。',
    'Returns a substring before a delimiter count',
  ],
  char_lengthHelp: ['返回字符长度。', 'Returns the character length'],
  instrHelp: ['返回子串的位置。', 'Returns the position of a substring'],
  locateHelp: ['返回子串的位置。', 'Returns the position of a substring'],
  lpadHelp: ['将字符串左侧填充到指定长度。', 'Left-pads a string to a length'],
  rpadHelp: ['将字符串右侧填充到指定长度。', 'Right-pads a string to a length'],
  find_in_setHelp: ['返回逗号分隔列表中的索引。', 'Returns the index in a comma-separated list'],
  randHelp: ['返回随机浮点数。', 'Returns a random floating-point value'],
  md5Help: ['返回 MD5 哈希值。', 'Returns the MD5 hash'],
  sha1Help: ['返回 SHA1 哈希值。', 'Returns the SHA1 hash'],
  sha2Help: ['返回 SHA2 哈希值。', 'Returns the SHA2 hash'],
  roundHelp: ['按指定精度舍入。', 'Rounds to the specified precision'],
  floorHelp: ['向下取整。', 'Rounds down'],
  ceilHelp: ['向上取整。', 'Rounds up'],
  absHelp: ['返回绝对值。', 'Returns the absolute value'],
  modHelp: ['返回余数。', 'Returns the remainder'],
  coalesceHelp: ['返回第一个非 NULL 参数。', 'Returns the first non-NULL argument'],
  ifnullHelp: ['值为 NULL 时返回替代值。', 'Returns an alternate value when NULL'],
  nullifHelp: ['两个值相等时返回 NULL。', 'Returns NULL when values are equal'],
  castHelp: ['将表达式转换为指定类型。', 'Converts an expression to a specified type'],
  json_extractHelp: ['从 JSON 中提取一个值。', 'Extracts a value from JSON'],
  json_valueHelp: ['从 JSON 中提取标量值。', 'Extracts a scalar value from JSON'],
  json_objectHelp: ['创建 JSON 对象。', 'Creates a JSON object'],
  json_arrayHelp: ['创建 JSON 数组。', 'Creates a JSON array'],
});
