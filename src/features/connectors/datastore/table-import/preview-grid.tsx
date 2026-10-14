import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './preview-grid.messages';
import type { TableImportCell, TableImportParsed } from '@fouc/shared/table-import';
import styles from './table-import.module.css';
export function importCellText(cell: TableImportCell | undefined, locale?: Locale): string {
  const tConnector = createTranslator(connectorMessages, locale);
  return !cell || cell.kind === 'missing'
    ? tConnector('missingUseDefault')
    : cell.kind === 'null'
      ? 'NULL'
      : cell.value === ''
        ? tConnector('emptyString')
        : cell.value.length > 256
          ? cell.value.slice(0, 256) + '…'
          : cell.value;
}
export function TableImportPreviewGrid({
  parsed,
  limit = 20,
}: {
  parsed: TableImportParsed;
  limit?: number;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return (
    <div className={styles.preview}>
      <div className={styles.previewHeading}>
        <strong>{tConnector('sourceDataPreview')}</strong>
        <span>
          {tConnector('showingFirst')}
          {Math.min(parsed.rows.length, limit)}
          {tConnector('rowsTotal')}
          {parsed.totalRows}
          {tConnector('row')}
        </span>
      </div>
      {parsed.sourceTarget && (
        <p className={styles.hint}>
          {tConnector('sourceSql')}
          {parsed.sourceTarget.schema ? parsed.sourceTarget.schema + '.' : ''}
          {parsed.sourceTarget.table} · {parsed.sourceTarget.dialect}
          {tConnector('dataParsingOnlyWritesToTheTargetTableUsingThe')}
        </p>
      )}
      <div className={styles.gridScroll}>
        <table>
          <thead>
            <tr>
              <th className={styles.record}>{tConnector('record')}</th>
              {parsed.columns.map((name, index) => (
                <th key={name} title={name}>
                  {name}
                  <small>{parsed.inferredTypes[index]}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.slice(0, limit).map((row, index) => (
              <tr key={parsed.rowNumbers[index]}>
                <td className={styles.record}>{parsed.rowNumbers[index]}</td>
                {row.map((cell, column) => (
                  <td key={column} data-kind={cell.kind} title={importCellText(cell, locale)}>
                    {importCellText(cell, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
