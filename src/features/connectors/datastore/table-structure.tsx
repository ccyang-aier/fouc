'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-structure.messages';
import { useEffect, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import {
  ArrowsClockwise,
  Check,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import type { RelationalSession, RelationalTableStructure } from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { StructureMetadata, type StructureTab } from './structure-metadata';
import { SqlEditor } from './sql-editor';
import { IndexEditAction } from './index-edit';
import { ForeignKeyEditAction } from './foreign-key-edit/action';
import styles from './table-structure.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
const tabs = (
  locale?: Locale,
): {
  key: StructureTab;
  label: string;
}[] => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { key: 'columns', label: tConnector('field') },
    { key: 'indexes', label: tConnector('indexes') },
    { key: 'foreignKeys', label: tConnector('foreignKeys') },
    { key: 'constraints', label: tConnector('constraints') },
    { key: 'triggers', label: tConnector('triggers') },
    { key: 'ddl', label: 'DDL' },
  ];
};
const propertyLabels = (locale?: Locale): Record<string, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    owner: tConnector('owner'),
    comment: tConnector('comment'),
    persistence: tConnector('persistenceType'),
    accessMethod: tConnector('accessMethod'),
    tablespace: tConnector('tablespace'),
    options: tConnector('options'),
    engine: tConnector('engine'),
    collation: tConnector('collation'),
    rowFormat: tConnector('rowFormat'),
    withoutRowid: 'WITHOUT ROWID',
    strict: 'STRICT',
    generatedColumns: tConnector('generatedColumn'),
  };
};
export function TableStructure({
  base,
  schema,
  table,
  revision,
  pending,
  initialSearch,
  initialTab = 'columns',
  onOpenTable,
  onStructureChanged,
  onWriteAccessChanged,
  session,
  writable,
  onUnlock,
  onBusyChange,
}: {
  base: string;
  schema: string;
  table: string;
  revision: number;
  pending: boolean;
  initialSearch?: string;
  initialTab?: StructureTab;
  onOpenTable: (schema: string, table: string) => void;
  onStructureChanged?: () => void;
  onWriteAccessChanged?: (session: RelationalSession) => void;
  session: RelationalSession;
  writable: boolean;
  onUnlock: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [structure, setStructure] = useState<RelationalTableStructure | null>(null);
  const [tab, setTab] = useState<StructureTab>(initialTab);
  const [search, setSearch] = useState(initialSearch ?? '');
  const [loadedKey, setLoadedKey] = useState('');
  const [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState(false);
  const [feedbackStored, setFeedback] = useState<UiMessage>('');
  const feedback = uiText(feedbackStored, locale);
  const sourceEditor = useRef<EditorView | null>(null);
  const requestKey = `${base}:${schema}:${table}:${revision}:${reload}`;
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<RelationalTableStructure>(
      `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setStructure(value);
          setError('');
          setLoadedKey(requestKey);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? uiFailure(reason)
              : connectorUiMessages.message('couldNotReadStructure'),
          );
          setLoadedKey(requestKey);
        }
      });
    return () => controller.abort();
  }, [base, schema, table, requestKey]);
  async function copyDdl() {
    if (!structure) return;
    try {
      await navigator.clipboard.writeText(structure.definition.sql);
      setCopied(true);
      setFeedback(connectorUiMessages.message('ddlCopied'));
    } catch {
      setFeedback(connectorUiMessages.message('clipboardUnavailableSelectAndCopyTheDdlManually'));
    }
  }
  function downloadDdl() {
    if (!structure) return;
    const url = URL.createObjectURL(
      new Blob([structure.definition.sql], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${schema}.${table}.sql`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback(connectorUiMessages.message('ddlFileGenerated'));
  }
  return (
    <section className={styles.root} aria-label={tConnector('tableStructureBrowser')}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={tConnector('structureType')}>
          {tabs(locale).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setSearch('');
                setFeedback('');
              }}
            >
              {item.label}
              {structure && item.key !== 'ddl' && <small>{structure[item.key].length}</small>}
            </button>
          ))}
        </div>
        <IndexEditAction
          base={base}
          schema={schema}
          table={table}
          disabled={pending || loading || structure?.kind !== 'table'}
          onWriteAccessChanged={onWriteAccessChanged}
          onChanged={() => {
            setReload((value) => value + 1);
            setFeedback(
              connectorUiMessages.message(
                'refreshRequestedAfterIndexChangesExistingDataWasNotModified',
              ),
            );
            onStructureChanged?.();
          }}
        />
        {tab === 'foreignKeys' && (
          <ForeignKeyEditAction
            base={base}
            provider={session.provider}
            schema={schema}
            table={table}
            writable={writable}
            disabled={pending || loading || structure?.kind !== 'table'}
            onUnlock={onUnlock}
            onBusyChange={onBusyChange}
            onChanged={() => {
              setReload((value) => value + 1);
              setFeedback(
                connectorUiMessages.message(
                  'refreshRequestedAfterForeignKeyChangesReferToTheNative',
                ),
              );
              onStructureChanged?.();
            }}
          />
        )}
        <button
          type="button"
          aria-label={tConnector('refreshTableStructure')}
          disabled={loading || pending}
          onClick={() => {
            setError('');
            setCopied(false);
            setFeedback('');
            setReload((value) => value + 1);
          }}
        >
          <ArrowsClockwise size={14} />
        </button>
      </div>
      {loading ? (
        <p className={styles.empty} role="status">
          {tConnector('readingDatabaseStructure')}
        </p>
      ) : error ? (
        <div className={styles.error} role="alert">
          <strong>{tConnector('unableToReadObjectStructure')}</strong>
          <p>{error}</p>
        </div>
      ) : (
        structure && (
          <>
            <div className={styles.properties}>
              {Object.entries(structure.properties)
                .filter(([, value]) => value !== null && value !== '')
                .map(([key, value]) => (
                  <span key={key}>
                    <small>{propertyLabels(locale)[key] ?? key}</small>
                    {value}
                  </span>
                ))}
            </div>
            {tab === 'ddl' ? (
              <>
                <div className={styles.sourceToolbar}>
                  <span>
                    {structure.definition.origin === 'native'
                      ? tConnector('originalDatabaseDdl')
                      : tConnector('ddlReconstructedFromTheDatabaseCatalog')}
                  </span>
                  <button type="button" onClick={() => void copyDdl()}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? tConnector('copied') : tConnector('copyDdl')}
                  </button>
                  <button type="button" onClick={downloadDdl}>
                    <DownloadSimple size={13} />
                    {tConnector('downloadSql')}
                  </button>
                </div>
                <div className={styles.ddl} role="tabpanel" aria-label={tConnector('objectDdl')}>
                  <SqlEditor
                    value={structure.definition.sql}
                    onChange={() => {}}
                    onRun={() => {}}
                    editorRef={sourceEditor}
                    provider={structure.provider}
                    readOnly
                    label={tConnector('objectDdlSource')}
                  />
                </div>
              </>
            ) : (
              <>
                <label className={styles.search}>
                  <MagnifyingGlass size={13} />
                  <input
                    aria-label={tConnector('searchCurrentStructure')}
                    value={search}
                    placeholder={tConnector('searchByNameColumnOrDefinition')}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div
                  className={styles.content}
                  role="tabpanel"
                  aria-label={tConnector('structure', {
                    p0: String(tabs(locale).find((item) => item.key === tab)?.label),
                  })}
                >
                  <StructureMetadata
                    structure={structure}
                    tab={tab}
                    search={search}
                    pending={pending}
                    onOpenTable={onOpenTable}
                  />
                </div>
              </>
            )}
            <footer className={styles.footer}>
              {structure.definition.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {feedback && <p role="status">{feedback}</p>}
            </footer>
          </>
        )
      )}
    </section>
  );
}
