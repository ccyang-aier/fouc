'use client';

import { uiText, type UiMessage, uiFailure } from '../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './schema-compare-action.messages';
import { useEffect, useRef, useState } from 'react';
import { ArrowsLeftRight, ArrowRight, SpinnerGap } from '@phosphor-icons/react';
import type {
  DatabaseObjectInfo,
  RelationalProvider,
  RelationalTableStructure,
} from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { SchemaDiffPanel } from './schema-diff';
import { SqlDialog } from './sql-library-dialog';
import styles from './data-tools.module.css';
type Source = {
  schema: string;
  table: string;
  tables: DatabaseObjectInfo[];
  schemas: string[];
};
type Props = Source & {
  base: string;
  provider: RelationalProvider;
  disabled: boolean;
};
export function SchemaCompareAction(props: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [source, setSource] = useState<Source | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label={tConnector('compareTableStructures')}
        disabled={props.disabled || !props.table}
        onClick={() =>
          setSource({
            schema: props.schema,
            table: props.table,
            tables: props.tables,
            schemas: props.schemas,
          })
        }
      >
        <ArrowsLeftRight size={15} />
        <span>{tConnector('compareStructure')}</span>
      </button>
      {source && (
        <SchemaCompareDialog
          {...source}
          base={props.base}
          provider={props.provider}
          onClose={() => setSource(null)}
        />
      )}
    </>
  );
}
function SchemaCompareDialog({
  base,
  provider,
  schema,
  table,
  tables,
  schemas,
  onClose,
}: Source & {
  base: string;
  provider: RelationalProvider;
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [sourceSchema, setSourceSchema] = useState(schema),
    [sourceTable, setSourceTable] = useState(
      tables.find((item) => item.name !== table && item.kind === 'table')?.name ?? '',
    );
  const [catalog, setCatalog] = useState<{
    schema: string;
    items: DatabaseObjectInfo[];
    error: UiMessage;
  } | null>(null);
  const [comparison, setComparison] = useState<{
      source: RelationalTableStructure;
      target: RelationalTableStructure;
    } | null>(null),
    [loading, setLoading] = useState(false),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<DatabaseObjectInfo[]>(
      `${base}/schemas/${encodeURIComponent(sourceSchema)}/tables`,
      { signal: controller.signal },
    )
      .then((items) => {
        if (!controller.signal.aborted)
          setCatalog({
            schema: sourceSchema,
            items: items.filter((item) => item.kind === 'table'),
            error: '',
          });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setCatalog({
            schema: sourceSchema,
            items: [],
            error: uiFailure(reason),
          });
      });
    return () => controller.abort();
  }, [base, sourceSchema]);
  function changeSchema(value: string) {
    request.current?.abort();
    request.current = null;
    setSourceSchema(value);
    setSourceTable('');
    setComparison(null);
    setError('');
    setLoading(false);
  }
  function changeTable(value: string) {
    request.current?.abort();
    request.current = null;
    setSourceTable(value);
    setComparison(null);
    setError('');
    setLoading(false);
  }
  async function compare() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setComparison(null);
    setError('');
    const read = (targetSchema: string, targetTable: string) =>
      backendFetch<RelationalTableStructure>(
        `${base}/schemas/${encodeURIComponent(targetSchema)}/tables/${encodeURIComponent(targetTable)}/structure`,
        { signal: controller.signal },
      );
    try {
      const [source, target] = await Promise.all([
        read(sourceSchema, sourceTable),
        read(schema, table),
      ]);
      if (request.current === controller && !controller.signal.aborted)
        setComparison({ source, target });
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted) {
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
        controller.abort();
      }
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }
  const items = catalog?.schema === sourceSchema ? catalog.items : [],
    catalogError = catalog?.schema === sourceSchema ? uiText(catalog.error, locale) : '';
  return (
    <SqlDialog
      title={tConnector('compareTableStructures')}
      className={styles.dialog}
      onClose={onClose}
    >
      {comparison && (
        <div className={styles.mobileSource}>
          <span title={`${sourceSchema}.${sourceTable} → ${schema}.${table}`}>
            {sourceSchema}.{sourceTable} → {schema}.{table}
          </span>
          <button type="button" onClick={() => setComparison(null)}>
            {tConnector('changeSource')}
          </button>
        </div>
      )}
      <div className={styles.sources} data-ready={!!comparison}>
        <label>
          {tConnector('referenceSchema')}
          <select
            aria-label={tConnector('structureComparisonReferenceSchema')}
            value={sourceSchema}
            disabled={loading}
            onChange={(event) => changeSchema(event.target.value)}
          >
            {schemas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          {tConnector('referenceTable')}
          <select
            aria-label={tConnector('structureComparisonReferenceTable')}
            value={sourceTable}
            disabled={loading || catalog?.schema !== sourceSchema}
            onChange={(event) => changeTable(event.target.value)}
          >
            <option value="">{tConnector('selectAReferenceTable')}</option>
            {items.map((item) => (
              <option key={item.name} disabled={sourceSchema === schema && item.name === table}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <ArrowRight size={16} />
        <label>
          {tConnector('currentTarget')}
          <strong>
            {schema}.{table}
          </strong>
          <small>{tConnector('generateAReviewScriptToMatchTheTargetToThe')}</small>
        </label>
        <button
          type="button"
          disabled={
            loading ||
            !sourceTable ||
            !!catalogError ||
            catalog?.schema !== sourceSchema ||
            (sourceSchema === schema && sourceTable === table)
          }
          onClick={() => void compare()}
        >
          {loading
            ? tConnector('readingStructure')
            : comparison
              ? tConnector('compareAgain')
              : tConnector('readAndCompare')}
        </button>
      </div>
      {(error || catalogError) && (
        <p className={styles.error} role="alert">
          {error || catalogError}
        </p>
      )}
      <div className={styles.body}>
        {loading ? (
          <div className={styles.state} role="status">
            <SpinnerGap size={17} className="mw-spin" />
            {tConnector('readingActualStructuresForBothObjects')}
          </div>
        ) : comparison ? (
          <SchemaDiffPanel
            key={`${comparison.source.schema}:${comparison.source.table}:${comparison.target.schema}:${comparison.target.table}`}
            provider={provider}
            {...comparison}
            sourceLabel={`${sourceSchema}.${sourceTable}`}
            targetLabel={`${schema}.${table}`}
            onClose={onClose}
          />
        ) : (
          <div className={styles.state}>
            {tConnector('selectAReferenceTableToCompareColumnsIndexesConstraintsAnd')}
          </div>
        )}
      </div>
    </SqlDialog>
  );
}
