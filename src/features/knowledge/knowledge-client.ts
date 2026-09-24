import { backendFetch } from "@/lib/backend";
import type { DocumentVersion, KnowledgeSnapshot } from "./knowledge-model";

export type KnowledgeAction = {
  action: string;
  id?: string;
  name?: string;
  iconId?: string;
  parentId?: string | null;
  projectId?: string | null;
  tagId?: string | null;
  title?: string;
  content?: string;
  starred?: boolean;
  trashed?: boolean;
  color?: string;
  versionId?: string;
};

export const loadKnowledge = () => backendFetch<KnowledgeSnapshot>("/api/knowledge");
export const runKnowledgeAction = <T = KnowledgeSnapshot>(input: KnowledgeAction) =>
  backendFetch<T>("/api/knowledge/actions", { method: "POST", body: JSON.stringify(input) });
export const loadDocumentVersions = (id: string) =>
  backendFetch<DocumentVersion[]>(`/api/knowledge/documents/${encodeURIComponent(id)}/versions`);
