'use client';
import { schemaObjectLabel } from '../schema-objects/labels';
import { uiText, type UiMessage, uiFailure } from '../../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './schema-search-action.messages';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Database,
  Hash,
  MagnifyingGlass,
  SpinnerGap,
  Stack,
  Table,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  SCHEMA_OBJECT_KINDS,
  type RelationalSession,
  type SchemaSearchHit,
  type SchemaSearchKind,
  type SchemaSearchResult,
} from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { SqlDialog } from '../sql-library-dialog';
import styles from './schema-search.module.css';
export type SchemaSearchActionProps = {
  base: string;
  session: RelationalSession;
  connectionLabel?: string;
  currentSchema?: string | null;
  disabled?: boolean;
  onOpen: (hit: SchemaSearchHit) => void | Promise<void>;
  onNotice?: (message: string) => void;
};
type SearchState = {
  signature: string;
  status: 'loading' | 'ready' | 'error' | 'cancelled';
  data: SchemaSearchResult | null;
  error: UiMessage | null;
};
const categories = (
  locale?: Locale,
): {
  id: 'all' | 'relations' | 'column' | 'routines';
  label: string;
}[] => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { id: 'all', label: tConnector('allObjects') },
    { id: 'relations', label: tConnector('tablesAndViews') },
    { id: 'column', label: tConnector('field') },
    { id: 'routines', label: tConnector('routinesAndOthers') },
  ];
};
const kindIcon = (kind: SchemaSearchKind) =>
  kind === 'schema'
    ? Database
    : kind === 'column'
      ? Hash
      : kind === 'table' || kind === 'view' || kind === 'materialized-view'
        ? Table
        : Stack;
function Highlight({ hit }: { hit: SchemaSearchHit }) {
  if (hit.match.field !== 'name') return <>{hit.label}</>;
  const indices = new Set(hit.match.indices),
    parts: {
      text: string;
      match: boolean;
    }[] = [];
  for (let index = 0; index < hit.label.length; index++) {
    const match = indices.has(index),
      previous = parts[parts.length - 1];
    if (previous?.match === match) previous.text += hit.label[index];
    else parts.push({ text: hit.label[index], match });
  }
  return (
    <>
      {parts.map((part, index) =>
        part.match ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
      )}
    </>
  );
}
function SchemaSearchDialog({
  base,
  session,
  connectionLabel,
  currentSchema,
  onOpen,
  onNotice,
  onClose,
}: Omit<SchemaSearchActionProps, 'disabled'> & {
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState<ReturnType<typeof categories>[number]['id']>('all'),
    [includeColumns, setIncludeColumns] = useState(false),
    [caseSensitive, setCaseSensitive] = useState(false),
    [schema, setSchema] = useState(''),
    [schemas, setSchemas] = useState<string[]>(currentSchema ? [currentSchema] : []),
    [schemaErrorStored, setSchemaError] = useState<UiMessage | null>(null),
    [schemaRetry, setSchemaRetry] = useState(0);
  const schemaError = schemaErrorStored === null ? null : uiText(schemaErrorStored, locale);
  const [search, setSearch] = useState<SearchState | null>(null),
    [selected, setSelected] = useState(0),
    [retry, setRetry] = useState(0),
    [opening, setOpening] = useState<string | null>(null),
    [openErrorStored, setOpenError] = useState<UiMessage | null>(null);
  const openError = openErrorStored === null ? null : uiText(openErrorStored, locale);
  const request = useRef<AbortController | null>(null),
    generation = useRef(0),
    list = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    alive = useRef(true);
  const columnSearch = category === 'column' || (includeColumns && category === 'all');
  const kindFilter = useMemo(
    () =>
      category === 'relations'
        ? (['table', 'view', 'materialized-view'] as SchemaSearchKind[])
        : category === 'column'
          ? (['column'] as SchemaSearchKind[])
          : category === 'routines'
            ? SCHEMA_OBJECT_KINDS[session.provider].filter(
                (kind) => kind !== 'view' && kind !== 'materialized-view',
              )
            : undefined,
    [category, session.provider],
  );
  const signature = JSON.stringify([
      query.trim(),
      category,
      columnSearch,
      caseSensitive,
      schema,
      retry,
    ]),
    visible = search?.signature === signature ? search : null,
    hits = visible?.status === 'ready' ? (visible.data?.hits ?? []) : [],
    index = Math.min(selected, Math.max(0, hits.length - 1)),
    active = hits[index],
    pending = !!query.trim() && (!visible || visible.status === 'loading');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<string[]>(`${base}/schemas`, { signal: controller.signal })
      .then((values) => {
        if (!controller.signal.aborted) {
          setSchemas([...new Set(values)]);
          setSchemaError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setSchemaError(reason instanceof Error ? uiFailure(reason) : String(reason));
      });
    return () => controller.abort();
  }, [base, schemaRetry]);
  useEffect(() => {
    const sequence = ++generation.current,
      controller = new AbortController();
    request.current = controller;
    if (!query.trim()) return () => controller.abort();
    const timer = window.setTimeout(() => {
      if (sequence !== generation.current || controller.signal.aborted) return;
      setSearch({ signature, status: 'loading', data: null, error: null });
      setSelected(0);
      setOpenError(null);
      void backendFetch<SchemaSearchResult>(`${base}/schema-search`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          query: query.trim(),
          ...(schema ? { schemas: [schema] } : {}),
          ...(kindFilter ? { kinds: kindFilter } : {}),
          includeColumns: columnSearch,
          caseSensitive,
          limit: 200,
        }),
      })
        .then((data) => {
          if (sequence === generation.current && !controller.signal.aborted)
            setSearch({ signature, status: 'ready', data, error: null });
        })
        .catch((reason: unknown) => {
          if (sequence === generation.current && !controller.signal.aborted)
            setSearch({ signature, status: 'error', data: null, error: uiFailure(reason) });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // The signature owns every request parameter; the effect uses one stable request generation.
  }, [base, signature, query, schema, kindFilter, columnSearch, caseSensitive]);
  useEffect(() => {
    list.current
      ?.querySelector(`[data-result-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [index, hits.length]);
  async function open(hit: SchemaSearchHit) {
    if (opening) return;
    setOpening(hit.id);
    setOpenError(null);
    try {
      await onOpen(hit);
      if (alive.current) onClose();
    } catch (reason) {
      if (alive.current) {
        const message = uiFailure(reason);
        setOpenError(message);
        onNotice?.(uiText(message, locale));
      }
    } finally {
      if (alive.current) setOpening(null);
    }
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || opening) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (hits.length)
        setSelected(
          (value) =>
            (Math.min(value, hits.length - 1) +
              (event.key === 'ArrowDown' ? 1 : -1) +
              hits.length) %
            hits.length,
        );
    } else if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setSelected(0);
    } else if (event.key === 'End' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setSelected(Math.max(0, hits.length - 1));
    } else if (event.key === 'Enter' && active) {
      event.preventDefault();
      void open(active);
    }
  }
  function cancel() {
    request.current?.abort();
    generation.current++;
    setSearch({ signature, status: 'cancelled', data: null, error: null });
  }
  const data = visible?.data;
  return (
    <SqlDialog
      title={tConnector('searchCurrentConnection')}
      className={styles.dialog}
      busy={!!opening}
      onClose={onClose}
    >
      <div className={styles.searchBox}>
        <MagnifyingGlass size={20} />
        <input
          ref={input}
          autoFocus
          aria-label={tConnector('searchObjectsOrColumns')}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={hits.length > 0}
          aria-controls="schema-search-results"
          aria-activedescendant={active ? `schema-search-result-${index}` : undefined}
          placeholder={tConnector('objectNameColumnOrSchemaTable')}
          maxLength={256}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
            setOpenError(null);
          }}
          onKeyDown={navigate}
        />
        {query && (
          <button
            title={tConnector('clearSearch')}
            aria-label={tConnector('clearSearch')}
            onClick={() => {
              setQuery('');
              input.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        )}
        {pending && <SpinnerGap size={17} className={styles.spin} />}
      </div>
      <div className={styles.filters}>
        <div className={styles.categories} role="group" aria-label={tConnector('searchCategory')}>
          {categories(locale)
            .filter(
              (item) =>
                item.id !== 'routines' ||
                session.provider !== 'sqlite' ||
                SCHEMA_OBJECT_KINDS.sqlite.includes('trigger'),
            )
            .map((item) => (
              <button
                key={item.id}
                aria-pressed={category === item.id}
                onClick={() => {
                  setCategory(item.id);
                  setSelected(0);
                }}
              >
                {item.label}
              </button>
            ))}
        </div>
        <div className={styles.options}>
          <label className={styles.schemaSelect}>
            {tConnector('scope')}
            <select
              aria-label={tConnector('searchSchemaScope')}
              value={schema}
              onChange={(event) => setSchema(event.target.value)}
            >
              <option value="">{tConnector('allSchemasInTheCurrentConnection')}</option>
              {schema && !schemas.includes(schema) && (
                <option value={schema}>
                  {schema}
                  {tConnector('refreshing')}
                </option>
              )}
              {schemas.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeColumns}
              disabled={category !== 'all'}
              onChange={(event) => setIncludeColumns(event.target.checked)}
            />
            {tConnector('includeColumns')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            {tConnector('caseSensitive')}
          </label>
        </div>
      </div>
      <div className={styles.scope}>
        <Database size={13} />
        <span>
          {connectionLabel ?? session.database ?? tConnector('currentConnection')} ·{' '}
          {session.provider.toUpperCase()}
        </span>
        <small>
          {tConnector('currentSession')}
          {columnSearch
            ? tConnector('columnScanLimitedToRelations')
            : tConnector('objectNamesAndMetadata')}
        </small>
      </div>
      {schemaError && (
        <p className={styles.schemaWarning}>
          <WarningCircle size={13} />
          {tConnector('couldNotReadSchemaScopes')}
          {schemaError}
          <button onClick={() => setSchemaRetry((value) => value + 1)}>
            {tConnector('refreshScope')}
          </button>
        </p>
      )}
      <div
        className={styles.results}
        ref={list}
        id="schema-search-results"
        role="listbox"
        aria-label={tConnector('objectSearchResults')}
        aria-busy={pending}
      >
        {!query.trim() ? (
          <div className={styles.empty}>
            <MagnifyingGlass size={28} />
            <strong>{tConnector('findDatabaseObjectsQuickly')}</strong>
            <p>{tConnector('enterANameInitialAbbreviationOrFullPathSearchReads')}</p>
            <small>{tConnector('forExampleUserProfileUpColumnSearchSupportsTableColumn')}</small>
          </div>
        ) : pending ? (
          <div className={styles.empty} role="status">
            <SpinnerGap size={24} className={styles.spin} />
            <strong>{tConnector('readingMetadata')}</strong>
            <p>
              {columnSearch
                ? tConnector('scanningColumnNamesWithinBoundsChangingCriteriaCancelsTheCurrent')
                : tConnector('scanningSchemasAndObjectCatalogsForTheCurrentConnection')}
            </p>
            <button onClick={cancel}>{tConnector('cancelSearch')}</button>
          </div>
        ) : visible?.status === 'cancelled' ? (
          <div className={styles.empty}>
            <strong>{tConnector('searchCancelled')}</strong>
            <p>{tConnector('incompleteResultsWereDiscardedMetadataReadsAlreadySentMayStill')}</p>
            <button onClick={() => setRetry((value) => value + 1)}>
              {tConnector('searchAgain')}
            </button>
          </div>
        ) : visible?.status === 'error' ? (
          <div className={styles.empty} role="alert">
            <WarningCircle size={26} />
            <strong>{tConnector('searchIncomplete')}</strong>
            <p></p>
            <button onClick={() => setRetry((value) => value + 1)}>
              {tConnector('retrySearch')}
            </button>
          </div>
        ) : !hits.length ? (
          <div className={styles.empty}>
            <MagnifyingGlass size={28} />
            <strong>{tConnector('noMatchesInTheCurrentScanScope')}</strong>
            <p>
              {data?.scope.complete
                ? tConnector('tryAnObjectPrefixWordInitialsAPathOrEnable')
                : tConnector('someCatalogsCouldNotBeReadCheckTheScopeNotice')}
            </p>
          </div>
        ) : (
          hits.map((hit, hitIndex) => {
            const Icon = kindIcon(hit.kind);
            return (
              <div
                key={hit.id}
                id={`schema-search-result-${hitIndex}`}
                data-result-index={hitIndex}
                role="option"
                aria-selected={hitIndex === index}
                className={styles.hit}
                onPointerMove={() => setSelected(hitIndex)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  void open(hit);
                }}
              >
                <div className={styles.hitIcon}>
                  <Icon size={18} />
                </div>
                <div className={styles.hitBody}>
                  <strong>
                    <Highlight hit={hit} />
                    {hit.match.kind === 'exact' && hit.match.field === 'name' && (
                      <i>{tConnector('exactMatch')}</i>
                    )}
                  </strong>
                  <span>
                    {hit.schema}
                    {hit.parentName && ` / ${hit.parentName}`}
                    {hit.dataType && <code>{hit.dataType}</code>}
                    {hit.match.field !== 'name' && (
                      <small>
                        {tConnector('match')}
                        {hit.match.field === 'comment'
                          ? tConnector('comment')
                          : hit.match.field === 'type'
                            ? tConnector('type')
                            : tConnector('path')}
                        ：{hit.match.text}
                      </small>
                    )}
                  </span>
                  {hit.comment && <p title={hit.comment}>{hit.comment}</p>}
                </div>
                <span className={styles.kind}>{schemaObjectLabel(hit.kind, locale)}</span>
                {opening === hit.id ? (
                  <SpinnerGap size={15} className={styles.spin} />
                ) : (
                  hitIndex === index && <ArrowRight size={14} className={styles.openArrow} />
                )}
              </div>
            );
          })
        )}
      </div>
      {data && (!data.scope.complete || data.truncated || data.issues.length > 0) && (
        <details className={styles.issues}>
          <summary>
            <WarningCircle size={13} />
            {!data.scope.complete
              ? tConnector('someScopesWereSkippedOrIncomplete')
              : tConnector('matchesShowingTheFirst', {
                  p0: String(data.totalMatches),
                  p1: String(data.limit),
                })}
            <span>{tConnector('viewScope')}</span>
          </summary>
          <div>
            {data.scope.limits.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {data.issues.map((item, issueIndex) => (
              <p key={issueIndex}>
                <strong>{[item.schema, item.table].filter(Boolean).join(' / ')}</strong> ·{' '}
                {item.operation === 'columns'
                  ? tConnector('field')
                  : item.operation === 'tables'
                    ? tConnector('relationCatalog')
                    : tConnector('nativeObject')}
                ：{item.message}
              </p>
            ))}
          </div>
        </details>
      )}
      {openError && (
        <p role="alert" className={styles.openError}>
          <WarningCircle size={14} />
          {openError}
        </p>
      )}
      <footer className={styles.footer}>
        <span>
          {data
            ? tConnector('itemsSchemasMs', {
                p0: String(hits.length),
                p1: String(data.scope.schemas.length),
                p2: String(data.scope.schemasTotal),
                p3: String(
                  columnSearch
                    ? tConnector('relationColumns', {
                        p0: String(data.scope.columnTablesScanned),
                        p1: String(data.scope.columnTablesTotal),
                      })
                    : '',
                ),
                p4: String(data.elapsedMs),
              })
            : tConnector('currentConnectionOnlyDisconnectedServersAreNotSearched')}
        </span>
        <div>
          <kbd>
            <ArrowUp size={10} />
            <ArrowDown size={10} />
          </kbd>
          <small>{tConnector('select')}</small>
          <kbd>Enter</kbd>
          <small>{tConnector('open')}</small>
          <button disabled={!active || !!opening} onClick={() => active && void open(active)}>
            {opening ? tConnector('locating') : tConnector('openObject')}
            <ArrowRight size={12} />
          </button>
        </div>
      </footer>
    </SqlDialog>
  );
}
export function SchemaSearchAction(props: SchemaSearchActionProps) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={tConnector('searchObjects')}
        title={tConnector('searchObjects')}
        className={`${styles.trigger} fouc-action`}
        data-surface="subtle"
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        <MagnifyingGlass size={14} />
        <span>{tConnector('searchObjects')}</span>
      </button>
      {open && (
        <SchemaSearchDialog key={`${props.session.id}`} {...props} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
