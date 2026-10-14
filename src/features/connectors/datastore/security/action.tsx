'use client';
import { uiText, type UiMessage, createUiMessages } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import type { RelationalSession } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import { DatabasePrincipalDetail } from './detail';
import { useDatabaseSecurity } from './use-security';
import styles from './security.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);

export function DatabaseSecurityAction(props: {
  base: string;
  session: RelationalSession;
  schema: string;
  disabled: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  if (props.session.provider === 'sqlite') return null;
  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} fouc-action`}
        data-surface="subtle"
        disabled={props.disabled}
        aria-label={tConnector('viewDatabaseUsersAndRoles')}
        onClick={() => setOpen(true)}
      >
        <ShieldCheck size={14} />
        <span>{tConnector('usersAndRoles')}</span>
      </button>
      {open && <SecurityDialog key={props.base} {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
function SecurityDialog({
  base,
  session,
  schema,
  onClose,
}: {
  base: string;
  session: RelationalSession;
  schema: string;
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const flow = useDatabaseSecurity(base, schema);
  const [search, setSearch] = useState(''),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const notice = uiText(noticeStored, locale);
  const directory = flow.directory;
  const principal = directory?.principals.find((item) => item.id === flow.principalId);
  const visible =
    directory?.principals.filter((item) =>
      `${item.name} ${item.host ?? ''} ${item.authentication ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  function download() {
    if (!directory) return;
    const blob = new Blob([JSON.stringify({ directory, detail: flow.detail }, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob),
      anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `database-security-${directory.provider}-${directory.capturedAt}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(connectorUiMessages.message('nativeCatalogSnapshotDownloaded'));
  }
  return (
    <SqlDialog
      title={tConnector('databaseUsersAndRoles')}
      className={styles.dialog}
      onClose={onClose}
    >
      <div className={styles.overview}>
        <span className={styles.mark}>
          <ShieldCheck size={21} />
        </span>
        <div>
          <h3>{tConnector('accountAndAccessCatalog')}</h3>
          <p>
            {session.info.productName} · {schema || session.database}
            {tConnector('readOnly')}
          </p>
        </div>
        <button
          type="button"
          disabled={flow.busy || flow.detailBusy}
          aria-label={tConnector('refreshDatabaseUserCatalog')}
          onClick={flow.refresh}
        >
          {flow.busy ? <SpinnerGap size={14} className="mw-spin" /> : <ArrowClockwise size={14} />}
          <span>{tConnector('refresh')}</span>
        </button>
      </div>
      {directory && (
        <div className={styles.identity}>
          <span>
            {tConnector('currentRole')}
            <strong>{directory.identity.current ?? tConnector('unknown')}</strong>
          </span>
          <span>
            {tConnector('authenticated')}
            <strong>{directory.identity.authenticated ?? tConnector('unknown')}</strong>
          </span>
          <span>
            {directory.coverage === 'current-account'
              ? tConnector('onlyTheCurrentAccountIsVisible')
              : tConnector('nativeAccountCatalog')}{' '}
            · {directory.principals.length}
            {directory.principalsTruncated ? '+' : ''}
            {tConnector('items')}
          </span>
        </div>
      )}
      <div className={styles.layout}>
        <aside className={styles.directory}>
          <label className={styles.search}>
            {tConnector('accountCatalog')}
            <input
              aria-label={tConnector('searchDatabaseAccounts')}
              value={search}
              autoFocus
              placeholder={tConnector('accountHostOrAuthenticationMethod')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className={styles.accountList}>
            {flow.busy && (
              <p className={styles.empty} role="status">
                {tConnector('readingTheCurrentConnectionCatalog')}
              </p>
            )}
            {flow.error && (
              <p className={styles.error} role="alert">
                {flow.error}
              </p>
            )}
            {visible.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={flow.principalId === item.id}
                disabled={flow.busy}
                onClick={() => {
                  flow.setPrincipalId(item.id);
                  setNotice('');
                }}
              >
                <span className={styles.accountAvatar}>
                  {item.name.slice(0, 1).toUpperCase() || '@'}
                </span>
                <span>
                  <strong>{item.name || tConnector('anonymousAccount')}</strong>
                  <small>
                    {item.host !== null ? `@${item.host}` : item.flags.login ? 'LOGIN' : 'ROLE'}
                  </small>
                </span>
                {item.flags.superuser && <span className={styles.tag}>SUPER</span>}
                {item.flags.locked && <span className={styles.tag}>{tConnector('locked')}</span>}
              </button>
            ))}
            {directory && !visible.length && !flow.busy && (
              <p className={styles.empty}>{tConnector('noMatchingVisibleAccounts')}</p>
            )}
          </div>
        </aside>
        {principal && directory ? (
          <DatabasePrincipalDetail
            key={principal.id}
            principal={principal}
            directory={directory}
            detail={flow.detail}
            busy={flow.detailBusy}
            error={flow.detailError}
          />
        ) : (
          <section className={styles.detail}>
            <p className={styles.empty}>
              {tConnector('selectAnAccountToViewPublicAttributesRoleRelationshipsAnd')}
            </p>
          </section>
        )}
      </div>
      {directory && (
        <details className={styles.sources}>
          <summary>
            {tConnector('catalogSourceAndPermissionScope')}
            {directory.issues.length
              ? tConnector('itemsWereNotFullyRead', { p0: String(directory.issues.length) })
              : ''}
          </summary>
          {directory.issues.map((issue, index) => (
            <p key={index}>
              {issue.section}：{issue.message}
            </p>
          ))}
          {directory.warnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </details>
      )}
      <footer className={styles.footer}>
        <small role="status">
          {notice ||
            (directory
              ? `${new Date(directory.capturedAt).toLocaleTimeString(locale)} · ${directory.durationMs} ms`
              : tConnector('nativeScopeVisibleToTheCurrentConnection'))}
        </small>
        <button
          type="button"
          disabled={!directory || flow.busy || flow.detailBusy}
          onClick={download}
        >
          <DownloadSimple size={14} />
          {tConnector('downloadCatalogSnapshot')}
        </button>
        <button type="button" onClick={onClose}>
          {tConnector('close')}
        </button>
      </footer>
    </SqlDialog>
  );
}
