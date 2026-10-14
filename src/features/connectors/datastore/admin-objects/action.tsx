'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useState } from 'react';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { Package } from '@phosphor-icons/react/dist/csr/Package';
import type { RelationalSession } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import { DatabaseAdminObjectsPanel } from './panel';
import styles from './admin-objects.module.css';
export function DatabaseAdminObjectsAction({
  base,
  session,
  schema,
  disabled,
}: {
  base: string;
  session: RelationalSession;
  schema: string;
  disabled: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  if (session.provider === 'sqlite') return null;
  const mysql = session.provider === 'mysql';
  const title = mysql ? tConnector('mysqlEventCatalog') : tConnector('postgresqlExtensionCatalog');
  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} fouc-action`}
        data-surface="subtle"
        aria-label={tConnector('open', { p0: String(title) })}
        disabled={disabled || (mysql && !schema)}
        onClick={() => setOpen(true)}
      >
        {mysql ? <Clock size={14} /> : <Package size={14} />}
        <span>{mysql ? tConnector('event') : tConnector('extension')}</span>
      </button>
      {open && (
        <SqlDialog title={title} className={styles.dialog} onClose={() => setOpen(false)}>
          <DatabaseAdminObjectsPanel base={base} session={session} schema={schema} />
          <footer className={styles.dialogFooter}>
            <span>{tConnector('currentConnectionReadOnlyNativeCatalog')}</span>
            <button type="button" onClick={() => setOpen(false)}>
              {tConnector('close')}
            </button>
          </footer>
        </SqlDialog>
      )}
    </>
  );
}
