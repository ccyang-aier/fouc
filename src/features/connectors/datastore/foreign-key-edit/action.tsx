'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useState } from 'react';
import { Link } from '@phosphor-icons/react';
import type { RelationalProvider } from '@fouc/shared';
import { useForeignKeyEdit, type ForeignKeyEditContext } from './use-foreign-key-edit';
import { ForeignKeyDesigner } from './designer';
import { ForeignKeyReview } from './review';
import { SqlDialog } from '../sql-library-dialog';
import styles from './foreign-key-edit.module.css';
interface Props extends ForeignKeyEditContext {
  provider: RelationalProvider;
  disabled: boolean;
}
export function ForeignKeyEditAction(props: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={tConnector('foreignKeyManagement')}
        disabled={props.disabled || props.provider === 'sqlite' || !props.table}
        title={
          props.provider === 'sqlite'
            ? tConnector('changingSqliteForeignKeysRequiresRebuildingTheTableAndIs')
            : tConnector('createAndDropRealForeignKeysReviewDdlFirst')
        }
        onClick={() => setOpen(true)}
      >
        <Link size={14} />
        <span>{tConnector('foreignKeyManagement')}</span>
      </button>
      {open && (
        <ForeignKeyDialog
          key={`${props.base}:${props.schema}:${props.table}`}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
function ForeignKeyDialog({
  base,
  provider,
  schema,
  table,
  writable,
  onUnlock,
  onChanged,
  onBusyChange,
  onClose,
}: Props & {
  onClose: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const model = useForeignKeyEdit({
    base,
    schema,
    table,
    writable,
    onUnlock,
    onChanged,
    onBusyChange,
  });
  const {
    prepared,
    result,
    locked,
    busy,
    error,
    notice,
    options,
    retryOptions,
    edit,
    remaining,
    confirmed,
    commit,
    valid,
    prepare,
  } = model;
  return (
    <SqlDialog
      title={tConnector('foreignKeyManagement')}
      className={styles.dialog}
      busy={locked}
      onClose={onClose}
    >
      <div className={styles.context}>
        <Link size={19} />
        <div>
          <strong>
            {schema}.{table}
          </strong>
          <span>
            {provider === 'mysql' ? 'MySQL · InnoDB' : 'PostgreSQL'} ·{' '}
            {prepared
              ? tConnector('nativeDdlReview')
              : tConnector('actualColumnsAndReferencedKeys')}
          </span>
        </div>
      </div>
      <div className={styles.body}>
        {prepared ? (
          <ForeignKeyReview model={model} provider={provider} writable={writable} />
        ) : (
          <ForeignKeyDesigner model={model} />
        )}
        {(error || notice) && (
          <p className={error ? styles.error : styles.hint} role={error ? 'alert' : 'status'}>
            {error || notice}
            {!options && error && (
              <button type="button" disabled={Boolean(busy)} onClick={retryOptions}>
                {tConnector('reloadCatalog')}
              </button>
            )}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <button type="button" disabled={locked} onClick={onClose}>
          {result ? tConnector('close') : tConnector('cancel')}
        </button>
        <span />
        {prepared && !result && (
          <button type="button" disabled={Boolean(busy)} onClick={() => void edit()}>
            {tConnector('backToEditing')}
          </button>
        )}
        {!prepared ? (
          <button
            type="button"
            className={styles.primary}
            disabled={!options || !valid || Boolean(busy)}
            onClick={() => void prepare()}
          >
            {busy === 'prepare' ? tConnector('readOnlyReview') : tConnector('reviewForeignKeyDdl')}
          </button>
        ) : (
          !result && (
            <button
              type="button"
              className={styles.danger}
              disabled={!confirmed || !writable || !remaining || Boolean(busy)}
              onClick={() => void commit()}
            >
              {busy === 'commit'
                ? tConnector('committingNativeChanges')
                : tConnector('confirmForeignKeyChanges')}
            </button>
          )
        )}
      </footer>
    </SqlDialog>
  );
}
