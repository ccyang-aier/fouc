import type { MongoNamespace } from './mongo';
import type { MongoTabularConfig } from './mongo-tabular';

export const MONGO_DOCUMENT_TRANSFER_LIMITS = {
  inputBytes: 32 * 1024 * 1024,
  documentBytes: 256 * 1024,
  documents: 5000,
  batchDocuments: 100,
  exportBytes: 1024 * 1024 * 1024,
  browserBytes: 64 * 1024 * 1024,
  planMs: 5 * 60_000,
  sampleDocuments: 10,
} as const;

export type MongoImportFieldType = 'string' | 'objectId' | 'int32' | 'int64' | 'decimal128' | 'double' | 'date' | 'boolean';
/** JSON Pointer: /address/city; /items/0/price. ~1 and ~0 escape slash and tilde. */
export type MongoImportFieldMapping = { path: string; type: MongoImportFieldType };
export type MongoDocumentImportInput = MongoNamespace & {
  text: string;
  format: 'json' | 'ndjson' | 'csv' | 'tsv';
  idPolicy: 'preserve' | 'generate';
  fields?: MongoImportFieldMapping[];
  /** Required only for CSV/TSV; all type choices are explicit. */
  tabular?: MongoTabularConfig;
};
export type MongoDocumentImportField = { path: string; types: string[]; present: number };
export type MongoDocumentImportPreview = MongoNamespace & {
  planId: string;
  expiresAt: string;
  documents: number;
  bytes: number;
  idPolicy: MongoDocumentImportInput['idPolicy'];
  generatedIds: number;
  existingIds: number;
  samples: string[];
  fields: MongoDocumentImportField[];
  warnings: string[];
};
export type MongoDocumentImportState = 'ready' | 'running' | 'complete' | 'partial' | 'cancelled' | 'failed' | 'unknown';
export type MongoDocumentImportStatus = {
  planId: string;
  state: MongoDocumentImportState;
  total: number;
  inserted: number;
  processed: number;
  /** Only server-acknowledged IDs. Row is a zero-based source document index. */
  insertedIds: { row: number; idEjson: string }[];
  error: { row: number | null; code: number | null; message: string } | null;
  uncertainDocuments: number;
  cancelRequested: boolean;
};
export type MongoDocumentExportInput = MongoNamespace & {
  filter?: string;
  sort?: string;
  scope: 'all' | 'first';
  limit?: number;
};
export type MongoDocumentExportProgress = { bytes: number; documents: number };
