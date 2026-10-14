'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './structure-metadata.messages';
import type { ReactNode } from 'react';
import type { RelationalTableStructure } from '@fouc/shared';
import { ArrowSquareOut, Key } from '@phosphor-icons/react';
import styles from './table-structure.module.css';
export type StructureTab =
  'columns' | 'indexes' | 'foreignKeys' | 'constraints' | 'triggers' | 'ddl';
const state = (value: boolean | null, locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return value === null ? tConnector('unknown') : value ? 'YES' : 'NO';
};
const kinds = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    primary: tConnector('primaryKey'),
    unique: tConnector('unique'),
    foreign: tConnector('foreignKeys'),
    check: tConnector('check'),
    exclusion: tConnector('exclusion'),
    'not-null': tConnector('isNotNull'),
  };
};
const has = (search: string, ...values: unknown[]) =>
  !search ||
  values.some((value) =>
    JSON.stringify(value)?.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
function MetadataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className={styles.grid}>
      <table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Definition({ text }: { text: string | null }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return text ? (
    <details className={styles.definition}>
      <summary>{tConnector('goToDefinition')}</summary>
      <pre>{text}</pre>
    </details>
  ) : (
    <span className={styles.muted}>{tConnector('seeObjectDdl')}</span>
  );
}
function Empty({ search }: { search: string }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <p className={styles.empty}>
      {search
        ? tConnector('noMatchingStructureRecords')
        : tConnector('thisObjectHasNoStructureRecordsOfThisKind')}
    </p>
  );
}
export function StructureMetadata({
  structure,
  tab,
  search,
  pending,
  onOpenTable,
}: {
  structure: RelationalTableStructure;
  tab: Exclude<StructureTab, 'ddl'>;
  search: string;
  pending: boolean;
  onOpenTable: (schema: string, table: string) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  if (tab === 'columns') {
    const columns = structure.columns.filter((column) =>
      has(search, column.name, column.dataType, column.comment),
    );
    return (
      <>
        <MetadataTable
          headings={[
            tConnector('field'),
            tConnector('type'),
            tConnector('nullable'),
            tConnector('primaryKey'),
            tConnector('unique'),
            tConnector('defaultExpression'),
            tConnector('generationMethod'),
            tConnector('comment'),
          ]}
        >
          {columns.map((column) => (
            <tr key={column.name}>
              <td className={styles.name}>
                {column.isPrimaryKey && <Key size={12} />} {column.name}
              </td>
              <td>{column.dataType}</td>
              <td>{state(column.isNullable, locale)}</td>
              <td>{column.isPrimaryKey ? 'PK' : '—'}</td>
              <td>{state(column.isUnique, locale)}</td>
              <td>
                <code>{column.columnDefault ?? '—'}</code>
              </td>
              <td>{column.extra || '—'}</td>
              <td>{column.comment || '—'}</td>
            </tr>
          ))}
        </MetadataTable>
        {!columns.length && <Empty search={search} />}
      </>
    );
  }
  if (tab === 'indexes') {
    const indexes = structure.indexes.filter((index) =>
      has(search, index.name, index.parts, index.predicate, index.comment),
    );
    return (
      <>
        <MetadataTable
          headings={[
            tConnector('indexes'),
            tConnector('keysIncludedColumns'),
            tConnector('method'),
            tConnector('unique'),
            tConnector('primaryKey'),
            tConnector('valid'),
            tConnector('visible'),
            tConnector('conditionDefinition'),
          ]}
        >
          {indexes.map((index) => (
            <tr key={index.name}>
              <td className={styles.name}>
                {index.name}
                <small>{index.comment}</small>
              </td>
              <td>
                {index.parts.map((part) => (
                  <div key={part.position} className={styles.part}>
                    <code>
                      {part.column ??
                        part.expression ??
                        (part.role === 'auxiliary'
                          ? tConnector('rowidAuxiliaryKey')
                          : tConnector('expressionSeeDdl'))}
                    </code>
                    <small>
                      {part.role === 'include'
                        ? 'INCLUDE'
                        : part.role === 'auxiliary'
                          ? tConnector('auxiliary')
                          : part.descending === null
                            ? ''
                            : part.descending
                              ? 'DESC'
                              : 'ASC'}
                      {part.nulls ? ` · NULLS ${part.nulls.toUpperCase()}` : ''}
                      {part.prefixLength !== null
                        ? tConnector('prefix', { p0: String(part.prefixLength) })
                        : ''}
                      {part.collation ? ` · ${part.collation}` : ''}
                    </small>
                  </div>
                ))}
              </td>
              <td>{index.method}</td>
              <td>{state(index.unique, locale)}</td>
              <td>{state(index.primary, locale)}</td>
              <td>{state(index.valid, locale)}</td>
              <td>{state(index.visible, locale)}</td>
              <td>
                {index.predicate && <code>{index.predicate}</code>}
                <Definition text={index.definition} />
              </td>
            </tr>
          ))}
        </MetadataTable>
        {!indexes.length && <Empty search={search} />}
      </>
    );
  }
  if (tab === 'foreignKeys') {
    const keys = structure.foreignKeys.filter((key) =>
      has(search, key.name, key.columns, key.referencedTable, key.referencedColumns),
    );
    return (
      <>
        <MetadataTable
          headings={[
            tConnector('foreignKeys'),
            tConnector('columnMapping'),
            tConnector('referencedObject'),
            'ON UPDATE',
            'ON DELETE',
            tConnector('match'),
            tConnector('deferralValidation'),
            tConnector('definition'),
          ]}
        >
          {keys.map((key) => (
            <tr key={key.name}>
              <td className={styles.name}>
                {key.name}
                {key.nameSource === 'synthetic' && (
                  <small>{tConnector('pragmaNumberSeeDdlForDeclaredName')}</small>
                )}
              </td>
              <td>
                {key.columns.map((column, index) => (
                  <div className={styles.part} key={column}>
                    {column} <span className={styles.muted}>→</span> {key.referencedColumns[index]}
                  </div>
                ))}
              </td>
              <td>
                <button
                  type="button"
                  className={styles.reference}
                  disabled={pending}
                  aria-label={tConnector('openReferencedTable', {
                    p0: String(key.referencedSchema),
                    p1: String(key.referencedTable),
                  })}
                  title={
                    pending
                      ? tConnector('commitOrDiscardGridChangesFirst')
                      : tConnector('openReferencedTable3345')
                  }
                  onClick={() => onOpenTable(key.referencedSchema, key.referencedTable)}
                >
                  {key.referencedSchema}.{key.referencedTable}
                  <ArrowSquareOut size={12} />
                </button>
              </td>
              <td>{key.onUpdate}</td>
              <td>{key.onDelete}</td>
              <td>{key.match}</td>
              <td>
                {tConnector('deferrable')}
                {state(key.deferrable, locale)}
                <small>
                  {tConnector('initiallyDeferred')}
                  {state(key.initiallyDeferred, locale)}
                </small>
                <small>
                  {tConnector('validated')}
                  {state(key.validated, locale)}
                </small>
              </td>
              <td>
                <Definition text={key.definition} />
              </td>
            </tr>
          ))}
        </MetadataTable>
        {!keys.length && <Empty search={search} />}
      </>
    );
  }
  if (tab === 'constraints') {
    const constraints = structure.constraints.filter((constraint) =>
      has(search, constraint.name, constraint.columns, constraint.definition),
    );
    return (
      <>
        <MetadataTable
          headings={[
            tConnector('constraints'),
            tConnector('type'),
            tConnector('field'),
            tConnector('validated'),
            tConnector('deferrable'),
            tConnector('initiallyDeferred'),
            tConnector('definition'),
          ]}
        >
          {constraints.map((constraint) => (
            <tr key={constraint.name}>
              <td className={styles.name}>{constraint.name}</td>
              <td>{kinds(locale)[constraint.kind]}</td>
              <td>{constraint.columns.join(', ') || '—'}</td>
              <td>{state(constraint.validated, locale)}</td>
              <td>{state(constraint.deferrable, locale)}</td>
              <td>{state(constraint.initiallyDeferred, locale)}</td>
              <td>
                <Definition text={constraint.definition} />
              </td>
            </tr>
          ))}
        </MetadataTable>
        {!constraints.length && <Empty search={search} />}
      </>
    );
  }
  const triggers = structure.triggers.filter((trigger) =>
    has(search, trigger.name, trigger.events, trigger.definition),
  );
  return (
    <>
      <MetadataTable
        headings={[
          tConnector('triggers'),
          tConnector('timing'),
          tConnector('event'),
          tConnector('granularity'),
          tConnector('status'),
          tConnector('definition'),
        ]}
      >
        {triggers.map((trigger) => (
          <tr key={trigger.name}>
            <td className={styles.name}>{trigger.name}</td>
            <td>{trigger.timing}</td>
            <td>{trigger.events.join(' / ') || tConnector('seeOriginalDdl')}</td>
            <td>{trigger.orientation}</td>
            <td>{trigger.enabled ?? tConnector('unknown')}</td>
            <td>
              <Definition text={trigger.definition} />
            </td>
          </tr>
        ))}
      </MetadataTable>
      {!triggers.length && <Empty search={search} />}
    </>
  );
}
