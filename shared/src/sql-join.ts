import type { RelationalProvider } from './relational';
import type { RelationalTableStructure } from './relational-structure';

export interface SqlJoinTable { schema: string; table: string }
export interface SqlJoinRelationship {
  owner: SqlJoinTable;
  referenced: SqlJoinTable;
  constraint: string;
  nameSource: 'catalog' | 'synthetic';
  pairs: Array<{ owner: string; referenced: string }>;
}

export function sqlJoinTableKey(table: SqlJoinTable): string {
  return JSON.stringify([table.schema, table.table]);
}

export function sameSqlJoinIdentifier(left: string, right: string, provider: RelationalProvider): boolean {
  const fold = (value: string) => value.replace(/[A-Z]/g, letter => letter.toLowerCase());
  return provider === 'sqlite' ? fold(left) === fold(right) : left === right;
}

export function sameSqlJoinTable(left: SqlJoinTable, right: SqlJoinTable, provider: RelationalProvider): boolean {
  return sameSqlJoinIdentifier(left.schema, right.schema, provider) && sameSqlJoinIdentifier(left.table, right.table, provider);
}

/** DBX directional FK matching, with the native catalog's composite column order intact. */
export function sqlJoinRelationships(structures: readonly RelationalTableStructure[], provider: RelationalProvider): SqlJoinRelationship[] {
  const relationships: SqlJoinRelationship[] = [];
  const seen = new Set<string>();
  for (const structure of structures) {
    if (structure.provider !== provider || structure.kind !== 'table') continue;
    for (const foreign of structure.foreignKeys) {
      if (!foreign.columns.length || foreign.columns.length !== foreign.referencedColumns.length ||
        new Set(foreign.columns).size !== foreign.columns.length || new Set(foreign.referencedColumns).size !== foreign.referencedColumns.length ||
        !foreign.referencedTable || foreign.columns.some(column => !structure.columns.some(item => sameSqlJoinIdentifier(item.name, column, provider)))) continue;
      const owner = { schema: structure.schema, table: structure.table };
      const referenced = { schema: foreign.referencedSchema || structure.schema, table: foreign.referencedTable };
      const target = structures.find(item => item.provider === provider && sameSqlJoinTable({ schema: item.schema, table: item.table }, referenced, provider));
      if (target && foreign.referencedColumns.some(column => !target.columns.some(item => sameSqlJoinIdentifier(item.name, column, provider)))) continue;
      const pairs = foreign.columns.map((column, index) => ({ owner: column, referenced: foreign.referencedColumns[index] }));
      const key = JSON.stringify([owner, referenced, foreign.name, pairs]);
      if (seen.has(key)) continue;
      seen.add(key);
      relationships.push({ owner, referenced, pairs, constraint: foreign.name, nameSource: foreign.nameSource });
    }
  }
  return relationships;
}

export function sqlJoinRelatedTable(relation: SqlJoinRelationship, table: SqlJoinTable, provider: RelationalProvider): SqlJoinTable | null {
  if (sameSqlJoinTable(relation.owner, table, provider)) return relation.referenced;
  if (sameSqlJoinTable(relation.referenced, table, provider)) return relation.owner;
  return null;
}
