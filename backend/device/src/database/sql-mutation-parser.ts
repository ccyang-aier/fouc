import {
  tokenizeSqlSemantic,
  tokenIsIdentifier,
  unquoteSqlSemanticIdentifier,
  type RelationalProvider,
  type SqlSemanticToken,
} from '@fouc/shared';
import type { SqlMutationOperation } from '@fouc/shared/sql-mutation';
import { DatabaseInputError } from './input-error';

export type MutationExpression =
  | { kind: 'literal'; sql: string }
  | { kind: 'column'; name: string }
  | { kind: 'unary'; operator: string; value: MutationExpression }
  | { kind: 'binary'; operator: string; left: MutationExpression; right: MutationExpression }
  | { kind: 'list'; values: MutationExpression[] }
  | { kind: 'between'; operator: string; value: MutationExpression; lower: MutationExpression; upper: MutationExpression };

export interface ParsedSqlMutation {
  operation: SqlMutationOperation;
  schema: string;
  table: string;
  assignments: { column: string; expression: MutationExpression }[];
  insertColumns: string[];
  values: MutationExpression[][];
  where: MutationExpression | null;
}

const COMPARISONS = new Set(['=', '<>', '!=', '<', '>', '<=', '>=']);
const fail = (message: string): never => { throw new DatabaseInputError(`无法准确预览：${message}`); };

/** DBX DML SELECT rewrite uses expressions; Fouc parses a bounded, deterministic single-table subset. */
export function parseSqlMutation(sql: string, provider: RelationalProvider, defaultSchema: string): ParsedSqlMutation {
  if (!sql.trim() || sql.length > 65536 || sql.includes('\0')) fail('SQL 必须为 1–65536 字符');
  const all = tokenizeSqlSemantic(sql, provider);
  if (all.length > 8000 || all.some((token) => token.depth > 32)) fail('语句过大或嵌套超过 32 层');
  if (all.some((token) => token.closed === false)) fail('字符串、标识符或注释未闭合');
  if (all.some((token) => token.kind === 'comment' && /^\/\*[!+]/.test(token.text))) fail('不接受可执行注释或优化器提示');
  const tokens = all.filter((token) => token.kind !== 'comment');
  if (tokens.at(-1)?.text === ';') tokens.pop();
  if (tokens.some((token) => token.text === ';' || token.kind === 'parameter')) fail('仅接受一条不含未绑定参数的语句');
  const parser = new MutationParser(tokens, provider);
  const first = parser.take();
  if (first?.kind !== 'word' || !['insert', 'update', 'delete'].includes(first.normalized)) fail('仅支持 INSERT / UPDATE / DELETE');
  const operation = first.normalized as SqlMutationOperation;
  if (operation === 'insert') parser.requireWord('into');
  if (operation === 'delete') parser.requireWord('from');
  let table = parser.identifier(), schema = defaultSchema;
  if (parser.consume('.')) { schema = table; table = parser.identifier(); }
  if (schema !== defaultSchema) fail('目标必须位于当前获批的 Schema');
  const result: ParsedSqlMutation = { operation, schema, table, assignments: [], insertColumns: [], values: [], where: null };
  if (operation === 'insert') {
    parser.require('(');
    do { result.insertColumns.push(parser.identifier()); } while (parser.consume(','));
    parser.require(')');
    if (new Set(result.insertColumns).size !== result.insertColumns.length) fail('INSERT 列不能重复');
    parser.requireWord('values');
    do {
      parser.require('(');
      const row: MutationExpression[] = [];
      do { row.push(parser.expression()); } while (parser.consume(','));
      parser.require(')');
      if (row.length !== result.insertColumns.length) fail('VALUES 行与列数不一致');
      if (row.some((expression) => expressionColumns(expression).length)) fail('INSERT VALUES 仅支持确定性常量');
      result.values.push(row);
      if (result.values.length > 500) fail('INSERT 最多 500 个 VALUES 行');
    } while (parser.consume(','));
  } else {
    if (operation === 'update') {
      parser.requireWord('set');
      do {
        const column = parser.identifier();
        parser.require('=');
        result.assignments.push({ column, expression: parser.expression() });
      } while (parser.consume(','));
      if (new Set(result.assignments.map((assignment) => assignment.column)).size !== result.assignments.length) fail('同一列不能重复赋值');
      const assigned = new Set(result.assignments.map((assignment) => assignment.column));
      for (const assignment of result.assignments) {
        if (expressionColumns(assignment.expression).some((column) => column !== assignment.column && assigned.has(column))) fail('不支持多字段赋值间的依赖，避免 MySQL 顺序赋值与旧值预览不一致');
      }
    }
    parser.requireWord('where');
    result.where = parser.expression();
  }
  if (!parser.done()) fail('不支持别名、JOIN/FROM/USING、ORDER/LIMIT、RETURNING、UPSERT 或额外语法');
  return result;
}

class MutationParser {
  private index = 0;
  constructor(private readonly tokens: SqlSemanticToken[], private readonly provider: RelationalProvider) {}
  take() { return this.tokens[this.index++]; }
  peek(offset = 0) { return this.tokens[this.index + offset]; }
  done() { return this.index === this.tokens.length; }
  word(value: string) { return this.peek()?.kind === 'word' && this.peek()?.normalized === value; }
  consume(text: string) { if (this.peek()?.text !== text) return false; this.index++; return true; }
  require(text: string) { if (!this.consume(text)) fail(`需要 ${text}`); }
  requireWord(value: string) { if (!this.word(value)) fail(`需要 ${value.toUpperCase()}，当前语法未受支持`); this.index++; }
  identifier(): string {
    const token = this.take();
    if (!tokenIsIdentifier(token) || token.kind === 'word' && !/^[\p{ID_Start}_][\p{ID_Continue}_$]*$/u.test(token.text)) fail('对象或字段名无效');
    const name = unquoteSqlSemanticIdentifier(token);
    if (!name || name.length > 255 || name.includes('\0')) fail('对象或字段名无效');
    return this.provider === 'postgres' && token.kind === 'word' ? name.toLowerCase() : name;
  }
  expression(minimum = 0): MutationExpression {
    let left = this.atom();
    while (!this.done()) {
      const next = this.peek()!;
      let operator = next.kind === 'word' ? next.normalized : next.text, width = 1;
      if (['<', '>', '!'].includes(operator) && this.peek(1)?.text === '=') { operator += '='; width = 2; }
      else if (operator === '<' && this.peek(1)?.text === '>') { operator = '<>'; width = 2; }
      else if (operator === 'not' && ['in', 'between', 'like'].includes(this.peek(1)?.normalized ?? '')) { operator += ' ' + this.peek(1)!.normalized; width = 2; }
      const precedence = operator === 'or' ? 1 : operator === 'and' ? 2 : COMPARISONS.has(operator) || ['is', 'in', 'not in', 'between', 'not between', 'like', 'not like'].includes(operator) ? 3 : ['+', '-'].includes(operator) ? 4 : ['*', '/', '%'].includes(operator) ? 5 : -1;
      if (precedence < minimum || precedence < 0) break;
      this.index += width;
      if (operator === 'is') {
        if (this.word('not')) { this.index++; operator = 'is not'; }
        if (!['null', 'true', 'false'].some((word) => this.word(word))) fail('IS 仅支持 NULL / TRUE / FALSE');
      }
      if (operator.endsWith('in')) {
        this.require('(');
        const values: MutationExpression[] = [];
        do { values.push(this.expression(4)); } while (this.consume(','));
        this.require(')');
        if (values.some((value) => expressionColumns(value).length)) fail('IN 列表仅支持常量');
        left = { kind: 'binary', operator, left, right: { kind: 'list', values } };
      } else if (operator.endsWith('between')) {
        const lower = this.expression(4); this.requireWord('and'); const upper = this.expression(4);
        left = { kind: 'between', operator, value: left, lower, upper };
      } else left = { kind: 'binary', operator, left, right: this.expression(precedence + 1) };
    }
    return left;
  }
  private atom(): MutationExpression {
    const token = this.peek();
    if (!token) fail('表达式不完整');
    if (token.text === '(') { this.index++; const value = this.expression(); this.require(')'); return value; }
    if (['+', '-'].includes(token.text) || this.word('not')) { this.index++; return { kind: 'unary', operator: token.normalized, value: this.expression(token.normalized === 'not' ? 3 : 6) }; }
    if (token.kind === 'number' || token.kind === 'string' || ['null', 'true', 'false'].some((word) => this.word(word))) {
      this.index++; return { kind: 'literal', sql: token.text };
    }
    if (token.kind === 'word' && ['e', 'x'].includes(token.normalized) && this.peek(1)?.kind === 'string' && token.span.end === this.peek(1)!.span.start) {
      const literal = this.peek(1)!;
      if (token.normalized === 'e' && this.provider !== 'postgres' || token.normalized === 'x' && (this.provider === 'postgres' || !/^'[\da-f]*'$/i.test(literal.text))) fail('该原生字符串或二进制字面量未受支持');
      this.index += 2; return { kind: 'literal', sql: token.text + literal.text };
    }
    if (tokenIsIdentifier(token)) {
      const name = this.identifier();
      if (this.peek()?.text === '(' || this.peek()?.text === '.') fail('不执行函数、子查询或带前缀的字段引用');
      return { kind: 'column', name };
    }
    return fail('表达式包含未受支持的运算或语法');
  }
}

export function expressionColumns(expression: MutationExpression): string[] {
  switch (expression.kind) {
    case 'column': return [expression.name];
    case 'literal': return [];
    case 'unary': return expressionColumns(expression.value);
    case 'binary': return [...expressionColumns(expression.left), ...expressionColumns(expression.right)];
    case 'list': return expression.values.flatMap(expressionColumns);
    case 'between': return [...expressionColumns(expression.value), ...expressionColumns(expression.lower), ...expressionColumns(expression.upper)];
  }
}

export function renderMutationExpression(expression: MutationExpression, quote: (name: string) => string): string {
  switch (expression.kind) {
    case 'literal': return expression.sql;
    case 'column': return quote(expression.name);
    case 'unary': return `(${expression.operator.toUpperCase()} ${renderMutationExpression(expression.value, quote)})`;
    case 'binary': return `(${renderMutationExpression(expression.left, quote)} ${expression.operator.toUpperCase()} ${renderMutationExpression(expression.right, quote)})`;
    case 'list': return '(' + expression.values.map((value) => renderMutationExpression(value, quote)).join(', ') + ')';
    case 'between': return `(${renderMutationExpression(expression.value, quote)} ${expression.operator.toUpperCase()} ${renderMutationExpression(expression.lower, quote)} AND ${renderMutationExpression(expression.upper, quote)})`;
  }
}
