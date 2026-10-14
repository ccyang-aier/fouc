import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './selection-dock.messages';
import { CheckCircle, SpinnerGap, Tag, Trash, X } from '@phosphor-icons/react';
import type { ConnectionBatchProgress, ConnectionBatchResult } from './batch';
import { uiText } from '../../i18n/ui-message';
import styles from './selection-dock.module.css';
const actionNames = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    tags: tConnector('updateTags'),
    delete: tConnector('delete'),
    test: tConnector('connectionTest'),
  };
};
export function ConnectionSelectionDock({
  count,
  progress,
  result,
  onTags,
  onTest,
  onDelete,
  onClear,
  onDismiss,
}: {
  count: number;
  progress: ConnectionBatchProgress | null;
  result: ConnectionBatchResult | null;
  onTags: () => void;
  onTest: () => void;
  onDelete: () => void;
  onClear: () => void;
  onDismiss: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  if (!count && !result && !progress) return null;
  return (
    <div className={styles.host}>
      <div className={styles.dock} role="region" aria-label={tConnector('bulkConnectionActions')}>
        {count > 0 && (
          <>
            <strong className={styles.count}>{tConnector('selectedCount', { count })}</strong>
            <span className={styles.divider} aria-hidden />
            <div className={styles.actions} role="group" aria-label={tConnector('bulkActions')}>
              <button
                type="button"
                className="fouc-action"
                disabled={Boolean(progress)}
                onClick={onTags}
              >
                <Tag size={16} weight="bold" />
                {tConnector('addTags')}
              </button>
              <button
                type="button"
                className="fouc-action"
                disabled={Boolean(progress)}
                onClick={onTest}
              >
                <CheckCircle size={16} weight="bold" />
                {tConnector('testConnections')}
              </button>
              <button
                type="button"
                className={`fouc-action ${styles.danger}`}
                data-variant="destructive"
                disabled={Boolean(progress)}
                onClick={onDelete}
              >
                <Trash size={16} weight="bold" />
                {tConnector('delete')}
              </button>
            </div>
            <button
              type="button"
              className={`fouc-action ${styles.close}`}
              aria-label={tConnector('clearConnectionSelection')}
              title={tConnector('clearSelection')}
              disabled={Boolean(progress)}
              onClick={onClear}
            >
              <X size={15} weight="bold" />
            </button>
          </>
        )}
        <div className={styles.feedback} aria-live="polite" aria-atomic="true">
          {progress ? (
            <span>
              <SpinnerGap className={styles.spinner} size={15} />
              {actionNames(locale)[progress.action]} {progress.completed} / {progress.total}
            </span>
          ) : (
            result && (
              <>
                <span data-failed={result.failed.length > 0}>
                  {tConnector('completedSummary', {
                    action: actionNames(locale)[result.action],
                    count: result.succeeded.length,
                  })}
                  {result.failed.length > 0 &&
                    tConnector('failed', { p0: String(result.failed.length) })}
                </span>
                {result.failed.length > 0 && (
                  <details>
                    <summary>{tConnector('viewFailures')}</summary>
                    <ul>
                      {result.failed.map((item) => (
                        <li key={item.id}>
                          <strong>{item.name}</strong>
                          <span>{uiText(item.message, locale)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <button
                  type="button"
                  className={`fouc-action ${styles.close}`}
                  aria-label={tConnector('closeBulkActionResults')}
                  onClick={onDismiss}
                >
                  <X size={14} />
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
