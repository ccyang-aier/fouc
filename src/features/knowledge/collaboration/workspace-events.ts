/**
 * Workspace metadata event subscriptions (B06).
 *
 * The channel is stateless by design: the server keeps no per-client cursor,
 * so after any reconnect the client invalidates the whole workspace namespace
 * and refetches, while live events invalidate only the queries they concern.
 */
import type { WorkspaceEvent } from '@fouc/shared/knowledge/contracts';
import { knowledgeApiPathPrefix } from '../data/endpoint';

export function knowledgeEventsUrl(origin: string, workspaceId: string): string {
  const url = new URL(`${origin}${knowledgeApiPathPrefix}/${workspaceId}/events`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/** Query-key segments (relative to the workspace root) each event concerns. */
export function invalidationSegmentsForEvent(event: Pick<WorkspaceEvent, 'type'>): readonly (readonly string[])[] {
  switch (event.type) {
    case 'page.created':
    case 'page.updated':
    case 'page.moved':
    case 'page.deleted':
    case 'acl.changed':
      return [['pages'], ['access']];
    case 'comment.changed':
      return [['comments'], ['pages']];
    case 'notification.created':
      return [['notifications']];
    case 'database.rows.changed':
      return [['databases']];
    case 'asset.updated':
      return [['assets']];
    case 'ai.task.changed':
      return [['aiTasks']];
  }
}

export interface KnowledgeWorkspaceEventsOptions {
  workspaceId: string;
  origin: string;
  /** Invalidate specific key segments under the workspace root. */
  invalidate(segments: readonly (readonly string[])[]): void;
  /** Invalidate the whole workspace namespace; called once per reconnect. */
  invalidateAll(): void;
  signal?: AbortSignal;
  /** Injectable for tests; defaults to the global WebSocket. */
  WebSocketImpl?: new (url: string) => WebSocket;
  /** Reconnect bounds in milliseconds. */
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export interface KnowledgeWorkspaceEvents {
  close(): void;
}

export function connectKnowledgeWorkspaceEvents(options: KnowledgeWorkspaceEventsOptions): KnowledgeWorkspaceEvents {
  const Socket = options.WebSocketImpl ?? WebSocket;
  const baseDelay = options.reconnectDelayMs ?? 1_000;
  const maxDelay = options.maxReconnectDelayMs ?? 30_000;
  let attempts = 0;
  let socket: WebSocket | undefined;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleReconnect = () => {
    if (closed || options.signal?.aborted) return;
    const delay = Math.min(maxDelay, baseDelay * 2 ** attempts);
    attempts += 1;
    timer = setTimeout(connect, delay);
  };

  const connect = () => {
    socket = new Socket(knowledgeEventsUrl(options.origin, options.workspaceId));
    socket.onopen = () => {
      // A reconnect means an unknown gap: invalidate everything and refetch.
      if (attempts > 0) options.invalidateAll();
      attempts = 0;
    };
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as WorkspaceEvent;
        const segments = invalidationSegmentsForEvent(event);
        if (segments.length) options.invalidate(segments);
      } catch {
        // Foreign payloads never crash the subscription loop.
      }
    };
    socket.onclose = scheduleReconnect;
    socket.onerror = () => socket?.close();
  };

  const stop = () => {
    closed = true;
    if (timer) clearTimeout(timer);
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
  };
  options.signal?.addEventListener('abort', stop, { once: true });
  connect();
  return { close: stop };
}
