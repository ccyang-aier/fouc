import type { DatabaseColumnInfo } from '../database';
import type { RelationalProvider } from '../relational';
import { TABLE_IMPORT_LIMITS, type TableImportMapping, type TableImportValidation } from './types';

export function normalizeTableImportColumn(name: string): string { return name.trim().toLocaleLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '); }
export function isTableImportGeneratedColumn(column: DatabaseColumnInfo): boolean { return /\b(?:generated|computed|identity)\b/i.test(column.extra ?? ''); }
export function isTableImportDefaultColumn(column: DatabaseColumnInfo, provider: RelationalProvider, targets?: readonly DatabaseColumnInfo[]): boolean {
  return column.columnDefault !== null || /auto_increment|identity|generated|rowid/i.test(column.extra ?? '') || (provider === 'sqlite' && column.isPrimaryKey && /^INTEGER$/i.test(column.dataType) && (!targets || targets.filter((target) => target.isPrimaryKey).length === 1));
}
/** DBX exact-first matching, avoiding ambiguous normalized target names and duplicate automatic mappings. */
export function autoMapTableImportColumns(sourceColumns: readonly string[], targetColumns: readonly DatabaseColumnInfo[]): TableImportMapping[] {
  const available = targetColumns.filter((column) => !isTableImportGeneratedColumn(column));
  const used = new Set<string>();
  return sourceColumns.map((sourceColumn) => {
    const exact = available.find((column) => column.name === sourceColumn);
    const candidates = available.filter((column) => normalizeTableImportColumn(column.name) === normalizeTableImportColumn(sourceColumn));
    const target = exact ?? (candidates.length === 1 ? candidates[0] : undefined);
    const targetColumn = target && !used.has(target.name) ? target.name : '';
    if (targetColumn) used.add(targetColumn);
    return { sourceColumn, targetColumn };
  });
}
export function validateTableImportMappings(sources: readonly string[], mappings: readonly TableImportMapping[], targets: readonly DatabaseColumnInfo[], provider: RelationalProvider): TableImportValidation {
  const errors: TableImportValidation['errors'] = [], mappedColumns: string[] = [];
  const sourceSeen = new Set<string>(), targetSeen = new Set<string>();
  if (mappings.length > TABLE_IMPORT_LIMITS.columns) errors.push({ message: '字段映射最多 256 项。' });
  for (const mapping of mappings) {
    if (!sources.includes(mapping.sourceColumn)) errors.push({ message: `源字段不存在：${mapping.sourceColumn}`, sourceColumn: mapping.sourceColumn });
    if (sourceSeen.has(mapping.sourceColumn)) errors.push({ message: `源字段重复映射：${mapping.sourceColumn}`, sourceColumn: mapping.sourceColumn });
    sourceSeen.add(mapping.sourceColumn);
    if (!mapping.targetColumn) continue;
    const target = targets.find((column) => column.name === mapping.targetColumn);
    if (!target) errors.push({ message: `目标字段不存在：${mapping.targetColumn}`, targetColumn: mapping.targetColumn });
    else if (isTableImportGeneratedColumn(target)) errors.push({ message: `生成字段不可导入：${target.name}`, targetColumn: target.name });
    if (targetSeen.has(mapping.targetColumn)) errors.push({ message: `目标字段重复映射：${mapping.targetColumn}`, targetColumn: mapping.targetColumn });
    targetSeen.add(mapping.targetColumn); mappedColumns.push(mapping.targetColumn);
  }
  if (!mappedColumns.length) errors.push({ message: '至少映射一个目标字段。' });
  const requiredColumns = targets.filter((column) => !column.isNullable && !isTableImportDefaultColumn(column, provider, targets) && !targetSeen.has(column.name)).map((column) => column.name);
  if (requiredColumns.length) errors.push({ message: `必填字段尚未映射：${requiredColumns.join('、')}` });
  return { valid: errors.length === 0, errors, warnings: [], mappedColumns, requiredColumns };
}
