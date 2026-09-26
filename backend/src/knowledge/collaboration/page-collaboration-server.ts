import * as Y from 'yjs';
import { Hocuspocus } from '@hocuspocus/server';
import type { Configuration } from '@hocuspocus/server';
import { and, eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { docState } from '../../database/knowledge/schema';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { appendKnowledgeOutbox } from '../workers/outbox';
import type { KnowledgeRequestAuthenticator } from '../auth';
import { pageCollaborationExtension } from './page-collaboration';
import type { PageCollaborationContext } from './page-collaboration';
import { parsePageDocument } from './page-documents';

export interface PageCollaborationPersistence {
  /** Store debounce window; production default 2s per the design contract. */
  debounceMs?: number;
  /** Upper bound so continuous editing still persists; production 10s. */
  maxDebounceMs?: number;
}

/**
 * Shared configuration for every embedding: Z03's listener, B03's multi-node
 * host and tests all spread this onto their Hocuspocus/Server construction.
 * Yjs garbage collection stays enabled; doc_state is the only body authority,
 * and state, state vector and the doc.changed outbox row commit atomically.
 */
export function pageCollaborationConfiguration(deps: { authenticator: KnowledgeRequestAuthenticator; pool: Pool }, persistence: PageCollaborationPersistence = {}): Partial<Configuration<PageCollaborationContext>> {
  const collaboration = pageCollaborationExtension(deps);
  return {
    name: 'fouc-page-collaboration',
    debounce: persistence.debounceMs ?? 2_000,
    maxDebounce: persistence.maxDebounceMs ?? 10_000,
    yDocOptions: { gc: true, gcFilter: () => true },
    async onConnect(data) {
      return collaboration.onConnect?.(data);
    },
    async onLoadDocument(data) {
      const scope = parsePageDocument(data.documentName);
      if (!scope) return data.document;
      const row = await withKnowledgeTenant(deps.pool, scope.workspaceId, (db) => db.select({ state: docState.state })
        .from(docState).where(and(eq(docState.workspaceId, scope.workspaceId), eq(docState.pageId, scope.pageId))));
      if (row[0]) Y.applyUpdate(data.document, new Uint8Array(row[0].state));
      return data.document;
    },
    async onStoreDocument(data) {
      const scope = parsePageDocument(data.documentName);
      if (!scope) return;
      const state = Buffer.from(Y.encodeStateAsUpdate(data.document));
      const stateVector = Buffer.from(Y.encodeStateVector(data.document));
      // Server-internal stores without a connection context persist the body
      // but emit no event: actor attribution must never be fabricated.
      const actor = data.lastContext?.authority.actor;
      await withKnowledgeTenant(deps.pool, scope.workspaceId, async (db) => {
        await db.insert(docState).values({ ...scope, state, stateVector })
          .onConflictDoUpdate({ target: [docState.workspaceId, docState.pageId], set: { state, stateVector, updatedAt: sql`clock_timestamp()` } });
        if (actor) await appendKnowledgeOutbox(db, { topic: 'doc.changed', ...scope, actor, occurredAt: new Date().toISOString() });
      });
    },
  };
}

/** A standalone host without a listener; Z03 owns real sockets. */
export function createPageCollaboration(deps: { authenticator: KnowledgeRequestAuthenticator; pool: Pool }, persistence: PageCollaborationPersistence = {}): Hocuspocus<PageCollaborationContext> {
  return new Hocuspocus<PageCollaborationContext>(pageCollaborationConfiguration(deps, persistence) as Partial<Configuration<PageCollaborationContext>>);
}
