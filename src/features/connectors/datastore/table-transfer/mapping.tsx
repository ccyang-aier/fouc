import type { RelationalTableStructure } from '@fouc/shared';
import { tableTransferColumnOmittable, tableTransferTypeFamily, type TableTransferMapping } from '@fouc/shared/table-transfer';
import { structureColumnFromMetadata } from '@fouc/shared/relational-structure-edit';
import styles from './table-transfer.module.css';

export function autoTransferMappings(source: RelationalTableStructure, target: RelationalTableStructure): TableTransferMapping[] {
  return source.columns.flatMap((column) => {
    const to = target.columns.find((candidate) => candidate.name === column.name);
    if (!to) return [];
    const attributes = structureColumnFromMetadata(target, to);
    if (attributes.generated || target.provider === 'postgres' && attributes.identity?.kind === 'always') return [];
    return [{ sourceColumn: column.name, targetColumn: to.name, conversion: 'native' as const }];
  });
}
export function TransferMappingTable({ source, target, mappings, onChange }: { source: RelationalTableStructure; target: RelationalTableStructure; mappings: TableTransferMapping[]; onChange: (mappings: TableTransferMapping[]) => void }) {
  function change(sourceColumn: string, values: Partial<TableTransferMapping> | null) {
    if (!values) { onChange(mappings.filter((mapping) => mapping.sourceColumn !== sourceColumn)); return; }
    const existing = mappings.find((mapping) => mapping.sourceColumn === sourceColumn);
    const next: TableTransferMapping = { sourceColumn, targetColumn: '', conversion: 'native', ...existing, ...values };
    onChange(existing ? mappings.map((mapping) => mapping.sourceColumn === sourceColumn ? next : mapping) : [...mappings, next]);
  }
  const used = new Set(mappings.map((mapping) => mapping.targetColumn));
  return <div className={styles.mappingScroll}><table className={styles.mapping}><thead><tr><th>源字段 / 原生类型</th><th>目标字段</th><th>值转换</th></tr></thead><tbody>{source.columns.map((column) => {
    const mapping = mappings.find((mapping) => mapping.sourceColumn === column.name), binary = tableTransferTypeFamily(column.dataType, source.provider) === 'binary';
    return <tr key={column.name} className={mapping ? styles.included : ''}><td><b>{column.name}</b><small>{column.dataType || '动态类型'}</small></td><td><select aria-label={`映射目标 ${column.name}`} value={mapping?.targetColumn ?? ''} onChange={(event) => change(column.name, event.target.value ? { targetColumn: event.target.value, conversion: 'native' } : null)}><option value="">不传输此字段</option>{target.columns.map((to) => {
      const attributes = structureColumnFromMetadata(target, to), blocked = Boolean(attributes.generated || target.provider === 'postgres' && attributes.identity?.kind === 'always' || used.has(to.name) && to.name !== mapping?.targetColumn);
      return <option key={to.name} value={to.name} disabled={blocked}>{to.name} · {to.dataType}{attributes.generated ? ' · 生成列' : attributes.identity?.kind === 'always' ? ' · IDENTITY ALWAYS' : ''}</option>;
    })}</select></td><td><select aria-label={`值转换 ${column.name}`} value={mapping?.conversion ?? 'native'} disabled={!mapping} onChange={(event) => change(column.name, { conversion: event.target.value as TableTransferMapping['conversion'] })}><option value="native">原生类型绑定</option>{binary ? <><option value="binary-hex">二进制 → HEX 文本</option><option value="binary-base64">二进制 → Base64 文本</option></> : <option value="text">显式文本表示</option>}</select></td></tr>;
  })}</tbody></table><div className={styles.omitted}><h4>未映射目标字段</h4>{target.columns.filter((column) => !used.has(column.name)).map((column) => <span key={column.name} className={tableTransferColumnOmittable(column, target) ? '' : styles.required}><b>{column.name}</b>{omitLabel(column, target)}</span>)}{target.columns.every((column) => used.has(column.name)) && <p>所有目标字段均有映射。</p>}</div></div>;
}
function omitLabel(column: RelationalTableStructure['columns'][number], target: RelationalTableStructure): string {
  const attributes = structureColumnFromMetadata(target, column);
  return attributes.generated ? '由目标生成' : attributes.identity || /auto_increment/i.test(column.extra ?? '') ? '目标自增' : column.columnDefault !== null ? '使用 DEFAULT' : column.isNullable ? '写入 NULL' : tableTransferColumnOmittable(column, target) ? '目标自动编号' : '必需 · 无默认值';
}
