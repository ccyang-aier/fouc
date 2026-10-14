'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './save-preview-dialog.messages';
import { useEffect, useRef } from 'react';
import { X, FileCode } from '@phosphor-icons/react';
import type { RelationalSavePreview } from '@fouc/shared';
import styles from './table-editing.module.css';
import common from './relational.module.css';
export function SavePreviewDialog({
  preview,
  busy,
  error,
  onClose,
  onCommit,
}: {
  preview: RelationalSavePreview;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCommit: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`${common.dialog} ${styles.previewDialog}`}
      aria-labelledby="save-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className={common.dialogHead}>
        <div>
          <FileCode size={18} />
          <h2 id="save-preview-title">{tConnector('confirmDatabaseChanges')}</h2>
        </div>
        <button
          type="button"
          aria-label={tConnector('closeChangePreview')}
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className={styles.previewBody}>
        <div className={styles.summary}>
          <strong>
            {preview.schema}.{preview.table}
          </strong>
          <span>
            {preview.statements.length}
            {tConnector('changesOneTransaction')}
          </span>
        </div>
        <p className={common.hint}>
          {tConnector('confirmationCommitsAllChangesIfATargetRecordChangedOr')}
        </p>
        {preview.statements.map((statement, index) => (
          <article className={styles.statement} key={index}>
            <header>
              <b>{index + 1}</b>
              <span>
                {statement.kind === 'insert'
                  ? tConnector('added')
                  : statement.kind === 'update'
                    ? tConnector('modified')
                    : tConnector('delete')}
              </span>
            </header>
            <pre>{statement.sql}</pre>
            <small>{tConnector('boundParameters')}</small>
            <pre>{JSON.stringify(statement.parameters, null, 2)}</pre>
          </article>
        ))}
        {error && (
          <p role="alert" className={common.error}>
            {error}
          </p>
        )}
        {busy && (
          <p role="status" className={common.hint}>
            {tConnector('committingTransactionWaitForTheResult')}
          </p>
        )}
      </div>
      <footer className={common.dialogFooter}>
        <button type="button" className={common.secondary} disabled={busy} onClick={onClose}>
          {error ? tConnector('backToEditing') : tConnector('cancel')}
        </button>
        <span />
        <button
          type="button"
          className={common.primary}
          disabled={busy || Boolean(error)}
          onClick={onCommit}
        >
          {busy ? tConnector('committing') : tConnector('confirmCommit')}
        </button>
      </footer>
    </dialog>
  );
}
