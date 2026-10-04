import { describe, expect, it } from 'bun:test';
import { parseTableImport } from './parse';

describe('literal INSERT file import P0', () => {
  it('preserves exact integers, decimals, SQL strings, nulls and reordered column lists', () => {
    const parsed = parseTableImport("-- source\nINSERT INTO `source`.`files` (`id`, `amount`, `note`, `enabled`) VALUES(9007199254740993,1.2300000000000000001,'O''Brien, 中文',TRUE),(2,-.5e+2,'',NULL); INSERT INTO `source`.`files`(`note`,`enabled`,`id`,`amount`) VALUES('a\\nb',FALSE,+3,4.);", { format: 'sql', sqlDialect: 'mysql' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.columns).toEqual(['id', 'amount', 'note', 'enabled']);
    expect(parsed.rows[0]).toEqual([{ kind: 'number', value: '9007199254740993' }, { kind: 'number', value: '1.2300000000000000001' }, { kind: 'text', value: "O'Brien, 中文" }, { kind: 'boolean', value: 'true' }]);
    expect(parsed.rows[1][2]).toEqual({ kind: 'text', value: '' });
    expect(parsed.rows[1][3]).toEqual({ kind: 'null' });
    expect(parsed.rows[2]).toEqual([{ kind: 'number', value: '3' }, { kind: 'number', value: '4.' }, { kind: 'text', value: 'a\nb' }, { kind: 'boolean', value: 'false' }]);
    expect(parsed.sourceTarget).toEqual({ schema: 'source', table: 'files', dialect: 'mysql' });
    expect(parsed.totalRows).toBe(3);
  });

  it('obeys source dialect identity and PostgreSQL string modes', () => {
    const parsed = parseTableImport("/* outer /* nested */ */ INSERT INTO Public.Sample (ID,\"Case\",note) VALUES(1,E'\\u4E2D\\n', $tag$quote '; raw$tag$); INSERT INTO public.sample (note,\"Case\",id) VALUES('\\n',DATE '2026-10-04',2);", { format: 'sql', sqlDialect: 'postgres' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.columns).toEqual(['id', 'Case', 'note']);
    expect(parsed.rows[0][1]).toEqual({ kind: 'text', value: '中\n' });
    expect(parsed.rows[0][2]).toEqual({ kind: 'text', value: "quote '; raw" });
    expect(parsed.rows[1][2]).toEqual({ kind: 'text', value: '\\n' });
    expect(parseTableImport('INSERT INTO t(\"ID\") VALUES(1);INSERT INTO t(id) VALUES(2)', { format: 'sql', sqlDialect: 'postgres' }).errors).toHaveLength(1);
    expect(parseTableImport('INSERT INTO [中文表]([值]) VALUES(1)', { format: 'sql', sqlDialect: 'sqlite' }).errors).toEqual([]);
  });

  it('invalidates the whole source on executable or ambiguous constructs even outside selected range', () => {
    const unsupported = [
      "INSERT INTO t(a) VALUES(1);DROP TABLE t;",
      'INSERT IGNORE INTO t(a) VALUES(1)',
      'INSERT OR REPLACE INTO t(a) VALUES(1)',
      'INSERT INTO t(a) SELECT 1',
      'INSERT INTO t(a) VALUES(1) ON CONFLICT DO NOTHING',
      'INSERT INTO t(a) VALUES(NOW())',
      'INSERT INTO t(a) VALUES(1+2)',
      "INSERT INTO t(a) VALUES(X'00FF')",
      'INSERT INTO t(a) VALUES(DEFAULT)',
      'INSERT INTO t(a) VALUES($1)',
      'INSERT INTO t(a) VALUES(1::int)',
      'INSERT INTO t(a) VALUES(1);INSERT INTO other(a) VALUES(2)',
      'INSERT INTO t(a) VALUES(1);INSERT INTO t(b) VALUES(2)',
      'INSERT INTO t(a,a) VALUES(1,2)',
      'INSERT INTO t(a) VALUES(1,2)',
      'INSERT INTO t(a,b) VALUES(1)',
      'INSERT INTO t(a) VALUES(1) INSERT INTO t(a) VALUES(2)',
      'INSERT INTO t(a) VALUES(1);/*!80000 DELETE FROM t */',
    ];
    for (const text of unsupported) {
      const parsed = parseTableImport(text, { format: 'sql', sqlDialect: 'mysql', dataStartRow: 1, lastDataRow: 1 });
      expect(parsed.errors.length).toBeGreaterThan(0);
      expect(parsed.rows).toEqual([]);
      expect(parsed.totalRows).toBe(0);
    }
  });

  it('has bounded ranges, source diagnostics, precision and cancellation', () => {
    const ranged = parseTableImport('INSERT INTO t(a) VALUES(1),(2),(3),(4);', { format: 'sql', dataStartRow: 2, lastDataRow: 3 });
    expect(ranged.rowNumbers).toEqual([2, 3]);
    expect(ranged.rows.map(row => row[0])).toEqual([{ kind: 'number', value: '2' }, { kind: 'number', value: '3' }]);
    const invalid = parseTableImport('INSERT INTO t(a) VALUES(1);\nDELETE FROM t;', { format: 'sql' });
    expect(invalid.errors[0].line).toBe(2);
    expect(invalid.errors[0].column).toBe(1);
    expect(parseTableImport('INSERT INTO t(a) VALUES(1)', { format: 'sql', titleRow: 1 }).errors).toHaveLength(1);
    expect(parseTableImport('INSERT INTO t(a) VALUES(1)', { format: 'sql', trimValues: true }).errors).toHaveLength(1);
    expect(parseTableImport('INSERT INTO t(a) VALUES' + Array.from({ length: 5001 }, () => '(1)').join(','), { format: 'sql' }).rows).toEqual([]);
    expect(parseTableImport("INSERT INTO t(a) VALUES(E'\\xC3\\xA9')", { format: 'sql', sqlDialect: 'postgres' }).errors).toHaveLength(1);
    const controller = new AbortController();
    controller.abort();
    expect(() => parseTableImport('INSERT INTO t(a) VALUES(1)', { format: 'sql' }, controller.signal)).toThrow();
  });
});
