import { describe, expect, it } from 'bun:test';
import { compileSqlTemplate, inspectSqlTemplate } from './sql-template';
import { sqlVariableContext, stripSqlVariableDeclarations } from './sql-variables';
import { sqlSourceEnd, sqlSourcePosition } from './sql-source-map';
import { splitSqlExecutionRanges } from './sql-execution';

describe('native SQL templates', () => {
  it('expands document-prefix variables without forwarding unrelated statements', () => {
    const sql = 'SELECT @tenant, ${label}, :missing';
    const declarationSql = "@set tenant = 9007199254740993;\n@set label = 'Alpha';\nSELECT 99;\n" + sql;
    const inspected = inspectSqlTemplate(sql, 'postgres', declarationSql);
    expect(inspected.descriptors.map((item) => item.key)).toEqual(['missing']);
    const output = compileSqlTemplate(sql, 'postgres', { declarationSql, parameters: { missing: { kind: 'null', value: '' } } });
    expect(output.sql).toBe("SELECT 9007199254740993, 'Alpha', NULL");
    expect(sqlSourcePosition(output, output.sql.indexOf('9007'))).toBe(sql.indexOf('@tenant'));
  });
  it('removes declarations and retains original error coordinates after several expansions', () => {
    const sql = "@set ids = (1,2,3);\nSELECT '😀', :name, missing_field FROM fixture WHERE id IN @ids;";
    const output = compileSqlTemplate(sql, 'postgres', { parameters: { name: { kind: 'string', value: "O'Reilly; unicode😀" } } });
    expect(sqlSourcePosition(output, output.sql.indexOf('missing_field'))).toBe(sql.indexOf('missing_field'));
    const ranges = splitSqlExecutionRanges(output.sql, 'postgres');
    expect(ranges).toHaveLength(1);
    expect(sqlSourcePosition(output, ranges[0].from)).toBe(sql.indexOf('SELECT'));
  });
  it('rejects typed SQL injection before execution while preserving exact decimal text', () => {
    expect(() => compileSqlTemplate('SELECT :n', 'mysql', { parameters: { n: { kind: 'number', value: '1; DELETE FROM fixture' } } })).toThrow('有效数字');
    expect(compileSqlTemplate('SELECT :n', 'sqlite', { parameters: { n: { kind: 'number', value: '9007199254740993' } } }).sql).toBe('SELECT 9007199254740993');
    expect(() => compileSqlTemplate('SELECT :n', 'postgres')).toThrow('请填写参数');
  });
  it('expands MyBatis where/foreach, XML comparisons and repeated dotted names', () => {
    const sql = 'SELECT * FROM fixture <where>AND id &lt; #{filter.limit} AND name IN <foreach collection="names" item="name" open="(" close=")" separator=",">#{name}</foreach></where>';
    const output = compileSqlTemplate(sql, 'mysql', { parameters: { 'filter.limit': { kind: 'number', value: '5' }, names: { kind: 'string', value: '["Alpha","O\'Reilly"]' } } });
    expect(output.sql).toBe("SELECT * FROM fixture WHERE id < 5 AND name IN ('Alpha','O''Reilly')");
    expect(() => compileSqlTemplate(sql, 'mysql', { parameters: { 'filter.limit': { kind: 'number', value: '5' }, names: { kind: 'number', value: '[9007199254740993]' } } })).toThrow('精确大整数');
  });
  it('keeps PostgreSQL hash operators and MySQL braced parameters in the stream', () => {
    expect(inspectSqlTemplate("SELECT '{}'::jsonb #>> '{a}', :name", 'postgres').descriptors.map((item) => item.key)).toEqual(['name']);
    expect(splitSqlExecutionRanges('SELECT #{first}; SELECT #{second}', 'mysql')).toHaveLength(2);
  });
  it('bounds template expansion and nesting before constructing unbounded output', () => {
    expect(() => compileSqlTemplate('SELECT :x,:x', 'postgres', { parameters: { x: { kind: 'string', value: 'a'.repeat(600_000) } } })).toThrow('超过 1 MB');
    expect(() => inspectSqlTemplate('<where>'.repeat(34) + 'a' + '</where>'.repeat(34), 'postgres')).toThrow('嵌套');
    expect(() => compileSqlTemplate('SELECT :x', 'postgres', { parameters: { x: { kind: 'string', value: '中'.repeat(400_000) } } })).toThrow('超过 1 MB');
    expect(() => inspectSqlTemplate('SELECT ' + Array.from({ length: 129 }, (_, index) => `:p${index}`).join(','), 'sqlite')).toThrow('128');
  });
  it('retains the complete original placeholder for every statement created by a raw fragment', () => {
    const sql = '${batch}';
    const output = compileSqlTemplate(sql, 'sqlite', { parameters: { batch: { kind: 'raw', value: 'SELECT 1; SELECT 2' } } });
    const ranges = splitSqlExecutionRanges(output.sql, 'sqlite');
    expect(ranges.map((range) => sql.slice(sqlSourcePosition(output, range.from), sqlSourceEnd(output, range.to)))).toEqual([sql, sql]);
  });
  it('never treats a MySQL comment as a variable declaration or reference', () => {
    const sql = '# ignored; @set tenant = 99;\n@set tenant = 42;\nSELECT @tenant # @tenant; @set tenant = 77;\n';
    const output = compileSqlTemplate(sql, 'mysql');
    expect(output.sql).toContain('SELECT 42 # @tenant; @set tenant = 77;');
    expect(output.sql).toContain('# ignored; @set tenant = 99;');
  });
  it('replays variable context without earlier declarations overriding the captured target', () => {
    const sql = '-- target\n@set tenant = 1;\nSELECT @tenant';
    const context = sql + ';\n@set tenant = 2;';
    const history = `${sqlVariableContext(context, 'postgres')}\n${stripSqlVariableDeclarations(sql, 'postgres')}`;
    expect(compileSqlTemplate(history, 'postgres').sql).toContain('SELECT 2');
  });
  it('preserves native PostgreSQL nested comments while extracting actual parameters', () => {
    const sql = '/* outer /* inner */ :ignored @set hidden = 7; */ SELECT :actual';
    expect(inspectSqlTemplate(sql, 'postgres').descriptors.map((item) => item.key)).toEqual(['actual']);
    expect(compileSqlTemplate(sql, 'postgres', { parameters: { actual: { kind: 'number', value: '3' } } }).sql).toContain('SELECT 3');
  });
});
