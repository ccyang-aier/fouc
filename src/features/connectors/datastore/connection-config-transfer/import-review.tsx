'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './import-review.messages';
import type { ConnectionConfigBundle } from '@fouc/shared/connection-config-transfer';
import {
  availableTransferName,
  matchingTransferConnections,
  type ExistingTransferConnection,
  type ImportConnectionChoice,
} from '@fouc/shared/connection-config-transfer-plan';
import type { ConnectionImportOutcome } from './operations';
import styles from './transfer.module.css';
export function ConnectionImportReview({
  bundle,
  existing,
  choices,
  onChange,
  disabled,
  outcomes,
}: {
  bundle: ConnectionConfigBundle;
  existing: readonly ExistingTransferConnection[];
  choices: readonly ImportConnectionChoice[];
  onChange: (index: number, choice: ImportConnectionChoice) => void;
  disabled: boolean;
  outcomes: readonly ConnectionImportOutcome[];
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <div className={styles.reviewList}>
      {bundle.connections.map((entry, index) => {
        const matches = matchingTransferConnections(entry, existing),
          choice = choices[index],
          outcome = outcomes[index];
        const needsFiles =
          entry.config.provider !== 'sqlite' &&
          (entry.config.connectionOptions.tls.caRequired ||
            entry.config.connectionOptions.tls.clientCertificateRequired);
        return (
          <article key={index} className={styles.reviewRow}>
            <div className={styles.reviewTitle}>
              <strong>{entry.name}</strong>
              <span>{entry.config.provider}</span>
              {matches.length > 0 && (
                <small>
                  {tConnector('duplicateName')}
                  {matches.length}
                  {tConnector('items')}
                </small>
              )}
              {outcome && (
                <b data-status={outcome.status}>
                  {
                    {
                      pending: tConnector('pending'),
                      saved: tConnector('saved'),
                      failed: tConnector('failed'),
                      skipped: tConnector('skipped'),
                      cancelled: tConnector('cancelled'),
                    }[outcome.status]
                  }
                </b>
              )}
            </div>
            <p>
              {entry.config.provider === 'sqlite'
                ? entry.config.path
                : `${entry.config.host}:${entry.config.port} · ${entry.config.database} · ${entry.config.username || tConnector('defaultIdentity')}`}
            </p>
            {needsFiles && (
              <small className={styles.fileRequired}>
                {tConnector('certificateFilesMustBeProvidedAgainWhenConnecting')}
              </small>
            )}
            <div className={styles.reviewControls}>
              <select
                aria-label={tConnector('importActionForItem', { p0: String(index + 1) })}
                disabled={disabled}
                value={choice.mode}
                onChange={(event) => {
                  const mode = event.target.value;
                  if (mode === 'skip') onChange(index, { mode: 'skip' });
                  else if (mode === 'update')
                    onChange(index, {
                      mode: 'update',
                      targetId: matches[0].id,
                    });
                  else
                    onChange(index, {
                      mode: 'create',
                      name: availableTransferName(entry, [
                        ...existing,
                        ...bundle.connections.flatMap((other, otherIndex) =>
                          otherIndex !== index && choices[otherIndex].mode === 'create'
                            ? [
                                {
                                  ...other,
                                  name: (
                                    choices[otherIndex] as Extract<
                                      ImportConnectionChoice,
                                      {
                                        mode: 'create';
                                      }
                                    >
                                  ).name,
                                },
                              ]
                            : [],
                        ),
                      ]),
                    });
                }}
              >
                <option value="create">{tConnector('createImportWithANewName')}</option>
                <option value="skip">{tConnector('skipThisItem')}</option>
                {matches.length > 0 && (
                  <option value="update">
                    {tConnector('replaceExistingConfigurationWithTheSameName')}
                  </option>
                )}
              </select>
              {choice.mode === 'create' && (
                <input
                  aria-label={tConnector('connectionNameForItem', { p0: String(index + 1) })}
                  value={choice.name}
                  maxLength={120}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(index, {
                      mode: 'create',
                      name: event.target.value,
                    })
                  }
                />
              )}
              {choice.mode === 'update' && (
                <select
                  aria-label={tConnector('updateTargetForItem', { p0: String(index + 1) })}
                  disabled={disabled}
                  value={choice.targetId}
                  onChange={(event) =>
                    onChange(index, {
                      mode: 'update',
                      targetId: event.target.value,
                    })
                  }
                >
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.name} ·{' '}
                      {match.config.provider === 'sqlite' ? match.config.path : match.config.host}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {choice.mode === 'update' && (
              <p className={styles.warning}>
                {tConnector('confirmingTheImportReplacesTheSelectedConnectionSPublicConfiguration')}
              </p>
            )}
            {outcome?.error && <p className={styles.error}>{outcome.error}</p>}
          </article>
        );
      })}
    </div>
  );
}
