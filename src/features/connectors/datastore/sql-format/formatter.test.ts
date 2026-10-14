import { describe, expect, test as it } from 'bun:test';
import {
  DEFAULT_SQL_FORMATTER_SETTINGS,
  parseSqlFormatterConfig,
  serializeSqlFormatterConfig,
} from '@fouc/shared';
import {
  compressSqlText,
  formatSqlForDisplay,
  formatSqlForEditing,
  formatSqlText,
  MAX_SQL_FORMAT_CHARS,
} from './formatter';
import { formatSqlSnapshotForSave } from './format-on-save';
import { loadEngine } from './layout/internals';
import { detectAndFormatStructured } from './structured';

describe('native formatter P0 contracts', () => {
  it('actually loads the pinned AST engine instead of always falling back', async () => {
    const engine = await loadEngine();
    expect(engine).not.toBeNull();
    expect(typeof engine?.parse).toBe('function');
    for (const dialect of ['mysql', 'postgres', 'sqlite'] as const) {
      expect(
        await formatSqlText(
          'select alpha_column,beta_column,gamma_column,delta_column from records;',
          dialect,
          { expressionWidth: 50 },
        ),
      ).toBe(
        'SELECT alpha_column,\n       beta_column,\n       gamma_column,\n       delta_column\nFROM records;',
      );
    }
  });

  it('preserves all execution parameter spellings', async () => {
    for (const dialect of ['mysql', 'postgres', 'sqlite'] as const) {
      const source = "SELECT ${x}, #{rows.id}, :name, @tenant, ?, '${date}'";
      const formatted = await formatSqlText(source, dialect);
      for (const parameter of ['${x}', '#{rows.id}', ':name', '@tenant', '?', "'${date}'"])
        expect(formatted).toContain(parameter);
    }
  });

  it('keeps PostgreSQL adjacent literals executable across every layout style', async () => {
    const source = "SELECT 'one'\n 'two' AS value;";
    for (const indentStyle of ['standard', 'tabularLeft', 'tabularRight'] as const) {
      const formatted = await formatSqlText(source, 'postgres', { indentStyle });
      expect(formatted).toMatch(/'one'\s*\n\s*'two'/);
    }
    expect(compressSqlText(source, 'postgres')).toBe("SELECT 'one'\n'two' AS value;");
  });

  it('retains newline-sensitive literals beside dollar strings and comments', async () => {
    const source = "SELECT $$previous$$, 'a'\n'b'\n'c' AS text_value;";
    expect(await formatSqlText(source, 'postgres')).toMatch(/'a'\s*\n\s*'b'\s*\n\s*'c'/);
    expect(compressSqlText("SELECT 'one' -- explanation\n 'two';", 'postgres')).toBe(
      "SELECT 'one'\n'two';",
    );
  });

  it('never injects blank-line markers into literal or comment contents', async () => {
    for (const dialect of ['mysql', 'postgres', 'sqlite'] as const) {
      const source = "SELECT 'first\n\nlast' AS value /* first\n\nlast */;\n\nSELECT 2;";
      const formatted = await formatSqlText(source, dialect, { preserveEmptyLines: true });
      expect(formatted).toContain("'first\n\nlast'");
      expect(formatted).toContain('/* first\n\nlast */');
      expect(formatted).not.toContain('__DBX_PRESERVE_EMPTY_LINE_');
    }
    const dollar = 'SELECT $body$first\n\nlast$body$;';
    expect(await formatSqlText(dollar, 'postgres', { preserveEmptyLines: true })).toContain(
      '$body$first\n\nlast$body$',
    );
  });

  it('never joins a condition into a line comment', async () => {
    const source = 'SELECT * FROM records WHERE x = 1 -- keep this\nAND y = 2;';
    for (const dialect of ['mysql', 'postgres', 'sqlite'] as const) {
      expect(await formatSqlText(source, dialect, { logicalOperatorNewline: 'none' })).toMatch(
        /-- keep this\n\s*AND y = 2/,
      );
    }
  });

  it('does not rewrite FROM or logical operators inside quoted source', async () => {
    const source = "SELECT 'text\nFROM\n  records\nAND extra' AS value;";
    expect(
      await formatSqlText(source, 'postgres', {
        fromClauseLayout: 'sameLine',
        logicalOperatorNewline: 'none',
      }),
    ).toContain("'text\nFROM\n  records\nAND extra'");
    const sqlite = 'SELECT [AND\nOR], [FROM\n  records] FROM records;';
    const formatted = await formatSqlText(sqlite, 'sqlite', { logicalOperatorNewline: 'none' });
    expect(formatted).toContain('[AND\nOR]');
    expect(formatted).toContain('[FROM\n  records]');
  });

  it('compresses ordinary comments into safe token separators', () => {
    expect(compressSqlText('SELECT/* first */1/* nested */AS value;', 'mysql')).toBe(
      'SELECT 1 AS value;',
    );
    expect(compressSqlText('SELECT 1--2 AS value; -- ordinary\nSELECT #{x}; # end', 'mysql')).toBe(
      'SELECT 1--2 AS value; SELECT #{x};',
    );
    expect(compressSqlText('SELECT 1--2 AS value;\n SELECT 3;', 'postgres')).toBe(
      'SELECT 1 SELECT 3;',
    );
    expect(compressSqlText('SELECT 1 /* outer /* nested */ tail */ AS value;', 'postgres')).toBe(
      'SELECT 1 AS value;',
    );
    expect(compressSqlText('SELECT 1 /* unclosed', 'sqlite')).toBe('SELECT 1 /* unclosed');
    expect(
      compressSqlText(
        "SELECT 'a\\\'b\\c', `a``b`, /*! 80000 1 + 2 */, /*+   MAX_EXECUTION_TIME(1000)  */ 1;",
        'mysql',
      ),
    ).toBe("SELECT 'a\\\'b\\c', `a``b`, /*! 80000 1 + 2 */, /*+ MAX_EXECUTION_TIME(1000) */ 1;");
  });

  it('compresses source without modifying native quoted contents', () => {
    expect(
      compressSqlText("SELECT E'first\\\'value', $x$ -- unchanged\n/* kept */ $x$;", 'postgres'),
    ).toBe("SELECT E'first\\\'value', $x$ -- unchanged\n/* kept */ $x$;");
    expect(compressSqlText('SELECT [AND\nOR], [a b], `a``b`, "a""b"; -- comment', 'sqlite')).toBe(
      'SELECT [AND\nOR], [a b], `a``b`, "a""b";',
    );
  });

  it('leaves mid-edit input and read-only unsupported source intact', async () => {
    const incomplete = "SELECT 'unterminated";
    expect(await formatSqlForEditing(incomplete, 'mysql')).toBe(incomplete);
    expect(await formatSqlForDisplay('<root><item/></root>', 'mysql')).toBe('<root><item/></root>');
    await expect(
      formatSqlText(' '.repeat(MAX_SQL_FORMAT_CHARS) + 'SELECT 1', 'mysql'),
    ).rejects.toThrow('SQL 太大');
  });

  it('formats structured sources without losing JSON numbers or XML text', () => {
    const result = detectAndFormatStructured('{"integer":9007199254740993,"integer":1e+100}', {
      indentSize: 2,
    });
    expect(result.kind).toBe('json');
    if (result.kind === 'json') expect(result.formatted).toContain('9007199254740993');
    const xml = '<root><item>first\n\nlast</item><item><![CDATA[<value>]]></item></root>';
    const formatted = detectAndFormatStructured(xml, { indentSize: 2 });
    expect(formatted.kind).toBe('xml');
    if (formatted.kind === 'xml')
      expect(formatted.formatted).toContain('<item>first\n\nlast</item>');
    expect(detectAndFormatStructured('<root><item></root>', { indentSize: 2 })).toEqual({
      kind: 'unsupported',
      detectedType: 'xml',
    });
    expect(detectAndFormatStructured('[database].[records]', { indentSize: 2 })).toEqual({
      kind: 'sql',
    });
  });

  it('keeps edits made while asynchronous format-on-save is running', async () => {
    let current = 'SELECT 1';
    const applied: string[] = [];
    const result = await formatSqlSnapshotForSave(
      current,
      () => current,
      async () => {
        current = 'SELECT 2';
        return 'SELECT 1;';
      },
      (formatted) => {
        applied.push(formatted);
      },
    );
    expect(result).toBe('SELECT 2');
    expect(applied).toEqual([]);
    expect(
      await formatSqlSnapshotForSave(
        current,
        () => current,
        async (source) => `${source};`,
        (formatted) => {
          current = formatted;
        },
      ),
    ).toBe('SELECT 2;');
  });

  it('rejects value substitution and malformed imported configurations', () => {
    const document = JSON.parse(serializeSqlFormatterConfig(DEFAULT_SQL_FORMATTER_SETTINGS));
    expect(parseSqlFormatterConfig(JSON.stringify(document))).toEqual({
      ok: true,
      settings: DEFAULT_SQL_FORMATTER_SETTINGS,
    });
    document.options.params = null;
    expect(parseSqlFormatterConfig(JSON.stringify(document)).ok).toBe(false);
    delete document.options.params;
    document.options.paramTypes = { custom: [{ regex: '[' }] };
    expect(parseSqlFormatterConfig(JSON.stringify(document)).ok).toBe(false);
    document.options.paramTypes = { custom: [{ regex: 'a*' }] };
    expect(parseSqlFormatterConfig(JSON.stringify(document)).ok).toBe(false);
    document.options.paramTypes = null;
    document.params = null;
    expect(parseSqlFormatterConfig(JSON.stringify(document)).ok).toBe(false);
  });
});
