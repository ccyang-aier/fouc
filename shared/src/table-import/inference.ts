import type { TableImportCell, TableImportInferredType } from './types';
import type { RelationalProvider } from '../relational';

/** DBX type inference preserves numeric-looking identifiers with significant leading zeros. */
export function inferTableImportCell(cell: TableImportCell): TableImportInferredType | null {
  if (cell.kind === 'null' || cell.kind === 'missing') return null;
  if (cell.kind === 'boolean') return 'boolean';
  if (cell.kind === 'json') return 'json';
  const text = cell.value.trim();
  if (!text) return 'text';
  if (/^\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(text)) return 'timestamp';
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(text)) return 'date';
  if (!/^[+-]?0\d/.test(text)) {
    if (/^[+-]?\d+$/.test(text)) return 'integer';
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return 'decimal';
  }
  return 'text';
}
export function inferTableImportColumns(rows: readonly TableImportCell[][], count: number): TableImportInferredType[] {
  return Array.from({ length: count }, (_, index) => {
    let current: TableImportInferredType | null = null;
    for (const row of rows) {
      const next = inferTableImportCell(row[index] ?? { kind: 'missing' });
      if (!next) continue;
      if (!current || current === next) current = next;
      else if ([current, next].every((type) => type === 'integer' || type === 'decimal')) current = 'decimal';
      else if ([current, next].every((type) => type === 'date' || type === 'timestamp')) current = 'timestamp';
      else return 'text';
    }
    return current ?? 'text';
  });
}
/** Suggestions inform mapping only. This feature never creates or alters the target schema. */
export function tableImportSuggestedDataType(type: TableImportInferredType, provider: RelationalProvider): string {
  if (type === 'boolean') return provider === 'postgres' ? 'BOOLEAN' : provider === 'mysql' ? 'TINYINT(1)' : 'INTEGER';
  if (type === 'integer') return provider === 'sqlite' ? 'INTEGER' : 'BIGINT';
  if (type === 'decimal') return provider === 'postgres' ? 'NUMERIC' : provider === 'mysql' ? 'DECIMAL' : 'REAL';
  if (type === 'date') return provider === 'sqlite' ? 'TEXT' : 'DATE';
  if (type === 'timestamp') return provider === 'sqlite' ? 'TEXT' : provider === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
  if (type === 'json') return provider === 'postgres' ? 'JSONB' : provider === 'mysql' ? 'JSON' : 'TEXT';
  return 'TEXT';
}
