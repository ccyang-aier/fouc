import type { Pool } from 'pg';
import type { Extension, onConnectPayload } from '@hocuspocus/server';
import type { PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { withWorkspaceTenant } from '../../../platform/database/workspace/tenant';
import type { KnowledgeRequestAuthenticator, KnowledgeRequestContext } from '../access';
import { authorizePageAccess } from '../permissions';
import { parsePageDocument } from '@fouc/shared/knowledge/collaboration';

export interface PageCollaborationContext {
  authority: KnowledgeRequestContext;
  pageId: string;
  level: PermissionLevel;
}

/** Indistinguishable rejection for missing, fenced and unauthorized pages. */
export class PageCollaborationRejected extends Error {
  constructor() {
    super('Page collaboration request was rejected.');
    this.name = 'PageCollaborationRejected';
  }
}

const writable: readonly PermissionLevel[] = ['edit', 'full'];

/**
 * B01 upgrade gate: strict page document names, A03 request authentication
 * (session cookie or PAT from the WebSocket handshake) and the P03 page ACL
 * in one tenant transaction. Denied, rebuilding and missing pages close
 * identically. Body writes additionally require an edit-or-full level and a
 * write-capable credential; everything else stays a read-only connection.
 */
export function pageCollaborationExtension(deps: { authenticator: KnowledgeRequestAuthenticator; pool: Pool }): Extension<PageCollaborationContext> {
  return {
    extensionName: 'fouc-page-collaboration',
    async onConnect(data: onConnectPayload<PageCollaborationContext>) {
      const scope = parsePageDocument(data.documentName);
      if (!scope) throw new PageCollaborationRejected();
      const authority = await deps.authenticator.authenticate(data.request, scope.workspaceId, ['read']);
      const decision = await withWorkspaceTenant(deps.pool, scope.workspaceId, (db) =>
        authorizePageAccess(db, { userId: authority.userId, scope, required: 'view' }));
      if (decision.decision !== 'allow') throw new PageCollaborationRejected();
      data.connectionConfig.isAuthenticated = true;
      data.connectionConfig.readOnly = !writable.includes(decision.level) || !authority.scopes.includes('write');
      return { authority, pageId: scope.pageId, level: decision.level };
    },
  };
}
