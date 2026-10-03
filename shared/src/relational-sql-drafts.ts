/** DBX openTabsPersistence transport, restricted to the relational SQL surface. */
export type SqlResultView = 'table' | 'text' | 'json' | 'chart' | 'summary' | 'messages';
export interface SqlEditorPosition { anchor: number; head: number; scrollTop: number; scrollLeft: number }
export interface SqlDraftTab {
  id: string;
  title: string;
  customTitle: boolean;
  pinned: boolean;
  database: string;
  schema: string | null;
  sql: string;
  originalSql: string;
  savedFile: { id: string; version: string; name: string; folderId: string | null } | null;
  editorPosition: SqlEditorPosition;
  resultView: SqlResultView;
}
export interface SqlDraftSnapshot { tabs: SqlDraftTab[]; activeTabId: string | null }
export interface SqlDraftState extends SqlDraftSnapshot { version: string | null; updatedAt: number | null }
export const SQL_DRAFT_MAX_BYTES = 64 * 1024 * 1024;
