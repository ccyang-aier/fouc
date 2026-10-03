import type { DatabaseColumnInfo } from './database';
import type { RelationalTableStructure } from './relational-structure';
import type { StructureColumn, StructureDefault } from './relational-structure-edit';
import { tokenizeSqlSemantic, unquoteSqlSemanticIdentifier } from './sql-semantic-tokens';

const nativeClauses = new WeakMap<RelationalTableStructure, { sql: string; clauses: Map<string, string> }>();
/** Parse each immutable metadata snapshot once, including when hundreds of columns are edited. */
export function structureNativeColumnClause(structure: RelationalTableStructure, name: string): string | null {
  const sql = structure.definition.sql, cached = nativeClauses.get(structure);
  if (cached?.sql === sql) return cached.clauses.get(name) ?? null;
  const clauses = new Map<string, string>(); nativeClauses.set(structure, { sql, clauses });
  if (sql.length > 1048576) return null;
  const tokens = tokenizeSqlSemantic(sql, structure.provider);
  const open = tokens.findIndex((token) => token.text === '(');
  if (open < 0) return null;
  let start = open + 1;
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.text === ')' && token.depth === 0 || token.text === ',' && token.depth === 1) {
      const first = tokens[start];
      if (first && ['word', 'quoted_identifier'].includes(first.kind)) clauses.set(unquoteSqlSemanticIdentifier(first), sql.slice(first.span.start, token.span.start).trim());
      start = i + 1;
      if (token.text === ')') break;
    }
  }
  return clauses.get(name) ?? null;
}
export function structureColumnFromMetadata(structure: RelationalTableStructure, column: DatabaseColumnInfo): StructureColumn {
  const clause = structureNativeColumnClause(structure, column.name), tokens = clause ? tokenizeSqlSemantic(clause, structure.provider) : [];
  const as = tokens.findIndex((token, index) => token.kind === 'word' && token.normalized === 'as' && tokens[index + 1]?.text === '(');
  let generated: StructureColumn['generated'] = null;
  if (as >= 0 && clause) {
    const open = tokens[as + 1], close = tokens.find((token, index) => index > as + 1 && token.text === ')' && token.depth === open.depth);
    if (close) generated = { expression: clause.slice(open.span.end, close.span.start), storage: tokens.some((token) => token.kind === 'word' && token.normalized === 'virtual') ? 'virtual' : 'stored' };
  }
  let identity: StructureColumn['identity'] = null;
  if (/auto_increment/i.test(column.extra ?? '')) identity = { kind: 'auto-increment' };
  else if (/\bidentity\b/i.test(column.extra ?? '') || tokens.some((token) => token.normalized === 'identity')) {
    const definition: Exclude<NonNullable<StructureColumn['identity']>, { kind: 'auto-increment' }> = { kind: tokens.some((token) => token.normalized === 'always') ? 'always' : 'by-default' };
    for (const field of ['start', 'increment'] as const) {
      const position = tokens.findIndex((token) => token.normalized === field);
      if (position >= 0) {
        const number = tokens.slice(position + 1, position + 4).find((token) => token.kind === 'number');
        if (number) definition[field] = `${tokens[tokens.indexOf(number) - 1]?.text === '-' ? '-' : ''}${number.text}`;
      }
    }
    identity = definition;
  }
  let defaultValue: StructureDefault = { kind: 'none' };
  if (!generated && !identity && column.columnDefault != null) {
    if (structure.provider !== 'mysql' || /default_generated/i.test(column.extra ?? '')) defaultValue = { kind: 'expression', value: column.columnDefault };
    else if (/^(tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|bit|year)\b/i.test(column.dataType) && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(column.columnDefault)) defaultValue = { kind: 'number', value: column.columnDefault };
    else defaultValue = { kind: 'text', value: column.columnDefault };
  }
  return { name: column.name, dataType: column.dataType, nullable: column.isNullable, default: defaultValue, comment: column.comment ?? '', generated, identity };
}
