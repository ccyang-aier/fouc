import type { TableImportCell, TableImportParsed } from '@fouc/shared/table-import';
import styles from './table-import.module.css';

export function importCellText(cell: TableImportCell | undefined): string {
  return !cell || cell.kind === 'missing' ? '缺失 · 使用默认值' : cell.kind === 'null' ? 'NULL' : cell.value === '' ? '空字符串' : cell.value.length > 256 ? cell.value.slice(0, 256) + '…' : cell.value;
}
export function TableImportPreviewGrid({ parsed, limit = 20 }: { parsed: TableImportParsed; limit?: number }) {
  return <div className={styles.preview}>
    <div className={styles.previewHeading}><strong>源数据预览</strong><span>显示前 {Math.min(parsed.rows.length, limit)} 行 / 共 {parsed.totalRows} 行</span></div>
    {parsed.sourceTarget && <p className={styles.hint}>源 SQL：{parsed.sourceTarget.schema ? parsed.sourceTarget.schema + '.' : ''}{parsed.sourceTarget.table} · {parsed.sourceTarget.dialect} · 仅解析数据，按当前映射写入目标表</p>}
    <div className={styles.gridScroll}><table><thead><tr><th className={styles.record}>记录</th>{parsed.columns.map((name, index) => <th key={name} title={name}>{name}<small>{parsed.inferredTypes[index]}</small></th>)}</tr></thead><tbody>{parsed.rows.slice(0, limit).map((row, index) => <tr key={parsed.rowNumbers[index]}><td className={styles.record}>{parsed.rowNumbers[index]}</td>{row.map((cell, column) => <td key={column} data-kind={cell.kind} title={importCellText(cell)}>{importCellText(cell)}</td>)}</tr>)}</tbody></table></div>
  </div>;
}
