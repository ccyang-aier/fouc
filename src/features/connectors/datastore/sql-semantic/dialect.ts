import type { RelationalProvider } from '@fouc/shared';
import type { SqlSemanticBuildOptions } from './types';

export interface SqlSemanticProjectionAliasVisibility {
  where: boolean;
  groupBy: boolean;
  having: boolean;
  orderBy: boolean;
}

export interface SqlSemanticDialectAdapter {
  id: RelationalProvider;
  projectionAliasVisibility: SqlSemanticProjectionAliasVisibility;
  normalizeIdentifier(identifier: string, quoted?: boolean): string;
  sameIdentifier(left: string, right: string): boolean;
  columnKey(identifier: string): string;
  quoteIdentifier(identifier: string): string;
}

function quoteWith(identifier: string, quote: string): string {
  return quote + identifier.replaceAll(quote, quote + quote) + quote;
}

// UTF-8 PostgreSQL/SQLite identifiers fold ASCII letters; MySQL fields also fold Unicode case.
function foldAscii(identifier: string): string { return identifier.replace(/[A-Z]/g, (char) => char.toLowerCase()); }

/** DBX adapters restricted to the three installed native relational providers. */
export const SQL_SEMANTIC_DIALECTS: Record<RelationalProvider, SqlSemanticDialectAdapter> = {
  postgres: {
    id: 'postgres',
    projectionAliasVisibility: { where: false, groupBy: true, having: false, orderBy: true },
    normalizeIdentifier: (name, quoted) => quoted ? name : foldAscii(name),
    sameIdentifier: (left, right) => left === right,
    columnKey: (name) => name,
    quoteIdentifier: (name) => quoteWith(name, '"'),
  },
  mysql: {
    id: 'mysql',
    projectionAliasVisibility: { where: false, groupBy: true, having: true, orderBy: true },
    normalizeIdentifier: (name) => name,
    sameIdentifier: (left, right) => left === right,
    columnKey: (name) => name.toLowerCase(),
    quoteIdentifier: (name) => quoteWith(name, '`'),
  },
  sqlite: {
    id: 'sqlite',
    projectionAliasVisibility: { where: true, groupBy: true, having: true, orderBy: true },
    normalizeIdentifier: (name) => name,
    sameIdentifier: (left, right) => foldAscii(left) === foldAscii(right),
    columnKey: foldAscii,
    quoteIdentifier: (name) => quoteWith(name, '"'),
  },
};

export function sqlSemanticDialectFor(options: SqlSemanticBuildOptions = {}): SqlSemanticDialectAdapter {
  return SQL_SEMANTIC_DIALECTS[options.provider ?? 'mysql'];
}
