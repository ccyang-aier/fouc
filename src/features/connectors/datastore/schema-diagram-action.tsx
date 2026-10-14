'use client';
import { uiText, type UiMessage, uiFailure } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './schema-diagram-action.messages';
import { useEffect, useState } from 'react';
import { Graph } from '@phosphor-icons/react';
import type { ErDiagramLoadResult, ErDiagramNode } from '@fouc/shared/er-diagram';
import { backendFetch } from '@/lib/backend';
import { SchemaDiagramPanel } from './diagram';
import styles from './relational.module.css';
export function SchemaDiagramView({
  base,
  schema,
  onOpenTable,
  onOpenQuery,
}: {
  base: string;
  schema: string;
  onOpenTable: (node: ErDiagramNode) => void;
  onOpenQuery: (sql: string) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [result, setResult] = useState<ErDiagramLoadResult | null>(null);
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<ErDiagramLoadResult>(`${base}/diagram`, {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ schema }),
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setResult(value);
          setError('');
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? uiFailure(reason) : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, schema, revision]);
  function refresh() {
    setLoading(true);
    setError('');
    setRevision((value) => value + 1);
  }
  return result ? (
    <SchemaDiagramPanel
      model={result.model}
      title={tConnector('relationshipDiagram', { p0: String(schema) })}
      loading={loading}
      error={error}
      onRefresh={refresh}
      onOpenTable={onOpenTable}
      onOpenQuery={onOpenQuery}
    />
  ) : (
    <div className={styles.empty} role={error ? 'alert' : 'status'}>
      <Graph size={30} />
      <strong>{error || tConnector('readingNativeTableStructureAndForeignKeys')}</strong>
      <span>{tConnector('relationshipsComeFromTheActualDatabaseCatalog')}</span>
      {error && (
        <button type="button" onClick={refresh}>
          {tConnector('reload')}
        </button>
      )}
    </div>
  );
}
