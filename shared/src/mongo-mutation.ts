import type { MongoNamespace } from './mongo';
export type MongoMutationOperation = 'insert-document' | 'replace-document' | 'delete-document' | 'create-collection' | 'drop-collection' | 'create-index' | 'drop-index';
export type MongoMutationInput = MongoNamespace & (
  | { operation: 'insert-document'; documentEjson: string }
  | { operation: 'replace-document'; originalEjson: string; documentEjson: string }
  | { operation: 'delete-document'; originalEjson: string }
  | { operation: 'create-collection'; optionsEjson?: string }
  | { operation: 'drop-collection' }
  | { operation: 'create-index'; keysEjson: string; optionsEjson?: string }
  | { operation: 'drop-index'; indexName: string }
);
export interface MongoMutationReview extends MongoNamespace {
  operation: MongoMutationOperation; title: string; destructive: boolean;
  before: string | null; after: string | null; documentId: string | null;
  indexName: string | null; affectedCount: string | null; warnings: string[];
}
export interface MongoMutationSummary extends MongoNamespace {
  operation: MongoMutationOperation; affectedCount: string | null; documentId: string | null;
  indexName: string | null; elapsedMs: number;
}
export const MONGO_MUTATION_TITLES: Record<MongoMutationOperation, string> = {
  'insert-document': '新增文档', 'replace-document': '替换文档', 'delete-document': '删除文档',
  'create-collection': '新建集合', 'drop-collection': '删除集合', 'create-index': '创建索引', 'drop-index': '删除索引',
};
