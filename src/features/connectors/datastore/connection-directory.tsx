'use client';

import { useEffect, useRef, useState } from 'react';
import type { RelationalConnectionConfig, RelationalSavedConnection, RelationalSession, RedisConnectionConfig, RedisSavedConnection, RedisSession } from '@fouc/shared';
import type { MongoConnectionConfig, MongoSavedConnection } from '@fouc/shared/mongo-connections';
import type { MongoSession } from '@fouc/shared/mongo';
import type { DatabaseConnectionOptionsInput } from '@fouc/shared/connection-options';
import type { ConnectionDirectoryMetadata } from '@fouc/shared/connection-directory';
import { backendFetch } from '@/lib/backend';
import { useWorkspace } from '@/features/workspaces/workspace-provider';
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
import { connectionListRow, directoryProviders, type DatastoreProvider, type SavedDatastoreConnection } from './connection-list/provider-model';
import { ConnectionTagsDialog } from './connection-list/tag-dialog';
import { SqlDialog } from './sql-library-dialog';
import styles from './relational.module.css';

type Session = RelationalSession | RedisSession | MongoSession;
type Props = { provider: DatastoreProvider; onBack: () => void; onOpenProject: (id: string) => void; onWorkbenchFocus?: () => void };
export function DatastoreConnections(props: Props) {
  const { activeSpace } = useWorkspace();
  const { projects } = useProjectResources();
  const { onWorkbenchFocus } = props;
  useEffect(() => {
    if (window.matchMedia('(max-width: 760px)').matches) onWorkbenchFocus?.();
  }, [onWorkbenchFocus]);
  return <ConnectionDirectory key={`${activeSpace.id}:${props.provider}`} {...props} workspaceId={activeSpace.id}
    projects={projects.filter(project => project.workspaceId === activeSpace.id)} />;
}

function ConnectionDirectory({ provider, workspaceId, onBack, onOpenProject, onWorkbenchFocus, projects }: Props & {
  workspaceId: string; projects: { id: string; name: string }[];
}) {
  const descriptor = directoryProviders[provider];
  const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/${descriptor.family}`;
  const [connections, setConnections] = useState<SavedDatastoreConnection[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ intent: 'save' | 'connect'; connection?: SavedDatastoreConnection } | null>(null);
  const [tagConnection, setTagConnection] = useState<SavedDatastoreConnection | null>(null);
  const [removing, setRemoving] = useState<SavedDatastoreConnection | null>(null);
  const [busy, setBusy] = useState(false), [pendingIds, setPendingIds] = useState<string[]>([]), [testingId, setTestingId] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const [active, setActive] = useState<{ connection: SavedDatastoreConnection; session: Session } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<SavedDatastoreConnection[]>(`${base}/connections`, { signal: controller.signal })
      .then(items => { if (!controller.signal.aborted) { setConnections(items); setLoading(false); } })
      .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : '读取连接失败'); setLoading(false); } });
    return () => controller.abort();
  }, [base, revision]);
  const activeSessionId = active?.session.id;
  useEffect(() => {
    if (!activeSessionId) return;
    return () => { void backendFetch(`${base}/sessions/${activeSessionId}`, { method: 'DELETE' }).catch(() => undefined); };
  }, [activeSessionId, base]);
  function replace(item: SavedDatastoreConnection) {
    if (mounted.current) setConnections(current => current.map(entry => entry.id === item.id ? item : entry));
  }
  async function save(name: string, config: RelationalConnectionConfig | RedisConnectionConfig | MongoConnectionConfig) {
    const id = dialog?.connection?.id;
    const item = await backendFetch<SavedDatastoreConnection>(`${base}/connections${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify({ name, config }) });
    if (mounted.current) { setConnections(current => [...current.filter(entry => entry.id !== item.id), item]); setDialog(null); }
  }
  async function connect(connection: SavedDatastoreConnection, password: string, connectionOptions: DatabaseConnectionOptionsInput | undefined, open: boolean) {
    setTestingId(connection.id);
    const annotate = (kind: 'passed' | 'failed') => {
      if (mounted.current) setConnections(current => current.map(entry => entry.id === connection.id && JSON.stringify(entry.config) === JSON.stringify(connection.config)
        ? { ...entry, status: { kind, checkedAt: Date.now() } } : entry));
    };
    let session: Session;
    try {
      session = await backendFetch<Session>(`${base}/connections/${connection.id}/connect`, { method: 'POST', body: JSON.stringify({ password, connectionOptions }) });
    } catch (cause) {
      annotate('failed');
      throw cause;
    } finally { if (mounted.current) setTestingId(null); }
    if (!open || !mounted.current) {
      await backendFetch(`${base}/sessions/${session.id}`, { method: 'DELETE' });
    }
    if (mounted.current) {
      annotate('passed');
      if (open) { setSelection([]); setDialog(null); setActive({ connection, session }); onWorkbenchFocus?.(); }
    }
    return '连接测试通过';
  }
  async function patchDirectory(id: string, metadata: Partial<ConnectionDirectoryMetadata>) {
    if (pending.current.has(id)) throw new Error('此连接正在保存，请稍后再试');
    pending.current.add(id); setPendingIds([...pending.current]);
    try { replace(await backendFetch<SavedDatastoreConnection>(`${base}/connections/${id}/directory`, { method: 'PATCH', body: JSON.stringify(metadata) })); }
    finally { pending.current.delete(id); if (mounted.current) setPendingIds([...pending.current]); }
  }
  async function remove() {
    if (!removing || busy) return;
    setBusy(true); setError('');
    try {
      await backendFetch(`${base}/connections/${removing.id}`, { method: 'DELETE' });
      if (provider !== 'redis' && provider !== 'mongodb') forgetSqlDrafts(`${base}/connections/${removing.id}`);
      if (mounted.current) { setConnections(items => items.filter(item => item.id !== removing.id)); setSelection(ids => ids.filter(id => id !== removing.id)); setRemoving(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败'); }
    finally { setBusy(false); }
  }
  if (active?.session.provider === 'redis') return <RedisWorkbench key={active.session.id} session={active.session} name={active.connection.name} onBack={() => setActive(null)} onSessionChange={session => setActive({ connection: active.connection, session })} />;
  if (active?.session.provider === 'mongodb') return <MongoWorkbench key={active.session.id} session={active.session} name={active.connection.name} onBack={() => setActive(null)} onSessionChange={session => setActive({ connection: active.connection, session })} />;
  if (active) return <RelationalWorkbench key={active.session.id} session={active.session} name={active.connection.name} onBack={() => setActive(null)} />;
  const get = (id: string) => connections.find(entry => entry.id === id);
  const connectSelected = (password: string, options?: DatabaseConnectionOptionsInput) => connect(dialog!.connection!, password, options, true).then(() => undefined);
  const testSelected = (password: string, options?: DatabaseConnectionOptionsInput) => connect(dialog!.connection!, password, options, false);
  return <>
    <ConnectionList label={descriptor.label} targetLabel={descriptor.targetLabel} scopeKey={`${workspaceId}:${provider}`}
      rows={connections.filter(entry => entry.config.provider === provider && entry.workspaceId === workspaceId).map(entry => connectionListRow(entry, testingId === entry.id))}
      projects={projects} loading={loading} error={error} pendingIds={pendingIds}
      headerActions={<ConnectionConfigTransferActions workspaceId={workspaceId} provider={provider} connections={connections} selectedIds={selection} disabled={loading || busy} onImported={() => setRevision(value => value + 1)} />}
      onBack={onBack} onCreate={() => setDialog({ intent: 'save' })} onRetry={() => { setError(''); setLoading(true); setRevision(value => value + 1); }}
      onOpen={row => { if (row.status === 'passed') setDialog({ intent: 'connect', connection: get(row.id) }); }} onEdit={row => setDialog({ intent: 'save', connection: get(row.id) })}
      onRemove={row => setRemoving(get(row.id) ?? null)} onOpenProject={onOpenProject}
      onManageTags={row => setTagConnection(get(row.id) ?? null)}
      onFavorite={(row, favorite) => { setError(''); void patchDirectory(row.id, { favorite }).catch(cause => { if (mounted.current) setError(cause instanceof Error ? cause.message : '收藏保存失败'); }); }}
      onSelectionChange={setSelection} />
    {tagConnection && <ConnectionTagsDialog key={tagConnection.id} connection={tagConnection} onClose={() => setTagConnection(null)} onSave={tags => patchDirectory(tagConnection.id, { tags })} />}
    {removing && <SqlDialog title="删除连接确认" role="alertdialog" busy={busy} onClose={() => setRemoving(null)}><div className={styles.formBody}><p>删除「{removing.name}」的连接配置？</p><small>数据库文件与数据内容不会删除。</small></div><footer className={styles.dialogFooter}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setRemoving(null)}>取消</button><span /><button type="button" className={styles.danger} disabled={busy} onClick={() => void remove()}>{busy ? '删除中…' : '确认删除'}</button></footer></SqlDialog>}
    {dialog && (provider === 'redis'
      ? <RedisDialog key={`${dialog.intent}:${dialog.connection?.id ?? 'new'}`} workspaceId={workspaceId} connection={dialog.connection as RedisSavedConnection | undefined} intent={dialog.intent} onClose={() => setDialog(null)} onSave={save} onConnect={connectSelected} onTest={testSelected} />
      : provider === 'mongodb'
        ? <MongoDialog key={`${dialog.intent}:${dialog.connection?.id ?? 'new'}`} workspaceId={workspaceId} connection={dialog.connection as MongoSavedConnection | undefined} intent={dialog.intent} onClose={() => setDialog(null)} onSave={save} onConnect={connectSelected} onTest={testSelected} />
        : <RelationalDialog key={`${dialog.intent}:${dialog.connection?.id ?? 'new'}`} workspaceId={workspaceId} provider={provider} connection={dialog.connection as RelationalSavedConnection | undefined} intent={dialog.intent} onClose={() => setDialog(null)} onSave={save} onConnect={connectSelected} onTest={testSelected} />)}
  </>;
}
