'use client';
import { uiText } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './designer.messages';
import { useMemo, useState, type ReactNode } from 'react';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import {
  INDEX_EDIT_LIMITS,
  indexEditDropReason,
  validateIndexEditInput,
  type IndexEditInput,
  type IndexEditKey,
  type IndexEditOptions,
} from '@fouc/shared/index-edit';
import { IndexKeyRow } from './key-row';
import styles from './index-edit.module.css';
export function IndexDesigner({
  options,
  busy,
  onPreview,
  onClose,
  children,
}: {
  options: IndexEditOptions;
  busy: boolean;
  onPreview: (input: IndexEditInput) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const { structure, capabilities, provider } = options;
  const [operation, setOperation] = useState<'create' | 'drop'>('create');
  const [name, setName] = useState('');
  const [unique, setUnique] = useState(false),
    [nullsNotDistinct, setNullsNotDistinct] = useState(false);
  const [columns, setColumns] = useState<IndexEditKey[]>(() =>
    structure.columns.length
      ? [{ column: structure.columns[0].name, direction: 'asc', prefix: null }]
      : [],
  );
  const [include, setInclude] = useState<string[]>([]),
    [drop, setDrop] = useState('');
  const input = useMemo<IndexEditInput>(
    () =>
      operation === 'drop'
        ? { operation, schema: structure.schema, table: structure.table, name: drop }
        : {
            operation,
            schema: structure.schema,
            table: structure.table,
            name,
            unique,
            columns,
            include,
            nullsNotDistinct,
          },
    [
      operation,
      structure.schema,
      structure.table,
      drop,
      name,
      unique,
      columns,
      include,
      nullsNotDistinct,
    ],
  );
  const validation = useMemo(() => {
    try {
      validateIndexEditInput(options, input);
      return '';
    } catch (reason) {
      return reason instanceof Error ? uiText(reason, locale) : String(reason);
    }
  }, [options, input, locale]);
  function update(position: number, patch: Partial<IndexEditKey>) {
    setColumns((current) =>
      current.map((key, index) => (index === position ? { ...key, ...patch } : key)),
    );
  }
  function move(position: number, delta: -1 | 1) {
    setColumns((current) => {
      const next = [...current],
        target = position + delta;
      [next[position], next[target]] = [next[target], next[position]];
      return next;
    });
  }
  const selected = structure.indexes.find((index) => index.name === drop);
  return (
    <>
      <div className={styles.body}>
        <div className={styles.layout}>
          <aside className={styles.inventory} aria-label={tConnector('currentNativeIndexes')}>
            <div className={styles.inventoryHead}>
              <strong>{tConnector('currentIndexes')}</strong>
              <span>{structure.indexes.length}</span>
            </div>
            <div className={styles.indexList}>
              {structure.indexes.map((index) => {
                const reason = indexEditDropReason(provider, index, structure);
                const fields = index.parts
                  .filter((part) => part.role === 'key')
                  .map((part) => part.column ?? part.expression ?? tConnector('nativeExpression'))
                  .join(', ');
                return (
                  <button
                    key={index.name}
                    type="button"
                    disabled={busy || Boolean(reason)}
                    aria-label={tConnector('selectIndexForDeletion', { p0: String(index.name) })}
                    title={
                      reason
                        ? uiText(reason, locale)
                        : tConnector('reviewDeletionOf', { p0: String(index.name) })
                    }
                    aria-pressed={operation === 'drop' && drop === index.name}
                    onClick={() => {
                      setOperation('drop');
                      setDrop(index.name);
                    }}
                  >
                    <span>
                      <strong>{index.name}</strong>
                      <small>
                        {index.primary
                          ? 'PK'
                          : index.unique
                            ? 'UNIQUE'
                            : index.method.toUpperCase()}
                      </small>
                    </span>
                    <code>{fields || tConnector('nativeKeyDefinition')}</code>
                    {reason && <em>{uiText(reason, locale)}</em>}
                  </button>
                );
              })}
              {!structure.indexes.length && (
                <p className={styles.empty}>{tConnector('thisTableHasNoIndexes')}</p>
              )}
            </div>
            <p className={styles.inventoryHint}>
              {tConnector('primaryKeyAndNativeConstraintIndexesAreProtectedSelectA')}
            </p>
          </aside>
          <section className={styles.design} aria-label={tConnector('indexDesign')}>
            <div className={styles.tabs} role="tablist" aria-label={tConnector('indexAction')}>
              <button
                type="button"
                role="tab"
                aria-selected={operation === 'create'}
                disabled={busy}
                onClick={() => setOperation('create')}
              >
                <Plus size={13} />
                {tConnector('createIndex')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={operation === 'drop'}
                disabled={busy}
                onClick={() => setOperation('drop')}
              >
                <Trash size={13} />
                {tConnector('dropIndex')}
              </button>
            </div>
            {operation === 'create' ? (
              <>
                <div className={styles.nameRow}>
                  <label>
                    {tConnector('indexName')}
                    <input
                      aria-label={tConnector('newIndexName')}
                      value={name}
                      autoFocus
                      disabled={busy}
                      placeholder={tConnector('exampleIdxOrdersCreated')}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={unique}
                      disabled={busy}
                      onChange={(event) => {
                        setUnique(event.target.checked);
                        if (!event.target.checked) setNullsNotDistinct(false);
                      }}
                    />
                    {tConnector('uniqueIndex')}
                  </label>
                </div>
                <div className={styles.sectionHead}>
                  <strong>
                    {tConnector('indexKeys')}
                    <small>
                      {columns.length} / {INDEX_EDIT_LIMITS.keys}
                    </small>
                  </strong>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      columns.length >= INDEX_EDIT_LIMITS.keys ||
                      columns.length >= structure.columns.length
                    }
                    onClick={() => {
                      const next = structure.columns.find(
                        (column) =>
                          !columns.some((key) => key.column === column.name) &&
                          !include.includes(column.name),
                      );
                      if (next)
                        setColumns((current) => [
                          ...current,
                          { column: next.name, direction: 'asc', prefix: null },
                        ]);
                    }}
                  >
                    <Plus size={13} />
                    {tConnector('addColumn')}
                  </button>
                </div>
                <div className={styles.keysViewport}>
                  <table className={styles.keys}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{tConnector('actualColumn')}</th>
                        <th>{tConnector('sort')}</th>
                        <th>{tConnector('prefixLength')}</th>
                        <th>{tConnector('orderRemove')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((key, position) => (
                        <IndexKeyRow
                          key={position}
                          position={position}
                          value={key}
                          options={options}
                          selected={columns}
                          include={include}
                          disabled={busy}
                          onChange={(patch) => update(position, patch)}
                          onMove={(delta) => move(position, delta)}
                          onDelete={() =>
                            setColumns((current) =>
                              current.filter((_, index) => index !== position),
                            )
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.hint}>
                  {tConnector('columnOrderDeterminesTheLeadingKeysOfACompositeIndex')}
                  {provider === 'mysql'
                    ? tConnector('textPrefixesCountCharactersAndBinaryPrefixesCountBytesText')
                    : tConnector('indexKeysUseNativeDefaultCollation')}
                </p>
                <div className={styles.advanced}>
                  <label
                    className={styles.check}
                    title={
                      capabilities.nullsNotDistinct
                        ? tConnector('treatMultipleNullsAsEqual')
                        : tConnector('supportedOnlyInPostgresql')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={nullsNotDistinct}
                      disabled={busy || !unique || !capabilities.nullsNotDistinct}
                      onChange={(event) => setNullsNotDistinct(event.target.checked)}
                    />
                    NULLS NOT DISTINCT{' '}
                    <small>
                      {capabilities.nullsNotDistinct
                        ? tConnector('uniqueIndex')
                        : tConnector('currentlyUnsupported')}
                    </small>
                  </label>
                  <strong>
                    INCLUDE{' '}
                    <small>
                      {capabilities.include
                        ? tConnector('storedOnlyExcludedFromUniqueness')
                        : tConnector('unsupportedByTheCurrentNativeVersion')}
                    </small>
                  </strong>
                  {capabilities.include && (
                    <div className={styles.includeFields}>
                      {structure.columns.map((column) => (
                        <label key={column.name} className={styles.check}>
                          <input
                            type="checkbox"
                            checked={include.includes(column.name)}
                            disabled={
                              busy ||
                              columns.some((key) => key.column === column.name) ||
                              (!include.includes(column.name) &&
                                include.length >= INDEX_EDIT_LIMITS.include)
                            }
                            onChange={(event) =>
                              setInclude((current) =>
                                event.target.checked
                                  ? [...current, column.name]
                                  : current.filter((name) => name !== column.name),
                              )
                            }
                          />
                          {column.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.dropForm}>
                <label>
                  {tConnector('standaloneIndexToDrop')}
                  <select
                    aria-label={tConnector('indexToDrop')}
                    value={drop}
                    disabled={busy}
                    onChange={(event) => setDrop(event.target.value)}
                  >
                    <option value="">{tConnector('selectAnIndex')}</option>
                    {structure.indexes.map((index) => (
                      <option
                        key={index.name}
                        disabled={Boolean(indexEditDropReason(provider, index, structure))}
                        value={index.name}
                      >
                        {index.name}
                        {index.primary ? tConnector('primaryKey') : index.unique ? ' · UNIQUE' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <>
                    <div className={styles.dropDetail}>
                      <strong>{selected.name}</strong>
                      <span>
                        {selected.method.toUpperCase()} ·{' '}
                        {selected.unique ? tConnector('unique') : tConnector('nonUnique')}
                      </span>
                      <code>
                        {selected.parts
                          .filter((part) => part.role === 'key')
                          .map(
                            (part) =>
                              `${part.column ?? part.expression ?? tConnector('nativeExpression')}${part.descending ? ' DESC' : ''}`,
                          )
                          .join(', ')}
                      </code>
                    </div>
                    <p className={styles.danger}>
                      <Warning size={16} />
                      {tConnector('deletionIsIrreversibleAndMayReduceQueryPerformanceDroppingA')}
                    </p>
                  </>
                )}
              </div>
            )}
            {validation && (name || drop || options.permission === 'denied') && (
              <p className={styles.validation} role="status">
                <Warning size={14} />
                {validation}
              </p>
            )}
          </section>
        </div>
        <div className={styles.notices}>
          {options.warnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
        {children}
      </div>
      <footer className={styles.footer}>
        <button type="button" onClick={onClose}>
          {tConnector('close')}
        </button>
        <small>{tConnector('ddlIsNotExecutedDuringReview')}</small>
        <span />
        <button
          className={styles.primary}
          type="button"
          disabled={busy || Boolean(validation)}
          onClick={() => void onPreview(input)}
        >
          {busy
            ? tConnector('preparing')
            : operation === 'drop'
              ? tConnector('reviewDangerousDeletion')
              : tConnector('generateDdlForReview')}
        </button>
      </footer>
    </>
  );
}
