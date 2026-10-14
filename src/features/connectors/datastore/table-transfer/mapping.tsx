import { useTranslation, createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './mapping.messages';
import type { RelationalTableStructure } from '@fouc/shared';
import {
  tableTransferColumnOmittable,
  tableTransferTypeFamily,
  type TableTransferMapping,
} from '@fouc/shared/table-transfer';
import { structureColumnFromMetadata } from '@fouc/shared/relational-structure-edit';
import styles from './table-transfer.module.css';
export function autoTransferMappings(
  source: RelationalTableStructure,
  target: RelationalTableStructure,
): TableTransferMapping[] {
  return source.columns.flatMap((column) => {
    const to = target.columns.find((candidate) => candidate.name === column.name);
    if (!to) return [];
    const attributes = structureColumnFromMetadata(target, to);
    if (
      attributes.generated ||
      (target.provider === 'postgres' && attributes.identity?.kind === 'always')
    )
      return [];
    return [{ sourceColumn: column.name, targetColumn: to.name, conversion: 'native' as const }];
  });
}
export function TransferMappingTable({
  source,
  target,
  mappings,
  onChange,
}: {
  source: RelationalTableStructure;
  target: RelationalTableStructure;
  mappings: TableTransferMapping[];
  onChange: (mappings: TableTransferMapping[]) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  function change(sourceColumn: string, values: Partial<TableTransferMapping> | null) {
    if (!values) {
      onChange(mappings.filter((mapping) => mapping.sourceColumn !== sourceColumn));
      return;
    }
    const existing = mappings.find((mapping) => mapping.sourceColumn === sourceColumn);
    const next: TableTransferMapping = {
      sourceColumn,
      targetColumn: '',
      conversion: 'native',
      ...existing,
      ...values,
    };
    onChange(
      existing
        ? mappings.map((mapping) => (mapping.sourceColumn === sourceColumn ? next : mapping))
        : [...mappings, next],
    );
  }
  const used = new Set(mappings.map((mapping) => mapping.targetColumn));
  return (
    <div className={styles.mappingScroll}>
      <table className={styles.mapping}>
        <thead>
          <tr>
            <th>{tConnector('sourceColumnNativeType')}</th>
            <th>{tConnector('targetColumn')}</th>
            <th>{tConnector('valueConversion')}</th>
          </tr>
        </thead>
        <tbody>
          {source.columns.map((column) => {
            const mapping = mappings.find((mapping) => mapping.sourceColumn === column.name),
              binary = tableTransferTypeFamily(column.dataType, source.provider) === 'binary';
            return (
              <tr key={column.name} className={mapping ? styles.included : ''}>
                <td>
                  <b>{column.name}</b>
                  <small>{column.dataType || tConnector('dynamicType')}</small>
                </td>
                <td>
                  <select
                    aria-label={tConnector('mappingTarget', { p0: String(column.name) })}
                    value={mapping?.targetColumn ?? ''}
                    onChange={(event) =>
                      change(
                        column.name,
                        event.target.value
                          ? { targetColumn: event.target.value, conversion: 'native' }
                          : null,
                      )
                    }
                  >
                    <option value="">{tConnector('doNotTransferThisColumn')}</option>
                    {target.columns.map((to) => {
                      const attributes = structureColumnFromMetadata(target, to),
                        blocked = Boolean(
                          attributes.generated ||
                          (target.provider === 'postgres' &&
                            attributes.identity?.kind === 'always') ||
                          (used.has(to.name) && to.name !== mapping?.targetColumn),
                        );
                      return (
                        <option key={to.name} value={to.name} disabled={blocked}>
                          {to.name} · {to.dataType}
                          {attributes.generated
                            ? tConnector('generatedColumn')
                            : attributes.identity?.kind === 'always'
                              ? ' · IDENTITY ALWAYS'
                              : ''}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={tConnector('valueConversion3707', { p0: String(column.name) })}
                    value={mapping?.conversion ?? 'native'}
                    disabled={!mapping}
                    onChange={(event) =>
                      change(column.name, {
                        conversion: event.target.value as TableTransferMapping['conversion'],
                      })
                    }
                  >
                    <option value="native">{tConnector('nativeTypeBinding')}</option>
                    {binary ? (
                      <>
                        <option value="binary-hex">{tConnector('binaryHexText')}</option>
                        <option value="binary-base64">{tConnector('binaryBaseText')}</option>
                      </>
                    ) : (
                      <option value="text">{tConnector('explicitTextRepresentation')}</option>
                    )}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.omitted}>
        <h4>{tConnector('unmappedTargetColumns')}</h4>
        {target.columns
          .filter((column) => !used.has(column.name))
          .map((column) => (
            <span
              key={column.name}
              className={tableTransferColumnOmittable(column, target) ? '' : styles.required}
            >
              <b>{column.name}</b>
              {omitLabel(column, target, locale)}
            </span>
          ))}
        {target.columns.every((column) => used.has(column.name)) && (
          <p>{tConnector('allTargetColumnsAreMapped')}</p>
        )}
      </div>
    </div>
  );
}
function omitLabel(
  column: RelationalTableStructure['columns'][number],
  target: RelationalTableStructure,
  locale?: Locale,
): string {
  const tConnector = createTranslator(connectorMessages, locale);
  const attributes = structureColumnFromMetadata(target, column);
  return attributes.generated
    ? tConnector('generatedByTarget')
    : attributes.identity || /auto_increment/i.test(column.extra ?? '')
      ? tConnector('targetAutoIncrement')
      : column.columnDefault !== null
        ? tConnector('useDefault')
        : column.isNullable
          ? tConnector('writeNull')
          : tableTransferColumnOmittable(column, target)
            ? tConnector('targetAutomaticNumbering')
            : tConnector('requiredNoDefault');
}
