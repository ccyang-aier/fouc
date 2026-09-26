import * as Y from 'yjs';
import { Hocuspocus } from '@hocuspocus/server';
import type { Configuration } from '@hocuspocus/server';
import type { PageDocumentReplica } from '../../store/knowledge-documents';
import { parsePageDocument } from './page-documents';
import type { PageCollaborationContext } from './page-collaboration';

/**
 * The desktop sidecar's local page-collaboration host (B05): the WebView
 * edits against loopback, the SQLite replica persists every debounced store,
 * and cloud authority stays with the server's doc_state - reconnection
 * converges through Yjs state-vector exchange, never by overwriting.
 *
 * There is deliberately no A03 authenticator here: the desktop has no local
 * Postgres and the listener binds to loopback only, so the boundary is the
 * operating-system user session. Page document names remain strictly parsed.
 */
export function createDesktopPageCollaboration(replica: PageDocumentReplica, options: { debounceMs?: number; maxDebounceMs?: number } = {}): Hocuspocus {
  return new Hocuspocus({
    name: 'fouc-desktop-page-collaboration',
    debounce: options.debounceMs ?? 2_000,
    maxDebounce: options.maxDebounceMs ?? 10_000,
    yDocOptions: { gc: true, gcFilter: () => true },
    async onConnect(data) {
      const scope = parsePageDocument(data.documentName);
      if (!scope) throw new Error('permission-denied');
      data.connectionConfig.isAuthenticated = true;
      data.connectionConfig.readOnly = false;
      return { pageId: scope.pageId } satisfies Partial<PageCollaborationContext> as never;
    },
    async onLoadDocument(data) {
      const scope = parsePageDocument(data.documentName);
      if (scope) {
        const persisted = replica.load(scope);
        if (persisted) Y.applyUpdate(data.document, persisted.state);
      }
      return data.document;
    },
    async onStoreDocument(data) {
      const scope = parsePageDocument(data.documentName);
      if (!scope) return;
      replica.save(scope, Y.encodeStateAsUpdate(data.document), Y.encodeStateVector(data.document));
    },
  } as Partial<Configuration<PageCollaborationContext>>);
}
