'use client';

import { useEffect } from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
import type { ChannelMessagePage, ChannelSnapshot } from '@fouc/shared/chats';
import { useProjectResources } from '@/features/project/project-resources';
import { usePageVisible } from '@/lib/page-visibility';
import { ChannelRequestError, channelClient } from './channel-client';
import { compareChannelMessages, emptyChannelHistory, mergeChannelMessages, prependChannelPage, retainChannelHistory, type ChannelHistory } from './channel-history';

// This client owns only channel data. Account and project are part of every key.
const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 1500, gcTime: 60_000, refetchOnWindowFocus: true } } });
const directoryKey = (scope: string) => ['project-channels', scope] as const;
const detailKey = (scope: string, id: string) => ['channel', scope, id] as const;
const historyKey = (scope: string, id: string) => ['channel-history', scope, id] as const;
const assetsKey = (scope: string, id: string) => ['channel-assets', scope, id] as const;
const accessKey = (scope: string, id: string) => `${scope}\0${id}`;
const accessRevisions = new Map<string, number>();
const deniedChannels = new Map<string, ChannelRequestError>();
const loadingPages = new Map<string, Promise<void>>();

function useChannelQueryLifecycle() {
  useEffect(() => { queries.mount(); return () => queries.unmount(); }, []);
}

function accessDenied(error: unknown): error is ChannelRequestError {
  return error instanceof ChannelRequestError && (error.status === 401 || error.status === 403 || error.status === 404 && error.code !== 'INVALID_INPUT');
}

function clearChannelAccess(scope: string, id: string, error: ChannelRequestError) {
  const key = accessKey(scope, id);
  accessRevisions.set(key, (accessRevisions.get(key) ?? 0) + 1);
  deniedChannels.set(key, error);
  for (const queryKey of [detailKey(scope, id), historyKey(scope, id), assetsKey(scope, id)]) {
    // Do not let an authorized-but-late response restore content after membership was revoked.
    void queries.cancelQueries({ queryKey, exact: true }, { revert: false, silent: true });
    queries.getQueryCache().find({ queryKey, exact: true })?.setState({ data: undefined, error, status: 'error', fetchStatus: 'idle' });
  }
}

export function captureChannelAccess(scope: string, id: string) { return accessRevisions.get(accessKey(scope, id)) ?? 0; }
export function invalidateChannelAccess(scope: string, id: string, error: unknown): boolean {
  if (!accessDenied(error)) return false;
  clearChannelAccess(scope, id, error);
  return true;
}

export async function runChannelMutation(scope: string, id: string, operation: () => Promise<ChannelSnapshot>): Promise<ChannelSnapshot> {
  const revision = captureChannelAccess(scope, id);
  try {
    const denied = deniedChannels.get(accessKey(scope, id));
    if (denied) throw denied;
    const snapshot = await operation();
    if (!publishChannelSnapshot(scope, snapshot, revision)) throw new ChannelRequestError(403, 'FORBIDDEN', 'Channel access changed.');
    return snapshot;
  } catch (error) {
    if (revision === captureChannelAccess(scope, id)) invalidateChannelAccess(scope, id, error);
    throw error;
  }
}

async function withChannelAccess<T>(scope: string, id: string, operation: () => Promise<T>): Promise<T> {
  const key = accessKey(scope, id);
  const revision = accessRevisions.get(key) ?? 0;
  try {
    const result = await operation();
    if (revision !== (accessRevisions.get(key) ?? 0)) throw new ChannelRequestError(403, 'FORBIDDEN', 'Channel access changed.');
    return result;
  } catch (error) {
    if (accessDenied(error) && revision === (accessRevisions.get(key) ?? 0)) clearChannelAccess(scope, id, error);
    throw error;
  }
}

function retainLiveWindow(scope: string, snapshot: ChannelSnapshot) {
  const previous = queries.getQueryData<ChannelSnapshot>(detailKey(scope, snapshot.channel.id));
  queries.setQueryData<ChannelHistory>(historyKey(scope, snapshot.channel.id), history => history ? retainChannelHistory(history, previous, snapshot) : undefined);
}

async function refreshLoadedHistory(projectId: string, scope: string, id: string, signal: AbortSignal): Promise<ChannelHistory> {
  const known = queries.getQueryData<ChannelHistory>(historyKey(scope, id)) ?? emptyChannelHistory;
  const target = known.messages[0];
  // Re-anchor at a current server message so deleting an old page cursor does not lose history.
  const snapshot = await channelClient.get(projectId, id, signal);
  signal.throwIfAborted();
  retainLiveWindow(scope, snapshot);
  queries.setQueryData(detailKey(scope, id), snapshot);
  if (!target) return { ...known, messages: [], hasMore: Boolean(snapshot.hasMoreMessages) };
  let before = snapshot.messages[0]?.id;
  if (!before || !snapshot.hasMoreMessages) return { loaded: true, messages: [], hasMore: false };
  let messages = snapshot.messages;
  let hasMore = true;
  while (hasMore) {
    const page = await channelClient.history(projectId, id, before, signal);
    signal.throwIfAborted();
    messages = mergeChannelMessages(page.items, messages);
    hasMore = page.hasMore;
    const oldest = page.items[0];
    if (!oldest || compareChannelMessages(oldest, target) <= 0 || oldest.id === before) break;
    before = oldest.id;
  }
  const live = queries.getQueryData<ChannelSnapshot>(detailKey(scope, id)) ?? snapshot;
  const first = live.messages[0];
  return { loaded: true, hasMore, messages: first ? messages.filter(message => compareChannelMessages(message, first) < 0) : [] };
}

export function useChannelDirectory() {
  useChannelQueryLifecycle();
  const { selectedProject, scopeKey, principal } = useProjectResources();
  const enabled = selectedProject?.source === 'server' && principal !== 'guest' && Boolean(scopeKey);
  const result = useQuery({
    queryKey: directoryKey(scopeKey ?? ''),
    queryFn: ({ signal }) => channelClient.list(selectedProject!.id, signal),
    enabled, refetchInterval: enabled ? 8000 : false,
  }, queries);
  return { ...result, data: enabled && !accessDenied(result.error) ? result.data : undefined };
}

export function useChannelDetail(id: string | null) {
  useChannelQueryLifecycle();
  const { selectedProject, scopeKey, principal } = useProjectResources();
  const visible = usePageVisible();
  const scope = scopeKey ?? '';
  const channelId = id ?? '';
  const projectId = selectedProject?.id ?? '';
  const enabled = Boolean(id && scopeKey && selectedProject?.source === 'server' && principal !== 'guest');
  const detail = useQuery({
    queryKey: detailKey(scope, channelId),
    queryFn: async ({ signal }) => {
      const snapshot = await withChannelAccess(scope, channelId, () => channelClient.get(projectId, channelId, signal));
      signal.throwIfAborted();
      deniedChannels.delete(accessKey(scope, channelId));
      retainLiveWindow(scope, snapshot);
      return snapshot;
    },
    enabled: enabled && visible, refetchInterval: enabled && visible ? 2500 : false,
  }, queries);
  const loaded = queries.getQueryData<ChannelHistory>(historyKey(scope, channelId))?.loaded ?? false;
  const history = useQuery({
    queryKey: historyKey(scope, channelId),
    queryFn: ({ signal }) => withChannelAccess(scope, channelId, () => refreshLoadedHistory(projectId, scope, channelId, signal)),
    initialData: emptyChannelHistory,
    enabled: enabled && visible && loaded && !accessDenied(detail.error),
    refetchOnWindowFocus: true,
  }, queries);
  const denied = accessDenied(detail.error) || accessDenied(history.error);
  const current = enabled && !denied ? detail.data : undefined;
  const earlier = history.data ?? emptyChannelHistory;
  const hasMore = Boolean(current && (earlier.loaded ? earlier.hasMore : current.hasMoreMessages));

  async function loadEarlier(): Promise<void> {
    if (!enabled || !current || !hasMore) return;
    const key = accessKey(scope, channelId);
    const pending = loadingPages.get(key);
    if (pending) return pending;
    const operation = (async () => {
      await queries.cancelQueries({ queryKey: historyKey(scope, channelId), exact: true });
      await queries.fetchQuery({
        queryKey: historyKey(scope, channelId), staleTime: 0,
        queryFn: ({ signal }) => withChannelAccess(scope, channelId, async () => {
          const saved = queries.getQueryData<ChannelHistory>(historyKey(scope, channelId)) ?? emptyChannelHistory;
          const live = queries.getQueryData<ChannelSnapshot>(detailKey(scope, channelId));
          if (!live) return saved;
          const before = mergeChannelMessages(saved.messages, live.messages)[0]?.id;
          if (!before) return { ...saved, hasMore: false };
          let page: ChannelMessagePage;
          try { page = await channelClient.history(projectId, channelId, before, signal); }
          catch (error) {
            if (!(error instanceof ChannelRequestError && error.status === 404 && error.code === 'INVALID_INPUT')) throw error;
            // A concurrently deleted cursor is repaired from the latest readable window.
            const refreshed = await refreshLoadedHistory(projectId, scope, channelId, signal);
            const latest = queries.getQueryData<ChannelSnapshot>(detailKey(scope, channelId));
            const cursor = mergeChannelMessages(refreshed.messages, latest?.messages ?? [])[0]?.id;
            if (!cursor) return { ...refreshed, hasMore: false };
            page = await channelClient.history(projectId, channelId, cursor, signal);
          }
          signal.throwIfAborted();
          return prependChannelPage(queries.getQueryData<ChannelHistory>(historyKey(scope, channelId)) ?? saved, page);
        }),
      });
    })().finally(() => { if (loadingPages.get(key) === operation) loadingPages.delete(key); });
    loadingPages.set(key, operation);
    return operation;
  }

  return { ...detail, data: current ? { ...current, messages: mergeChannelMessages(earlier.messages, current.messages) } : undefined,
    loadEarlier, loadingEarlier: history.isFetching, hasMore };
}

export function useChannelAssets(id: string | null) {
  useChannelQueryLifecycle();
  const { selectedProject, scopeKey, principal } = useProjectResources();
  const visible = usePageVisible();
  const scope = scopeKey ?? '';
  const channelId = id ?? '';
  const enabled = Boolean(id && scopeKey && selectedProject?.source === 'server' && principal !== 'guest');
  const result = useQuery({
    queryKey: assetsKey(scope, channelId),
    queryFn: ({ signal }) => withChannelAccess(scope, channelId, () => channelClient.assets(selectedProject!.id, channelId, signal)),
    enabled: enabled && visible, refetchInterval: enabled && visible ? 8000 : false,
  }, queries);
  return { ...result, data: enabled && !accessDenied(result.error) ? result.data : undefined };
}

export function publishChannelSnapshot(scope: string, snapshot: ChannelSnapshot, revision?: number): boolean {
  const id = snapshot.channel.id;
  if (deniedChannels.has(accessKey(scope, id)) || revision !== undefined && revision !== captureChannelAccess(scope, id)) return false;
  retainLiveWindow(scope, snapshot);
  queries.setQueryData(detailKey(scope, snapshot.channel.id), snapshot);
  void queries.invalidateQueries({ queryKey: directoryKey(scope) });
  const refreshHistory = () => queries.invalidateQueries({ queryKey: historyKey(scope, snapshot.channel.id) });
  const loading = loadingPages.get(accessKey(scope, snapshot.channel.id));
  if (loading) void loading.then(refreshHistory, refreshHistory);
  else void refreshHistory();
  void queries.invalidateQueries({ queryKey: assetsKey(scope, snapshot.channel.id) });
  return true;
}
export function refreshChannelDirectory(scope: string) { return queries.invalidateQueries({ queryKey: directoryKey(scope) }); }
export function forgetChannel(scope: string, id: string) {
  queries.removeQueries({ queryKey: detailKey(scope, id) });
  queries.removeQueries({ queryKey: historyKey(scope, id) });
  queries.removeQueries({ queryKey: assetsKey(scope, id) });
  const key = accessKey(scope, id);
  accessRevisions.set(key, (accessRevisions.get(key) ?? 0) + 1);
  deniedChannels.set(key, new ChannelRequestError(404, 'NOT_FOUND', 'Channel no longer exists.'));
  void refreshChannelDirectory(scope);
}
