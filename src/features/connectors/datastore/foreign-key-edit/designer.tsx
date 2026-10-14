'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './designer.messages';
import { Plus, Trash, CircleNotch } from '@phosphor-icons/react';
import { FOREIGN_KEY_ACTIONS } from '@fouc/shared/foreign-key-edit';
import type { ForeignKeyEditModel } from './use-foreign-key-edit';
import styles from './foreign-key-edit.module.css';
export function ForeignKeyDesigner({ model }: { model: ForeignKeyEditModel }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const {
    kind,
    setKind,
    busy,
    options,
    error,
    name,
    setName,
    referenceSchema,
    referenceTable,
    target,
    resetReference,
    referenceKey,
    setReferenceKey,
    setLocals,
    selectedKey,
    locals,
    onDelete,
    setOnDelete,
    onUpdate,
    setOnUpdate,
    dropName,
    setDropName,
    dropped,
    targetError,
  } = model;
  return (
    <>
      <div className={styles.mode}>
        <button
          type="button"
          aria-pressed={kind === 'create'}
          disabled={Boolean(busy)}
          onClick={() => setKind('create')}
        >
          <Plus size={14} />
          {tConnector('createForeignKey')}
        </button>
        <button
          type="button"
          aria-pressed={kind === 'drop'}
          disabled={Boolean(busy)}
          onClick={() => setKind('drop')}
        >
          <Trash size={14} />
          {tConnector('dropForeignKey')}
          <small>{options?.foreignKeys.length ?? 0}</small>
        </button>
      </div>
      {!options && !error && (
        <p role="status" className={styles.hint}>
          <CircleNotch size={14} className="mw-spin" />
          {tConnector('readingTheTableSNativeCatalog')}
        </p>
      )}
      {options && kind === 'create' && (
        <>
          <label className={styles.field}>
            {tConnector('foreignKeyName')}
            <input
              aria-label={tConnector('newForeignKeyName')}
              value={name}
              disabled={Boolean(busy)}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
            />
          </label>
          <div className={styles.fields}>
            <label className={styles.field}>
              {tConnector('referencedCatalog')}
              <select
                aria-label={tConnector('foreignKeyReferenceCatalog')}
                value={referenceSchema}
                disabled={Boolean(busy)}
                onChange={(event) => resetReference(event.target.value, '')}
              >
                {options.schemas.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              {tConnector('referencedTable')}
              <select
                aria-label={tConnector('foreignKeyReferenceTable')}
                value={referenceTable}
                disabled={Boolean(busy) || !target}
                onChange={(event) => resetReference(referenceSchema, event.target.value)}
              >
                <option value="">{tConnector('selectAnActualTable')}</option>
                {target?.tables.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.field}>
            {tConnector('completeReferencedUniqueKey')}
            <select
              aria-label={tConnector('foreignKeyReferencedUniqueKey')}
              value={referenceKey}
              disabled={Boolean(busy) || !referenceTable || !target}
              onChange={(event) => {
                const key = target?.keys.find((item) => item.name === event.target.value);
                setReferenceKey(event.target.value);
                setLocals(key?.columns.map(() => '') ?? []);
              }}
            >
              <option value="">{tConnector('selectAUniquePrimaryKey')}</option>
              {target?.keys.map((key) => (
                <option key={key.name} value={key.name}>
                  {key.name} · {key.columns.join(', ')}
                </option>
              ))}
            </select>
          </label>
          {referenceTable && target && !target.keys.length && (
            <p className={styles.hint}>
              {tConnector('theReferencedTableHasNoSupportedCompleteValidNonDeferred')}
            </p>
          )}
          {selectedKey && (
            <div className={styles.mapping}>
              <header>
                <strong>{tConnector('columnMapping')}</strong>
                <span>{tConnector('compositeKeysFollowNativeCatalogOrder')}</span>
              </header>
              {selectedKey.columns.map((column, index) => (
                <div className={styles.pair} key={column}>
                  <small>{index + 1}</small>
                  <select
                    aria-label={tConnector('localColumn', { p0: String(index + 1) })}
                    value={locals[index] ?? ''}
                    disabled={Boolean(busy)}
                    onChange={(event) =>
                      setLocals((current) =>
                        current.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      )
                    }
                  >
                    <option value="">{tConnector('selectALocalColumn')}</option>
                    {options.columns.map((item) => (
                      <option value={item.name} key={item.name}>
                        {item.name} · {item.dataType}
                      </option>
                    ))}
                  </select>
                  <span>→</span>
                  <div>
                    <code>{column}</code>
                    <small>{target?.columns.find((item) => item.name === column)?.dataType}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={styles.fields}>
            <label className={styles.field}>
              ON DELETE
              <select
                aria-label={tConnector('foreignKeyDeleteAction')}
                value={onDelete}
                disabled={Boolean(busy)}
                onChange={(event) => setOnDelete(event.target.value as typeof onDelete)}
              >
                {FOREIGN_KEY_ACTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              ON UPDATE
              <select
                aria-label={tConnector('foreignKeyUpdateAction')}
                value={onUpdate}
                disabled={Boolean(busy)}
                onChange={(event) => setOnUpdate(event.target.value as typeof onUpdate)}
              >
                {FOREIGN_KEY_ACTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {options && kind === 'drop' && (
        <>
          <label className={styles.field}>
            {tConnector('actualForeignKey')}
            <select
              aria-label={tConnector('foreignKeyToDrop')}
              value={dropName}
              disabled={Boolean(busy)}
              onChange={(event) => setDropName(event.target.value)}
            >
              <option value="">{tConnector('selectAnExistingForeignKey')}</option>
              {options.foreignKeys
                .filter((key) => key.nameSource === 'catalog')
                .map((key) => (
                  <option key={key.name}>{key.name}</option>
                ))}
            </select>
          </label>
          {dropped && (
            <div className={styles.existing}>
              <strong>{dropped.name}</strong>
              <code>
                {dropped.columns.join(', ')} → {dropped.referencedSchema}.{dropped.referencedTable}{' '}
                ({dropped.referencedColumns.join(', ')})
              </code>
              <small>
                ON DELETE {dropped.onDelete} · ON UPDATE {dropped.onUpdate}
              </small>
            </div>
          )}
          {!options.foreignKeys.length && (
            <p className={styles.hint}>{tConnector('thisTableHasNoExistingForeignKeys')}</p>
          )}
        </>
      )}
      {targetError && kind === 'create' && (
        <p role="alert" className={styles.error}>
          {targetError}
        </p>
      )}
      {options?.warnings.map((warning) => (
        <p className={styles.hint} key={warning}>
          {warning}
        </p>
      ))}
    </>
  );
}
