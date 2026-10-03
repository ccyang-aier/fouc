'use client';

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
              {matches.length > 0 && <small>同名 {matches.length} 项</small>}
              {outcome && (
                <b data-status={outcome.status}>
                  {
                    {
                      pending: '待处理',
                      saved: '已保存',
                      failed: '失败',
                      skipped: '跳过',
                      cancelled: '已取消',
                    }[outcome.status]
                  }
                </b>
              )}
            </div>
            <p>
              {entry.config.provider === 'sqlite'
                ? entry.config.path
                : `${entry.config.host}:${entry.config.port} · ${entry.config.database} · ${entry.config.username || '默认身份'}`}
            </p>
            {needsFiles && (
              <small className={styles.fileRequired}>
                连接时需重新提供证书文件
              </small>
            )}
            <div className={styles.reviewControls}>
              <select
                aria-label={`第 ${index + 1} 项导入操作`}
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
                          otherIndex !== index &&
                          choices[otherIndex].mode === 'create'
                            ? [
                                {
                                  ...other,
                                  name: (
                                    choices[otherIndex] as Extract<
                                      ImportConnectionChoice,
                                      { mode: 'create' }
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
                <option value="create">新建 / 改名导入</option>
                <option value="skip">跳过此项</option>
                {matches.length > 0 && (
                  <option value="update">替换现有同名配置</option>
                )}
              </select>
              {choice.mode === 'create' && (
                <input
                  aria-label={`第 ${index + 1} 项连接名称`}
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
                  aria-label={`第 ${index + 1} 项更新目标`}
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
                      {match.config.provider === 'sqlite'
                        ? match.config.path
                        : match.config.host}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {choice.mode === 'update' && (
              <p className={styles.warning}>
                确认导入后会替换选定连接的公开配置。
              </p>
            )}
            {outcome?.error && <p className={styles.error}>{outcome.error}</p>}
          </article>
        );
      })}
    </div>
  );
}
