import { z } from 'zod';
import type { DatabaseColumnInfo } from './database';
import type { RelationalProvider } from './relational';

export const tableTransferInputSchema = z.object({
  mode: z.literal('append'),
  mappings: z.array(z.object({ sourceColumn: z.string().min(1).max(256), targetColumn: z.string().min(1).max(256), conversion: z.enum(['native', 'text', 'binary-hex', 'binary-base64']) }).strict()).min(1).max(256),
  maxRows: z.number().int().min(1).max(100000).default(20000), batchSize: z.number().int().min(1).max(1000).default(200),
  rowLimitMode: z.enum(['require-complete', 'first-rows']).default('require-complete'),
}).strict();
export type TableTransferInput = z.infer<typeof tableTransferInputSchema>;
export type TableTransferMapping = TableTransferInput['mappings'][number];
export interface TableTransferEndpoint { connectionId: string; provider: RelationalProvider; schema: string; table: string }
export interface TableTransferIssue { severity: 'error' | 'warning'; sourceColumn?: string; targetColumn?: string; message: string }
export interface TableTransferPlan {
  source: TableTransferEndpoint; target: TableTransferEndpoint; input: TableTransferInput;
  columns: { mapping: TableTransferMapping; source: DatabaseColumnInfo; target: DatabaseColumnInfo; sourceProjection: 'native' | 'text' }[];
  orderBy: string[]; sourcePreviewSql: string; targetPreviewSql: string;
  effectiveBatchSize: number; maxBytes: number; issues: TableTransferIssue[]; executable: boolean;
  sourceHasMore: null;
}
export interface TableTransferProgress {
  phase: 'reading' | 'writing' | 'committing' | 'completed' | 'rolling-back';
  rowsRead: number; rowsWritten: number; batchesWritten: number; bytesRead: number; elapsedMs: number;
  /** Read limit is a bound, not an estimated source total. */
  maxRows: number;
}
export interface TableTransferResult {
  status: 'committed' | 'cancelled' | 'failed' | 'unknown'; transaction: 'committed' | 'rolled-back' | 'not-started' | 'unknown';
  rowsRead: number; rowsWritten: number; rowsCommitted: number | null; batchesWritten: number; bytesRead: number;
  sourceHasMore: boolean | null; elapsedMs: number; error: string | null;
}
export { tableTransferTypeFamily, tableTransferColumnOmittable, validateTableTransferMapping } from './table-transfer-types';
