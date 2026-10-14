import {
  validationIssueFromError,
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from '../validation-issue';
import { inferTableImportColumns } from './inference';
import { ImportSqlFailure, ImportSqlLexer, type ImportSqlDialect } from './sql-lexer';
import {
  TABLE_IMPORT_LIMITS,
  type TableImportCell,
  type TableImportParsed,
  type TableImportParseOptions,
} from './types';
interface SqlName {
  display: string;
  identity: string;
}
function identifier(lexer: ImportSqlLexer): SqlName {
  const token = lexer.take();
  if (token.kind !== 'word' && token.kind !== 'identifier')
    lexer.fail(
      validationIssue(
        'table-import-sql-parse.sqlTableAndColumnNamesMustBeIdentifiers',
        'SQL 表名与字段名须为标识符。',
      ),
      token.offset,
    );
  if (!token.text || token.text.length > 1024 || token.text.includes('\0'))
    lexer.fail(
      validationIssue(
        'table-import-sql-parse.sqlIdentifiersSupportAtMostCharactersAndMust',
        'SQL 标识符最多 1024 字符，不能为空或包含 NUL。',
      ),
      token.offset,
    );
  const display =
    lexer.dialect === 'postgres' && token.kind === 'word' ? token.text.toLowerCase() : token.text;
  return { display, identity: lexer.dialect === 'postgres' ? display : display.toLowerCase() };
}
function literal(lexer: ImportSqlLexer): TableImportCell {
  const token = lexer.take();
  if (token.kind === 'number') return { kind: 'number', value: token.text };
  if (token.kind === 'string') return { kind: 'text', value: token.text };
  if (token.kind === 'symbol' && (token.text === '+' || token.text === '-')) {
    const number = lexer.take();
    if (number.kind !== 'number')
      lexer.fail(
        validationIssue(
          'table-import-sql-parse.signsApplyOnlyToNumericLiterals',
          '正负号只能用于数字字面量。',
        ),
        token.offset,
      );
    return { kind: 'number', value: (token.text === '-' ? '-' : '') + number.text };
  }
  if (token.kind === 'word') {
    const word = token.text.toUpperCase();
    if (word === 'NULL') return { kind: 'null' };
    if (word === 'TRUE' || word === 'FALSE') return { kind: 'boolean', value: word.toLowerCase() };
    if (['DATE', 'TIME', 'TIMESTAMP'].includes(word)) {
      const text = lexer.take();
      if (text.kind !== 'string')
        lexer.fail(
          validationIssue(
            'table-import-sql-parse.datetimeLiteralsMustImmediatelyPrecedeAStringTime',
            '日期时间字面量须紧跟一个字符串；不展开时区或函数。',
          ),
          token.offset,
        );
      return { kind: 'text', value: text.text };
    }
  }
  lexer.fail(
    validationIssue(
      'table-import-sql-parse.onlyNumberStringNullBooleanAndDatetimeLiterals',
      '只接受数字、字符串、NULL、布尔和日期时间字面量；函数、运算、占位符、DEFAULT、类型转换与二进制字面量不导入。',
    ),
    token.offset,
  );
}
function range(options: TableImportParseOptions): {
  start: number;
  end: number;
  dialect: ImportSqlDialect;
} {
  const start = options.dataStartRow ?? 1;
  const end = options.lastDataRow ?? 0;
  const dialect = options.sqlDialect ?? 'sqlite';
  if (!['mysql', 'postgres', 'sqlite'].includes(dialect))
    throw new ImportSqlFailure(
      validationIssue(
        'table-import-sql-parse.chooseMysqlPostgresqlOrSqliteAsTheSource',
        '请选择 MySQL、PostgreSQL 或 SQLite 源 SQL 方言。',
      ),
      0,
    );
  if (options.titleRow && options.titleRow !== 0)
    throw new ImportSqlFailure(
      validationIssue(
        'table-import-sql-parse.sqlUsesExplicitColumnListsTheHeaderRecord',
        'SQL 使用显式字段列表，标题记录须为 0。',
      ),
      0,
    );
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    start > 1000000 ||
    end < 0 ||
    end > 1000000 ||
    (end !== 0 && end < start)
  ) {
    throw new ImportSqlFailure(
      validationIssue('table-import-sql-parse.invalidSqlDataRecordRange', 'SQL 数据记录范围无效。'),
      0,
    );
  }
  if (options.trimValues || options.emptyStringAsNull)
    throw new ImportSqlFailure(
      validationIssue(
        'table-import-sql-parse.sqlStringsAndNullRetainTheirOriginalSemantics',
        'SQL 字符串与 NULL 使用原始语义，不支持去空白或空串转 NULL。',
      ),
      0,
    );
  return { start, end, dialect };
}
/** Adapted DBX literal INSERT import: decode data and map it, never execute the source script. */
export function parseSqlTableImport(
  text: string,
  options: TableImportParseOptions,
  signal?: AbortSignal,
): TableImportParsed {
  const parsed: TableImportParsed = {
    columns: [],
    rows: [],
    rowNumbers: [],
    inferredTypes: [],
    totalRows: 0,
    sizeBytes: 0,
    errors: [],
    warnings: [],
  };
  try {
    signal?.throwIfAborted();
    if (typeof text !== 'string' || text.length > TABLE_IMPORT_LIMITS.bytes)
      throw new ImportSqlFailure(
        validationIssue('table-import-sql-parse.sqlInputMustNotExceedMib', 'SQL 输入最多 5 MiB。'),
        0,
      );
    parsed.sizeBytes = new TextEncoder().encode(text).byteLength;
    if (parsed.sizeBytes > TABLE_IMPORT_LIMITS.bytes)
      throw new ImportSqlFailure(
        validationIssue(
          'table-import-sql-parse.sqlInputMustNotExceedMibOfUtf',
          'SQL 输入最多 5 MiB UTF-8 文本。',
        ),
        0,
      );
    const scope = range(options);
    const lexer = new ImportSqlLexer(text, scope.dialect, signal);
    let target: string | null = null;
    let columnNames: SqlName[] | null = null;
    let record = 0;
    let cells = 0;
    while (lexer.peek().kind !== 'end') {
      signal?.throwIfAborted();
      if (lexer.accept(';')) continue;
      lexer.expect('INSERT');
      lexer.expect('INTO');
      const first = identifier(lexer);
      const second = lexer.accept('.') ? identifier(lexer) : null;
      const schema = second ? first : null;
      const table = second ?? first;
      const identity = JSON.stringify([schema?.identity ?? null, table.identity]);
      if (target !== null && identity !== target)
        lexer.fail(
          validationIssue(
            'table-import-sql-parse.oneSqlImportFileMustContainOnlyOne',
            '一个 SQL 导入文件只能包含同一个源表，不能混入其他库 / 表。',
          ),
        );
      target = identity;
      parsed.sourceTarget = {
        schema: schema?.display ?? null,
        table: table.display,
        dialect: scope.dialect,
      };
      lexer.expect('(');
      const columns: SqlName[] = [];
      const seen = new Set<string>();
      do {
        const name = identifier(lexer);
        if (seen.has(name.identity))
          lexer.fail(
            validationIssue('table-import-sql-parse.duplicateSqlColumn', 'SQL 字段列表重复：{p0}', {
              p0: validationValue(name.display),
            }),
          );
        if (columns.length >= TABLE_IMPORT_LIMITS.columns)
          lexer.fail(
            validationIssue(
              'table-import-sql-parse.sqlImportsSupportAtMostColumns',
              'SQL 导入最多 256 列。',
            ),
          );
        seen.add(name.identity);
        columns.push(name);
      } while (lexer.accept(','));
      lexer.expect(')');
      if (columnNames === null) {
        columnNames = columns;
        parsed.columns = columns.map((name) => name.display);
      } else if (
        columnNames.length !== columns.length ||
        columnNames.some((name) => !seen.has(name.identity))
      ) {
        lexer.fail(
          validationIssue(
            'table-import-sql-parse.everyInsertMustProvideTheSameExplicitColumn',
            '每条 INSERT 必须提供相同的显式字段集合；缺省字段请先统一导出。',
          ),
        );
      }
      const positions = columnNames.map((name) =>
        columns.findIndex((column) => column.identity === name.identity),
      );
      lexer.expect('VALUES');
      do {
        const offset = lexer.peek().offset;
        lexer.expect('(');
        const row: TableImportCell[] = [];
        do {
          if (row.length >= columns.length)
            lexer.fail(
              validationIssue(
                'table-import-sql-parse.valuesHasMoreValuesThanTheExplicitColumn',
                'VALUES 值数量超过显式字段数。',
              ),
            );
          row.push(literal(lexer));
        } while (lexer.accept(','));
        lexer.expect(')');
        if (row.length !== columns.length)
          lexer.fail(
            validationIssue(
              'table-import-sql-parse.valuesCountDoesNotMatchTheExplicitColumn',
              'VALUES 值数量与显式字段数不一致。',
            ),
            offset,
          );
        if (++record > 100000)
          lexer.fail(
            validationIssue(
              'table-import-sql-parse.theCompleteSqlInputSupportsAtMostValue',
              '整个 SQL 输入最多 100000 条值记录，请拆分文件。',
            ),
            offset,
          );
        if (record >= scope.start && (!scope.end || record <= scope.end)) {
          if (parsed.rows.length >= TABLE_IMPORT_LIMITS.rows)
            lexer.fail(
              validationIssue(
                'table-import-sql-parse.theSelectedSqlScopeSupportsAtMostRows',
                '选定 SQL 范围最多 5000 行。',
              ),
              offset,
            );
          if ((cells += row.length) > TABLE_IMPORT_LIMITS.cells)
            lexer.fail(
              validationIssue(
                'table-import-sql-parse.theSelectedSqlScopeSupportsAtMostCells',
                '选定 SQL 范围最多 100000 个单元格。',
              ),
              offset,
            );
          parsed.rows.push(positions.map((position) => row[position]));
          parsed.rowNumbers.push(record);
        }
      } while (lexer.accept(','));
      if (lexer.peek().kind !== 'end') lexer.expect(';');
    }
    parsed.totalRows = parsed.rows.length;
    if (!parsed.columns.length || !parsed.rows.length)
      throw new ImportSqlFailure(
        validationIssue(
          'table-import-sql-parse.noImportableInsertLiteralRecordsInTheSelected',
          '选定 SQL 范围没有可导入的 INSERT 字面量记录。',
        ),
        0,
      );
    parsed.inferredTypes = inferTableImportColumns(parsed.rows, parsed.columns.length);
    parsed.warnings.push(
      validationIssue(
        'table-import-sql-parse.sourceSqlIsParsedOnlyAsDataIt',
        '源 SQL {p0}{p1} 仅解析为数据；实际写入当前审核的目标表，不执行脚本、DDL 或事务指令。',
        {
          p0: validationValue(parsed.sourceTarget?.schema ? parsed.sourceTarget.schema + '.' : ''),
          p1: validationValue(parsed.sourceTarget?.table),
        },
      ),
    );
    parsed.warnings.push(
      validationIssue(
        'table-import-sql-parse.sourceStringsUseTheSpecifiedDialectMysqlUses',
        '源字符串按明确方言解释；MySQL 使用默认反斜杠转义，PostgreSQL 普通字符串使用 standard_conforming_strings。其他会话模式请先转换数据文件。',
      ),
    );
  } catch (reason) {
    if (signal?.aborted) throw reason;
    const error =
      reason instanceof ImportSqlFailure
        ? reason
        : new ImportSqlFailure(validationIssueFromError(reason), 0);
    const prefix = typeof text === 'string' ? text.slice(0, error.offset) : '';
    const lastLine = Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r'));
    parsed.errors.push({
      ...error.issue,
      offset: error.offset,
      line: (prefix.match(/\r\n|\r|\n/g)?.length ?? 0) + 1,
      column: error.offset - lastLine,
      ...(error.record ? { record: error.record } : {}),
    });
    // A late unsupported statement invalidates the whole file, including previously decoded rows.
    parsed.rows = [];
    parsed.rowNumbers = [];
    parsed.totalRows = 0;
  }
  return parsed;
}
