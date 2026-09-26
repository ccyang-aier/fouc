/**
 * 桌面离线 Yjs 副本（B05）。
 *
 * 服务的正文唯一权威是 Postgres doc_state（B02）；本副本只属于桌面
 * sidecar 的本地缓存/离线缓冲——在线时经 state vector 交换与云端双向
 * 补齐，CRDT 合并收敛。Rust 壳不接触知识库业务，这里只由 sidecar 的
 * TypeScript 读写 SQLite。
 */
import type { Database } from 'bun:sqlite';

export interface PageDocumentScope {
  workspaceId: string;
  pageId: string;
}

export interface PersistedPageDocument {
  state: Uint8Array;
  stateVector: Uint8Array;
  updatedAt: number;
}

/** The persistence surface the desktop collaboration host binds to. */
export interface PageDocumentReplica {
  load(scope: PageDocumentScope): PersistedPageDocument | undefined;
  save(scope: PageDocumentScope, state: Uint8Array, stateVector: Uint8Array): void;
}

export const KNOWLEDGE_PAGE_DOCUMENT_SCHEMA = 'knowledge_page_document';

export function createSqlitePageDocumentReplica(db: Database): PageDocumentReplica {
  const load = db.prepare('SELECT state, state_vector, updated_at FROM knowledge_page_document WHERE workspace_id = ? AND page_id = ?');
  const save = db.prepare(`
    INSERT INTO knowledge_page_document (workspace_id, page_id, state, state_vector, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (workspace_id, page_id) DO UPDATE
      SET state = excluded.state, state_vector = excluded.state_vector, updated_at = excluded.updated_at
  `);
  return {
    load(scope) {
      const row = load.get(scope.workspaceId, scope.pageId) as { state: Uint8Array; state_vector: Uint8Array; updated_at: number } | null;
      if (!row) return undefined;
      return { state: new Uint8Array(row.state), stateVector: new Uint8Array(row.state_vector), updatedAt: row.updated_at };
    },
    save(scope, state, stateVector) {
      save.run(scope.workspaceId, scope.pageId, state, stateVector, Date.now());
    },
  };
}
