import type { WorkspaceEvent } from '@fouc/shared/knowledge/contracts';
import type { KnowledgeRequestAuthenticator } from '../access';
import type { KnowledgeConsumer } from '../workers/types';

type Subscriber = (event: WorkspaceEvent) => void;

/**
 * In-process fan-out of workspace metadata events. Stateless by contract:
 * the hub keeps no per-client cursor - reconnecting clients simply refetch,
 * which the design (§5.3) pairs with query-cache invalidation.
 */
export class WorkspaceEventHub {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  subscribe(workspaceId: string, subscriber: Subscriber): () => void {
    const set = this.subscribers.get(workspaceId) ?? new Set<Subscriber>();
    set.add(subscriber);
    this.subscribers.set(workspaceId, set);
    return () => {
      set.delete(subscriber);
      if (!set.size) this.subscribers.delete(workspaceId);
    };
  }

  publish(workspaceId: string, event: WorkspaceEvent): void {
    const set = this.subscribers.get(workspaceId);
    if (!set) return;
    for (const subscriber of set) {
      try {
        subscriber(event);
      } catch {
        // A failing socket must never block the remaining subscribers.
      }
    }
  }

  subscriberCount(workspaceId: string): number {
    return this.subscribers.get(workspaceId)?.size ?? 0;
  }
}

export function workspaceEventConsumer(hub: WorkspaceEventHub): KnowledgeConsumer {
  return {
    name: 'workspace_events',
    topic: 'workspace.event',
    handle: async (event, context) => {
      if (event.topic !== 'workspace.event') throw new Error('Unexpected event topic.');
      context.signal?.throwIfAborted();
      hub.publish(event.workspaceId, event.event);
    },
  };
}

/** Minimal Bun WebSocket surface the events channel relies on. */
interface EventsSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  data?: unknown;
}

export interface WorkspaceEventsChannel {
  /** Authenticates and upgrades; a denial returns a plain HTTP error response. */
  handleUpgrade(request: Request, workspaceId: string, server: { upgrade(request: Request, options?: { data?: unknown }): boolean }): Promise<Response | undefined>;
  open(socket: EventsSocket): void;
  message(socket: EventsSocket, data: string): void;
  close(socket: EventsSocket): void;
}

/**
 * The `ws:`-style metadata channel (B06): membership-verified WebSocket
 * subscriptions at `/api/knowledge/:workspaceId/events`. Page documents keep
 * their own Hocuspocus transport; this channel carries workspace events only.
 */
export function createWorkspaceEventsChannel(deps: { authenticator: KnowledgeRequestAuthenticator; hub: WorkspaceEventHub }): WorkspaceEventsChannel {
  const unsubscribers = new Map<EventsSocket, () => void>();
  return {
    async handleUpgrade(request, workspaceId, server) {
      try {
        await deps.authenticator.authenticate(request, workspaceId);
      } catch {
        return new Response('Forbidden.', { status: 403 });
      }
      if (!server.upgrade(request, { data: { kind: 'workspace-events', workspaceId } })) {
        return new Response('Upgrade failed.', { status: 500 });
      }
      return undefined;
    },
    open(socket) {
      const workspaceId = (socket.data as { workspaceId?: string } | undefined)?.workspaceId;
      if (!workspaceId) {
        socket.close(1011);
        return;
      }
      unsubscribers.set(socket, deps.hub.subscribe(workspaceId, (event) => socket.send(JSON.stringify(event))));
    },
    message(socket, data) {
      if (data === 'ping') socket.send('pong');
    },
    close(socket) {
      unsubscribers.get(socket)?.();
      unsubscribers.delete(socket);
    },
  };
}

/** Re-exported for listeners that also want the consumer wired with the hub. */
export function createWorkspaceEventRuntime(deps: { authenticator: KnowledgeRequestAuthenticator }) {
  const hub = new WorkspaceEventHub();
  return {
    hub,
    consumer: workspaceEventConsumer(hub),
    channel: createWorkspaceEventsChannel({ authenticator: deps.authenticator, hub }),
  };
}
