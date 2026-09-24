import type { Db } from '../store/db';

export interface KnowledgeProject { id: string; name: string; iconId: string; parentId: string | null; starred: boolean; createdAt: number; updatedAt: number }
export interface KnowledgeDocument { id: string; title: string; content: string; projectId: string | null; starred: boolean; trashedAt: number | null; createdAt: number; updatedAt: number }
export interface KnowledgeTag { id: string; name: string; color: string }
export interface KnowledgeVersion { id: string; documentId: string; title: string; content: string; createdAt: number }
export interface KnowledgeSnapshot { projects: KnowledgeProject[]; documents: KnowledgeDocument[]; tags: KnowledgeTag[]; documentTags: Record<string, string[]> }

type ProjectRow = { id: string; name: string; icon_id: string; parent_id: string | null; starred: number; created_at: number; updated_at: number };
type DocumentRow = { id: string; title: string; content: string; project_id: string | null; starred: number; trashed_at: number | null; created_at: number; updated_at: number };
type TagRow = KnowledgeTag;
type VersionRow = { id: string; document_id: string; title: string; content: string; created_at: number };

const projectFromRow = (row: ProjectRow): KnowledgeProject => ({ id: row.id, name: row.name, iconId: row.icon_id, parentId: row.parent_id, starred: Boolean(row.starred), createdAt: row.created_at, updatedAt: row.updated_at });
const documentFromRow = (row: DocumentRow): KnowledgeDocument => ({ id: row.id, title: row.title, content: row.content, projectId: row.project_id, starred: Boolean(row.starred), trashedAt: row.trashed_at, createdAt: row.created_at, updatedAt: row.updated_at });

export class KnowledgeRepository {
  constructor(private readonly db: Db) {}

  snapshot(): KnowledgeSnapshot {
    const projects = (this.db.prepare('SELECT * FROM knowledge_project ORDER BY created_at, id').all() as ProjectRow[]).map(projectFromRow);
    const documents = (this.db.prepare('SELECT * FROM knowledge_document ORDER BY updated_at DESC, id').all() as DocumentRow[]).map(documentFromRow);
    const tags = this.db.prepare('SELECT * FROM knowledge_tag ORDER BY name').all() as TagRow[];
    const rows = this.db.prepare('SELECT document_id, tag_id FROM knowledge_document_tag').all() as { document_id: string; tag_id: string }[];
    const documentTags: Record<string, string[]> = {};
    for (const row of rows) (documentTags[row.document_id] ??= []).push(row.tag_id);
    return { projects, documents, tags, documentTags };
  }

  project(id: string) { return this.db.prepare('SELECT * FROM knowledge_project WHERE id = ?').get(id) as ProjectRow | undefined; }
  document(id: string) { return this.db.prepare('SELECT * FROM knowledge_document WHERE id = ?').get(id) as DocumentRow | undefined; }
  tag(id: string) { return this.db.prepare('SELECT * FROM knowledge_tag WHERE id = ?').get(id) as TagRow | undefined; }

  createProject(name: string, iconId: string, parentId: string | null = null): KnowledgeProject {
    if (parentId && !this.project(parentId)) throw new Error('项目不存在');
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare('INSERT INTO knowledge_project (id, name, icon_id, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, iconId, parentId, now, now);
    return projectFromRow(this.project(id)!);
  }

  renameProject(id: string, name: string) {
    this.db.prepare('UPDATE knowledge_project SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id);
  }
  starProject(id: string, starred: boolean) { this.db.prepare('UPDATE knowledge_project SET starred = ?, updated_at = ? WHERE id = ?').run(Number(starred), Date.now(), id); }
  deleteProject(id: string) { this.db.prepare('DELETE FROM knowledge_project WHERE id = ?').run(id); }

  createDocument(projectId: string | null = null, tagId: string | null = null): KnowledgeDocument {
    if (projectId && !this.project(projectId)) throw new Error('项目不存在');
    if (tagId && !this.tag(tagId)) throw new Error('标签不存在');
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO knowledge_document (id, title, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, 'Untitled', projectId, now, now);
      if (tagId) this.db.prepare('INSERT INTO knowledge_document_tag (document_id, tag_id) VALUES (?, ?)').run(id, tagId);
    })();
    return documentFromRow(this.document(id)!);
  }

  private saveVersion(row: DocumentRow) {
    this.db.prepare('INSERT INTO knowledge_document_version (id, document_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), row.id, row.title, row.content, Date.now());
  }
  updateDocument(id: string, input: { title?: string; content?: string }) {
    const row = this.document(id);
    if (!row) throw new Error('文档不存在');
    this.db.transaction(() => {
      this.saveVersion(row);
      this.db.prepare('UPDATE knowledge_document SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(input.title ?? row.title, input.content ?? row.content, Date.now(), id);
    })();
  }
  starDocument(id: string, starred: boolean) { this.db.prepare('UPDATE knowledge_document SET starred = ?, updated_at = ? WHERE id = ?').run(Number(starred), Date.now(), id); }
  trashDocument(id: string, trashed: boolean) { this.db.prepare('UPDATE knowledge_document SET trashed_at = ?, updated_at = ? WHERE id = ?').run(trashed ? Date.now() : null, Date.now(), id); }
  moveDocument(id: string, projectId: string | null) {
    if (projectId && !this.project(projectId)) throw new Error('项目不存在');
    this.db.prepare('UPDATE knowledge_document SET project_id = ?, updated_at = ? WHERE id = ?').run(projectId, Date.now(), id);
  }
  deleteDocument(id: string) { this.db.prepare('DELETE FROM knowledge_document WHERE id = ?').run(id); }
  versions(documentId: string): KnowledgeVersion[] {
    return (this.db.prepare('SELECT * FROM knowledge_document_version WHERE document_id = ? ORDER BY created_at DESC').all(documentId) as VersionRow[]).map((row) => ({ id: row.id, documentId: row.document_id, title: row.title, content: row.content, createdAt: row.created_at }));
  }
  restoreVersion(documentId: string, versionId: string) {
    const version = this.db.prepare('SELECT * FROM knowledge_document_version WHERE id = ? AND document_id = ?').get(versionId, documentId) as VersionRow | undefined;
    if (!version) throw new Error('版本不存在');
    this.updateDocument(documentId, { title: version.title, content: version.content });
  }

  createTag(name: string, color: string): KnowledgeTag {
    const id = crypto.randomUUID();
    this.db.prepare('INSERT INTO knowledge_tag (id, name, color) VALUES (?, ?, ?)').run(id, name, color);
    return this.tag(id)!;
  }
  renameTag(id: string, name: string) { this.db.prepare('UPDATE knowledge_tag SET name = ? WHERE id = ?').run(name, id); }
  deleteTag(id: string) { this.db.prepare('DELETE FROM knowledge_tag WHERE id = ?').run(id); }
  assignTag(documentId: string, tagId: string) { this.db.prepare('INSERT OR IGNORE INTO knowledge_document_tag (document_id, tag_id) VALUES (?, ?)').run(documentId, tagId); }
  unassignTag(documentId: string, tagId: string) { this.db.prepare('DELETE FROM knowledge_document_tag WHERE document_id = ? AND tag_id = ?').run(documentId, tagId); }
}
