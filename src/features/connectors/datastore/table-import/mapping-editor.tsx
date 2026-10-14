import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './mapping-editor.messages';
import type { DatabaseColumnInfo, RelationalProvider } from '@fouc/shared';
import {
  autoMapTableImportColumns,
  isTableImportGeneratedColumn,
  tableImportSuggestedDataType,
  type TableImportMapping,
  type TableImportParsed,
} from '@fouc/shared/table-import';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { importCellText } from './preview-grid';
import styles from './table-import.module.css';
type Props = {
  parsed: TableImportParsed;
  targets: readonly DatabaseColumnInfo[];
  mappings: TableImportMapping[];
  provider: RelationalProvider;
  onChange: (mappings: TableImportMapping[]) => void;
};
export function TableImportMappingEditor({ parsed, targets, mappings, provider, onChange }: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return (
    <section className={styles.mapping} aria-label={tConnector('importColumnMapping')}>
      <div className={styles.sectionHeading}>
        <div>
          <strong>{tConnector('mapSourceColumnsToTheTargetTable')}</strong>
          <p>{tConnector('unmappedColumnsAreSkippedTargetDefaultsApplyOnlyToMissing')}</p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => onChange(autoMapTableImportColumns(parsed.columns, targets))}
        >
          {tConnector('autoMatch')}
        </button>
      </div>
      <div className={styles.mappingRows}>
        {parsed.columns.map((source, index) => {
          const mapping = mappings.find((item) => item.sourceColumn === source),
            target = targets.find((column) => column.name === mapping?.targetColumn);
          return (
            <div key={source} className={styles.mappingRow} data-skipped={!mapping?.targetColumn}>
              <div className={styles.sourceField}>
                <strong title={source}>{source}</strong>
                <span>
                  {tableImportSuggestedDataType(parsed.inferredTypes[index], provider)} ·{' '}
                  {importCellText(parsed.rows[0]?.[index], locale)}
                </span>
              </div>
              <ArrowRight size={15} className={styles.mappingArrow} />
              <label className={styles.targetField}>
                <span className={styles.srOnly}>
                  {tConnector('sourceColumn')}
                  {source}
                  {tConnector('targetColumn')}
                </span>
                <select
                  value={mapping?.targetColumn ?? ''}
                  onChange={(event) =>
                    onChange(
                      parsed.columns.map((name) => ({
                        sourceColumn: name,
                        targetColumn:
                          name === source
                            ? event.target.value
                            : (mappings.find((item) => item.sourceColumn === name)?.targetColumn ??
                              ''),
                      })),
                    )
                  }
                >
                  <option value="">{tConnector('skipThisColumn')}</option>
                  {targets.map((column) => (
                    <option
                      key={column.name}
                      value={column.name}
                      disabled={isTableImportGeneratedColumn(column)}
                    >
                      {column.name} · {column.dataType}
                      {isTableImportGeneratedColumn(column)
                        ? tConnector('generatedAutomatically')
                        : !column.isNullable
                          ? tConnector('required')
                          : ''}
                    </option>
                  ))}
                </select>
                <span>
                  {target
                    ? `${target.dataType}${target.columnDefault !== null ? tConnector('hasDefault') : ''}${target.isNullable ? tConnector('nullable') : ''}`
                    : tConnector('willNotBeWrittenToTheTargetTable')}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
