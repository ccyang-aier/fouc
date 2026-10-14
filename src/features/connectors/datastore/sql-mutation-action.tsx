'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-mutation-action.messages';
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { ShieldCheck } from '@phosphor-icons/react';
import { resolveSqlExecutionTarget, type RelationalSession } from '@fouc/shared';
import type {
  SqlMutationCommitResult,
  SqlMutationInput,
  SqlMutationPrepared,
} from '@fouc/shared/sql-mutation';
import { backendFetch } from '@/lib/backend';
import { SqlMutationPanel } from './sql-mutation';
import { SqlDialog } from './sql-library-dialog';
import styles from './sql-mutation-action.module.css';
interface Props {
  actionRef?: RefObject<{
    open: () => void;
  } | null>;
  showTrigger?: boolean;
  base: string;
  session: RelationalSession;
  schema: string;
  editorRef: RefObject<EditorView | null>;
  disabled: boolean;
  contextIssue: string;
  onNotice: (message: string) => void;
  onUnlock: () => Promise<void>;
  onCommitted: () => void;
  onBusyChange: (busy: boolean) => void;
}
export function SqlMutationAction(props: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [target, setTarget] = useState<{
    sql: string;
    schema: string;
  } | null>(null);
  function open(): void {
    if (props.contextIssue) {
      props.onNotice(props.contextIssue);
      return;
    }
    const view = props.editorRef.current;
    if (!view || props.disabled) return;
    const statement = resolveSqlExecutionTarget(
      view.state.doc.toString(),
      props.session.provider,
      'current',
      view.state.selection.main,
    );
    if (!statement) {
      props.onNotice(tConnector('selectOneInsertUpdateOrDeleteStatementToReview'));
      return;
    }
    setTarget({ sql: statement.sql, schema: props.schema });
  }
  function close(): void {
    setTarget(null);
    props.editorRef.current?.focus();
  }
  useImperativeHandle(props.actionRef, () => ({ open }));
  return (
    <>
      {props.showTrigger !== false && (
        <button
          type="button"
          className="fouc-action"
          aria-label={tConnector('sqlChangePreview')}
          title={tConnector('readOnlyReviewOfTheSelectionOrCurrentWriteOperation')}
          disabled={props.disabled}
          onClick={open}
        >
          <ShieldCheck size={16} />
          <span>{tConnector('changePreview')}</span>
        </button>
      )}
      {target && <MutationDialog {...props} {...target} onClose={close} />}
    </>
  );
}
function MutationDialog({
  base,
  session,
  sql,
  schema,
  onUnlock,
  onCommitted,
  onBusyChange,
  onClose,
}: Props & {
  sql: string;
  onClose: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const busyHandler = useRef(onBusyChange);
  useEffect(() => {
    busyHandler.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      busyHandler.current(false);
    };
  }, []);
  async function perform<T>(operation: () => Promise<T>): Promise<T> {
    setBusy(true);
    busyHandler.current(true);
    try {
      return await operation();
    } finally {
      if (live.current) setBusy(false);
      busyHandler.current(false);
    }
  }
  const plans = `${base}/sql-mutation/plans`;
  const writable =
    session.capabilities.capabilities.tableDataEdit && !session.capabilities.restrictions.readOnly;
  return (
    <SqlDialog
      title={tConnector('sqlChangePreview')}
      busy={busy}
      className={styles.dialog}
      onClose={onClose}
    >
      <div className={styles.body}>
        <SqlMutationPanel
          sessionId={session.id}
          provider={session.provider}
          schema={schema}
          sql={sql}
          writable={writable}
          onPreview={(input: SqlMutationInput, control) =>
            perform(() =>
              backendFetch<SqlMutationPrepared>(plans, {
                method: 'POST',
                body: JSON.stringify(input),
                signal: control.signal,
              }),
            )
          }
          onCommit={(planId, control) =>
            perform(() =>
              backendFetch<SqlMutationCommitResult>(
                `${plans}/${encodeURIComponent(planId)}/commit`,
                {
                  method: 'POST',
                  body: JSON.stringify({ confirm: true }),
                  signal: control.signal,
                },
              ),
            )
          }
          onDiscard={async (planId) => {
            await backendFetch(`${plans}/${encodeURIComponent(planId)}`, {
              method: 'DELETE',
            }).catch(() => undefined);
          }}
          onUnlock={() => perform(onUnlock)}
          onCommitted={onCommitted}
        />
      </div>
    </SqlDialog>
  );
}
