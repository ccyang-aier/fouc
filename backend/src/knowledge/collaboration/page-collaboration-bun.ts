import bunAdapter from 'crossws/adapters/bun';
import type { Pool } from 'pg';
import { createLogger } from '../../platform/logger';
import type { KnowledgeRequestAuthenticator } from '../auth';
import { createPageCollaboration } from './page-collaboration-server';
import type { PageCollaborationPersistence } from './page-collaboration-server';

const log = createLogger('knowledge.collaboration');

/**
 * Bun's ServerWebSocket rejects method calls made through the detached object
 * reference (ERR_INVALID_THIS realm check), while crossws's own peer routing
 * works. Hocuspocus only needs the WebSocketLike surface, so every page
 * connection is handed this peer-backed adapter.
 */
class BunPeerSocket {
  constructor(private readonly peer: { send(data: unknown): void; close(code: number, reason: string): void; readonly websocket: { readonly readyState?: number } }) {}

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.peer.send(data as ArrayBufferView);
  }

  close(code?: number, reason?: string): void {
    this.peer.close(code ?? 1000, reason ?? '');
  }

  get readyState(): number {
    return this.peer.websocket.readyState ?? 1;
  }
}

export interface PageCollaborationListener {
  port: number;
  hocuspocus: ReturnType<typeof createPageCollaboration>;
  close(): Promise<void>;
}

/**
 * The Bun sidecar's real assembly: a native Bun.serve WebSocket listener wired
 * to the authenticated Hocuspocus host through crossws's Bun adapter. Z03 owns
 * when/where this runs; tests embed it exactly the way production does.
 */
export function createPageCollaborationListener(deps: { authenticator: KnowledgeRequestAuthenticator; pool: Pool }, options: { port?: number; hostname?: string; signal?: AbortSignal; persistence?: PageCollaborationPersistence } = {}): PageCollaborationListener {
  const hocuspocus = createPageCollaboration(deps, options.persistence);
  const connections = new Map<unknown, ReturnType<typeof hocuspocus.handleConnection>>();
  const crossws = bunAdapter({
    hooks: {
      open: (peer) => {
        connections.set(peer.websocket, hocuspocus.handleConnection(new BunPeerSocket(peer as never), peer.request));
      },
      message: (peer, message) => {
        connections.get(peer.websocket)?.handleMessage(message.uint8Array());
      },
      close: (peer, event) => {
        connections.get(peer.websocket)?.handleClose({ code: event.code ?? 1000, reason: event.reason ?? '' });
        connections.delete(peer.websocket);
      },
      error: (_peer, error) => {
        log.error('Collaboration websocket error:', error);
      },
    },
  });
  const server = Bun.serve({
    port: options.port ?? 0,
    hostname: options.hostname ?? '127.0.0.1',
    idleTimeout: 255,
    fetch(request, srv) {
      if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        // Returning the promise lets Bun keep the upgrade alive across the adapter's async hooks.
        return crossws.handleUpgrade(request, srv as never) as never;
      }
      return new Response('Not found.', { status: 404 });
    },
    websocket: crossws.websocket as never,
  });
  const close = async () => {
    options.signal?.removeEventListener('abort', close);
    hocuspocus.closeConnections();
    server.stop(true);
  };
  options.signal?.addEventListener('abort', close);
  return { port: server.port as number, hocuspocus, close };
}
