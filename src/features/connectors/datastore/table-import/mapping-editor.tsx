import type { DatabaseColumnInfo, RelationalProvider } from '@fouc/shared';
import { autoMapTableImportColumns, isTableImportGeneratedColumn, tableImportSuggestedDataType, type TableImportMapping, type TableImportParsed } from '@fouc/shared/table-import';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { importCellText } from './preview-grid';
import styles from './table-import.module.css';

type Props = { parsed: TableImportParsed; targets: readonly DatabaseColumnInfo[]; mappings: TableImportMapping[]; provider: RelationalProvider; onChange: (mappings: TableImportMapping[]) => void };
export function TableImportMappingEditor({ parsed, targets, mappings, provider, onChange }: Props) {
  return <section className={styles.mapping} aria-label="导入字段映射">
    <div className={styles.sectionHeading}><div><strong>将源字段映射到目标表</strong><p>未映射的字段会跳过。目标默认值只用于缺失字段。</p></div><button type="button" className={styles.secondary} onClick={() => onChange(autoMapTableImportColumns(parsed.columns, targets))}>自动匹配</button></div>
    <div className={styles.mappingRows}>{parsed.columns.map((source, index) => {
      const mapping = mappings.find((item) => item.sourceColumn === source), target = targets.find((column) => column.name === mapping?.targetColumn);
      return <div key={source} className={styles.mappingRow} data-skipped={!mapping?.targetColumn}>
        <div className={styles.sourceField}><strong title={source}>{source}</strong><span>{tableImportSuggestedDataType(parsed.inferredTypes[index], provider)} · {importCellText(parsed.rows[0]?.[index])}</span></div>
        <ArrowRight size={15} className={styles.mappingArrow} />
        <label className={styles.targetField}><span className={styles.srOnly}>源字段 {source} 的目标字段</span><select value={mapping?.targetColumn ?? ''} onChange={(event) => onChange(parsed.columns.map((name) => ({ sourceColumn: name, targetColumn: name === source ? event.target.value : mappings.find((item) => item.sourceColumn === name)?.targetColumn ?? '' })))}><option value="">跳过此字段</option>{targets.map((column) => <option key={column.name} value={column.name} disabled={isTableImportGeneratedColumn(column)}>{column.name} · {column.dataType}{isTableImportGeneratedColumn(column) ? ' · 自动生成' : !column.isNullable ? ' · 必填' : ''}</option>)}</select><span>{target ? `${target.dataType}${target.columnDefault !== null ? ' · 有默认值' : ''}${target.isNullable ? ' · 可空' : ''}` : '不会写入目标表'}</span></label>
      </div>;
    })}</div>
  </section>;
}
