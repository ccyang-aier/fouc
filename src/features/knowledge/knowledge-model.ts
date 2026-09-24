export interface ProjectSummary { id: string; name: string; iconId: string; parentId: string | null; starred: boolean; createdAt: number; updatedAt: number }
export interface HyperdocDocumentSummary { id: string; title: string; content: string; projectId: string | null; starred: boolean; trashedAt: number | null; createdAt: number; updatedAt: number }
export interface TagSummary { id: string; name: string; color: string }
export interface DocumentVersion { id: string; documentId: string; title: string; content: string; createdAt: number }
export interface KnowledgeSnapshot { projects: ProjectSummary[]; documents: HyperdocDocumentSummary[]; tags: TagSummary[]; documentTags: Record<string, string[]> }
export const EMPTY_KNOWLEDGE: KnowledgeSnapshot = { projects: [], documents: [], tags: [], documentTags: {} }
