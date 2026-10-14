'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connection-directory.messages';
import { useEffect, useRef, useState } from 'react';
import type {
  RelationalConnectionConfig,
  RelationalSavedConnection,
  RelationalSession,
  RedisConnectionConfig,
  RedisSavedConnection,
  RedisSession,
} from '@fouc/shared';
import type { MongoConnectionConfig, MongoSavedConnection } from '@fouc/shared/mongo-connections';
import type { MongoSession } from '@fouc/shared/mongo';
import type { DatabaseConnectionOptionsInput } from '@fouc/shared/connection-options';
import { resolveConnectionOptions } from '@fouc/shared/connection-options';
import type { ConnectionDirectoryMetadata } from '@fouc/shared/connection-directory';
import { backendFetch, BackendRequestError } from '@/lib/backend';
import type { ConnectionVerification } from './connection-options/connection-dialog-actions';
import { useProjectResources } from '@/features/project/project-resources';
import { RelationalDialog } from './relational-dialog';
import { RelationalWorkbench } from './relational-workbench';
import { forgetSqlDrafts } from './use-sql-drafts';
import { RedisDialog } from '../redis/redis-dialog';
import { RedisWorkbench } from '../redis/redis-workbench';
import { MongoWorkbench } from '../mongo';
import { MongoDialog } from '../mongo/mongo-dialog';
import { ConnectionConfigTransferActions } from './connection-config-transfer';
import { ConnectionList } from './connection-list/connection-list';
import type { ConnectionListRow } from './connection-list/types';
import {
  connectionListRow,
  directoryProviders,
  type DatastoreProvider,
  type SavedDatastoreConnection,
} from './connection-list/provider-model';
import { ConnectionTagsDialog } from './connection-list/tag-dialog';
import {
  ConnectionBatchTestDialog,
  type ConnectionTestCredentials,
} from './connection-list/test-dialog';
import { ConnectionDeleteDialog } from './connection-list/delete-dialog';
import {
  appendConnectionTags,
  runConnectionBatch,
  type ConnectionBatchAction,
  type ConnectionBatchProgress,
  type ConnectionBatchResult,
} from './connection-list/batch';
const connectorUiMessages = createUiMessages(connectorMessages);
type Session = RelationalSession | RedisSession | MongoSession;
type Props = {
  provider: DatastoreProvider;
  onBack: () => void;
  onOpenProject: (id: string) => void;
  onWorkbenchFocus?: () => void;
};
export function DatastoreConnections(props: Props) {
  const { projects } = useProjectResources();
  const { onWorkbenchFocus } = props;
  useEffect(() => {
    if (window.matchMedia('(max-width: 760px)').matches) onWorkbenchFocus?.();
  }, [onWorkbenchFocus]);
  return <ConnectionDirectory key={props.provider} {...props} projects={projects} />;
}
function ConnectionDirectory({
  provider,
  onBack,
  onOpenProject,
  onWorkbenchFocus,
  projects,
}: Props & {
  projects: {
    id: string;
    name: string;
  }[];
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const descriptor = directoryProviders(locale)[provider];
  const base = `/api/database/${descriptor.family}`;
  const [connections, setConnections] = useState<SavedDatastoreConnection[]>([]);
  const [loading, setLoading] = useState(true),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const [revision, setRevision] = useState(0),
    [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{
    connection?: SavedDatastoreConnection;
    error?: string;
  } | null>(null);
  const [tagConnection, setTagConnection] = useState<SavedDatastoreConnection | null>(null);
  const [removing, setRemoving] = useState<SavedDatastoreConnection | null>(null);
  const [batchDialog, setBatchDialog] = useState<{
    action: ConnectionBatchAction;
    connections: SavedDatastoreConnection[];
  } | null>(null);
  const [batchProgress, setBatchProgress] = useState<ConnectionBatchProgress | null>(null);
  const [batchResult, setBatchResult] = useState<ConnectionBatchResult | null>(null);
  const batchRunning = useRef(false);
  const [busy, setBusy] = useState(false),
    [pendingIds, setPendingIds] = useState<string[]>([]),
    [testingId, setTestingId] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const opening = useRef(false);
  const [active, setActive] = useState<{
    connection: SavedDatastoreConnection;
    session: Session;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<SavedDatastoreConnection[]>(`${base}/connections`, {
      signal: controller.signal,
    })
      .then((items) => {
        if (!controller.signal.aborted) {
          setConnections(items);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? uiFailure(cause)
              : connectorUiMessages.message('couldNotReadConnections'),
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [base, revision]);
  const activeSessionId = active?.session.id;
  useEffect(() => {
    if (!activeSessionId) return;
    return () => {
      void backendFetch(`${base}/sessions/${activeSessionId}`, { method: 'DELETE' }).catch(
        () => undefined,
      );
    };
  }, [activeSessionId, base]);
  function replace(item: SavedDatastoreConnection) {
    if (mounted.current)
      setConnections((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
  }
  async function save(
    name: string,
    config: RelationalConnectionConfig | RedisConnectionConfig | MongoConnectionConfig,
    verification?: ConnectionVerification,
  ) {
    const id = dialog?.connection?.id;
    const item = await backendFetch<SavedDatastoreConnection>(
      `${base}/connections${id ? `/${id}` : ''}`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify({ name, config }) },
    );
    if (mounted.current)
      setConnections((current) => [...current.filter((entry) => entry.id !== item.id), item]);
    if (verification)
      await connect(item, verification.password, verification.connectionOptions, false);
    if (mounted.current) setDialog(null);
  }
  async function connect(
    connection: SavedDatastoreConnection,
    password: string | undefined,
    connectionOptions: DatabaseConnectionOptionsInput | undefined,
    open: boolean,
  ) {
    setTestingId(connection.id);
    const annotate = (kind: 'passed' | 'failed') => {
      if (mounted.current)
        setConnections((current) =>
          current.map((entry) =>
            entry.id === connection.id &&
            JSON.stringify(entry.config) === JSON.stringify(connection.config)
              ? { ...entry, status: { kind, checkedAt: Date.now() } }
              : entry,
          ),
        );
    };
    let session: Session;
    try {
      session = await backendFetch<Session>(`${base}/connections/${connection.id}/connect`, {
        method: 'POST',
        body: JSON.stringify({ password, connectionOptions }),
      });
    } catch (cause) {
      if (!(
        cause instanceof BackendRequestError && cause.code === 'connection_credentials_required'
      ))
        annotate('failed');
      throw cause;
    } finally {
      if (mounted.current) setTestingId(null);
    }
    annotate('passed');
    if (!open || !mounted.current) {
      await backendFetch(`${base}/sessions/${session.id}`, { method: 'DELETE' });
    }
    if (mounted.current) {
      if (open) {
        setSelection([]);
        setDialog(null);
        setActive({ connection, session });
        onWorkbenchFocus?.();
      }
    }
  }
  async function openConnection(row: ConnectionListRow) {
    const connection = connections.find((entry) => entry.id === row.id);
    if (!connection) return;
    if (row.status !== 'passed') {
      setDialog({ connection });
      return;
    }
    if (opening.current || testingId !== null) return;
    opening.current = true;
    setError('');
    try {
      await connect(connection, undefined, undefined, true);
    } catch (cause) {
      if (mounted.current)
        setDialog({
          connection,
          error:
            cause instanceof Error
              ? uiText(cause, locale)
              : tConnector('connectionFailedEditItAndTestAgain'),
        });
    } finally {
      opening.current = false;
    }
  }
  async function patchDirectory(id: string, metadata: Partial<ConnectionDirectoryMetadata>) {
    if (pending.current.has(id))
      throw connectorUiMessages.error('thisConnectionIsBeingSavedTryAgainShortly');
    pending.current.add(id);
    setPendingIds([...pending.current]);
    try {
      replace(
        await backendFetch<SavedDatastoreConnection>(`${base}/connections/${id}/directory`, {
          method: 'PATCH',
          body: JSON.stringify(metadata),
        }),
      );
    } finally {
      pending.current.delete(id);
      if (mounted.current) setPendingIds([...pending.current]);
    }
  }
  async function removeConnection(connection: SavedDatastoreConnection) {
    await backendFetch(`${base}/connections/${connection.id}`, { method: 'DELETE' });
    if (provider !== 'redis' && provider !== 'mongodb')
      forgetSqlDrafts(`${base}/connections/${connection.id}`);
    if (mounted.current) {
      setConnections((items) => items.filter((item) => item.id !== connection.id));
      setSelection((ids) => ids.filter((id) => id !== connection.id));
    }
  }
  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setError('');
    try {
      await removeConnection(removing);
      if (mounted.current) setRemoving(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? uiFailure(cause) : connectorUiMessages.message('couldNotDelete'),
      );
    } finally {
      setBusy(false);
    }
  }
  function beginBatch(action: ConnectionBatchAction, ids: readonly string[]) {
    if (batchRunning.current || busy || pending.current.size) return;
    const chosen = connections.filter(
      (connection) => connection.config.provider === provider && ids.includes(connection.id),
    );
    if (chosen.length) {
      setBatchResult(null);
      setBatchDialog({ action, connections: chosen });
    }
  }
  async function batch(
    action: ConnectionBatchAction,
    perform: (connection: SavedDatastoreConnection) => Promise<unknown>,
  ) {
    if (!batchDialog || batchRunning.current) return;
    batchRunning.current = true;
    setError('');
    setBatchResult(null);
    setBatchProgress({ action, completed: 0, total: batchDialog.connections.length });
    try {
      const result = await runConnectionBatch(
        batchDialog.connections,
        action,
        perform,
        setBatchProgress,
        () => mounted.current,
      );
      if (mounted.current) setBatchResult(result);
    } finally {
      batchRunning.current = false;
      if (mounted.current) setBatchProgress(null);
    }
  }
  async function batchTags(tags: string[]) {
    const updates = new Map(
      batchDialog!.connections.map((connection) => {
        try {
          return [
            connection.id,
            appendConnectionTags(connection.directory?.tags ?? [], tags),
          ] as const;
        } catch (cause) {
          throw connectorUiMessages.error('tagUpdateFailure', {
            name: connection.name,
            cause:
              cause instanceof Error
                ? uiFailure(cause)
                : connectorUiMessages.message('invalidTags'),
          });
        }
      }),
    );
    await batch('tags', (connection) =>
      patchDirectory(connection.id, { tags: updates.get(connection.id)! }),
    );
  }
  async function batchTests(credentials: ReadonlyMap<string, ConnectionTestCredentials>) {
    await batch('test', (connection) => {
      const input = credentials.get(connection.id)!;
      const options =
        connection.config.provider === 'sqlite'
          ? undefined
          : resolveConnectionOptions(connection.config.provider, input.options);
      return connect(connection, input.password, options, false);
    });
  }
  if (active?.session.provider === 'redis')
    return (
      <RedisWorkbench
        key={active.session.id}
        session={active.session}
        name={active.connection.name}
        onBack={() => setActive(null)}
        onSessionChange={(session) => setActive({ connection: active.connection, session })}
      />
    );
  if (active?.session.provider === 'mongodb')
    return (
      <MongoWorkbench
        key={active.session.id}
        session={active.session}
        name={active.connection.name}
        onBack={() => setActive(null)}
        onSessionChange={(session) => setActive({ connection: active.connection, session })}
      />
    );
  if (active)
    return (
      <RelationalWorkbench
        key={active.session.id}
        session={active.session}
        name={active.connection.name}
        onBack={() => setActive(null)}
      />
    );
  const get = (id: string) => connections.find((entry) => entry.id === id);
  return (
    <>
      <ConnectionList
        label={descriptor.label}
        targetLabel={descriptor.targetLabel}
        accountLabel={descriptor.accountLabel}
        authSourceLabel={descriptor.authSourceLabel}
        scopeKey={provider}
        rows={connections
          .filter((entry) => entry.config.provider === provider)
          .map((entry) => connectionListRow(entry, testingId === entry.id, locale))}
        projects={projects}
        loading={loading}
        error={error}
        pendingIds={pendingIds}
        selectedIds={selection}
        batchProgress={batchProgress}
        batchResult={batchResult}
        headerActions={
          <ConnectionConfigTransferActions
            provider={provider}
            connections={connections}
            selectedIds={selection}
            disabled={loading || busy || Boolean(batchProgress)}
            onImported={() => setRevision((value) => value + 1)}
          />
        }
        onBack={onBack}
        onCreate={() => setDialog({})}
        onRetry={() => {
          setError('');
          setLoading(true);
          setRevision((value) => value + 1);
        }}
        onOpen={(row) => {
          void openConnection(row);
        }}
        onEdit={(row) => setDialog({ connection: get(row.id) })}
        onRemove={(row) => {
          setError('');
          setRemoving(get(row.id) ?? null);
        }}
        onOpenProject={onOpenProject}
        onManageTags={(row) => setTagConnection(get(row.id) ?? null)}
        onFavorite={async (row, favorite) => {
          setError('');
          try {
            await patchDirectory(row.id, { favorite });
          } catch (cause) {
            if (mounted.current)
              setError(
                cause instanceof Error
                  ? uiFailure(cause)
                  : connectorUiMessages.message('couldNotSaveTheFavorite'),
              );
            throw cause;
          }
        }}
        onSelectionChange={setSelection}
        onBatchAction={beginBatch}
        onDismissBatchResult={() => setBatchResult(null)}
      />
      {tagConnection && (
        <ConnectionTagsDialog
          key={tagConnection.id}
          initialTags={tagConnection.directory?.tags ?? []}
          onClose={() => setTagConnection(null)}
          onSave={(tags) => patchDirectory(tagConnection.id, { tags })}
        />
      )}
      {removing && (
        <ConnectionDeleteDialog
          connections={[removing]}
          busy={busy}
          error={error}
          onClose={() => setRemoving(null)}
          onDelete={() => void remove()}
        />
      )}
      {batchDialog?.action === 'tags' && (
        <ConnectionTagsDialog
          initialTags={[]}
          additive
          title={tConnector('bulkTaggingConnections', {
            p0: String(batchDialog.connections.length),
          })}
          onSave={batchTags}
          onClose={() => setBatchDialog(null)}
        />
      )}
      {batchDialog?.action === 'test' && (
        <ConnectionBatchTestDialog
          connections={batchDialog.connections}
          onRun={batchTests}
          onClose={() => setBatchDialog(null)}
        />
      )}
      {batchDialog?.action === 'delete' && (
        <ConnectionDeleteDialog
          connections={batchDialog.connections}
          busy={Boolean(batchProgress)}
          onClose={() => setBatchDialog(null)}
          onDelete={() => {
            void batch('delete', removeConnection).then(() => {
              if (mounted.current) setBatchDialog(null);
            });
          }}
        />
      )}
      {dialog &&
        (provider === 'redis' ? (
          <RedisDialog
            key={dialog.connection?.id ?? 'new'}
            connection={dialog.connection as RedisSavedConnection | undefined}
            initialError={dialog.error}
            onClose={() => setDialog(null)}
            onSave={save}
          />
        ) : provider === 'mongodb' ? (
          <MongoDialog
            key={dialog.connection?.id ?? 'new'}
            connection={dialog.connection as MongoSavedConnection | undefined}
            initialError={dialog.error}
            onClose={() => setDialog(null)}
            onSave={save}
          />
        ) : (
          <RelationalDialog
            key={dialog.connection?.id ?? 'new'}
            provider={provider}
            connection={dialog.connection as RelationalSavedConnection | undefined}
            initialError={dialog.error}
            onClose={() => setDialog(null)}
            onSave={save}
          />
        ))}
    </>
  );
}
