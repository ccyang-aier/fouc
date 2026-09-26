import { Hocuspocus } from '@hocuspocus/server';
import type { Configuration } from '@hocuspocus/server';
import type { Pool } from 'pg';
import type { KnowledgeRequestAuthenticator } from '../auth';
import { pageCollaborationExtension } from './page-collaboration';
import type { PageCollaborationContext } from './page-collaboration';

/**
 * Shared configuration for every embedding: Z03's listener, B03's multi-node
 * host and tests all spread this onto their Hocuspocus/Server construction.
 * Yjs garbage collection stays enabled so unloaded documents do not retain
 * tombstoned content.
 */
export function pageCollaborationConfiguration(deps: { authenticator: KnowledgeRequestAuthenticator; pool: Pool }): Partial<Configuration<PageCollaborationContext>> {
  const collaboration = pageCollaborationExtension(deps);
  return {
    name: 'fouc-page-collaboration',
    yDocOptions: { gc: true, gcFilter: () => true },
    async onConnect(data) {
      return collaboration.onConnect?.(data);
    },
  };
}

/** A standalone host without a listener; Z03 owns real sockets. */
export function createPageCollaboration(deps: { authenticator: KnowledgeRequestAuthenticator; pool: Pool }): Hocuspocus<PageCollaborationContext> {
  return new Hocuspocus<PageCollaborationContext>(pageCollaborationConfiguration(deps) as Partial<Configuration<PageCollaborationContext>>);
}
