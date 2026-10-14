'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connection-dialog-actions.messages';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { AppAlert } from '@/components/app-alert';
import common from '../relational.module.css';
import styles from './connection-dialog.module.css';
import type { DatabaseConnectionOptionsInput } from '@fouc/shared/connection-options';
export type ConnectionPendingAction = 'test' | 'submit' | null;
export type ConnectionVerification = {
  password: string;
  connectionOptions?: DatabaseConnectionOptionsInput;
};
export function ConnectionDialogActions({
  pending,
  valid,
  feedback,
  testError,
  submitLabel,
  onTest,
  onClose,
}: {
  pending: ConnectionPendingAction;
  valid: boolean;
  feedback: string;
  testError: string;
  submitLabel: string;
  onTest: () => void;
  onClose: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const busy = pending !== null;
  const detail = testError || feedback;
  return (
    <>
      {detail ? (
        <AppAlert
          tone={testError ? 'error' : 'success'}
          title={testError ? tConnector('connectionFailed') : tConnector('testPassed')}
          description={detail}
          className="mx-5 mb-3"
        />
      ) : null}
      <footer className={common.dialogFooter}>
        <div className={styles.testGroup}>
          <button
            type="button"
            className={`fouc-action ${common.secondary}`}
            disabled={busy || !valid}
            aria-busy={pending === 'test'}
            onClick={onTest}
          >
            <ArrowsClockwise
              size={15}
              weight="bold"
              className={pending === 'test' ? styles.spinner : undefined}
            />
            {pending === 'test' ? tConnector('testing') : tConnector('testConnections')}
          </button>
        </div>
        <div className={styles.footerActions}>
          <button
            type="button"
            className={`fouc-action ${common.secondary}`}
            disabled={busy}
            onClick={onClose}
          >
            {tConnector('cancel')}
          </button>
          <button type="submit" className={common.primary} disabled={busy || !valid}>
            {pending === 'submit' ? tConnector('processing') : submitLabel}
          </button>
        </div>
      </footer>
    </>
  );
}
