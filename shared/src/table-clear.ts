import type { RelationalProvider } from './relational';
import type { RelationalTableStructure, RelationalTrigger } from './relational-structure';

export const TABLE_CLEAR_LIMITS = { requestBytes: 4096, plans: 4, lifetimeMs: 5 * 60_000, references: 1000 } as const;
export interface TableClearInput {
  schema: string;
  table: string;
  acknowledgeIdentityReset: boolean;
  acknowledgeTriggers: boolean;
}
export interface TableClearReference {
  schema: string;
  table: string;
  constraint: string;
  columns: string[];
  referencedColumns: string[];
  onDelete: string;
}
export interface TableClearReview {
  provider: RelationalProvider;
  schema: string;
  table: string;
  confirmationName: string;
  sql: string;
  operation: 'truncate' | 'delete';
  transaction: 'atomic' | 'implicit-commit';
  identity: 'preserved' | 'reset' | 'not-applicable';
  /** COUNT at review time under the current role; no concurrency snapshot is promised. */
  visibleRowCount: string;
  countedAt: number;
  permission: 'allowed' | 'denied' | 'unknown';
  permissionDetail: string;
  structure: RelationalTableStructure;
  incomingReferences: TableClearReference[];
  triggers: RelationalTrigger[];
  referenceCoverage: string;
  blockedReasons: string[];
  warnings: string[];
}
export interface TableClearPrepared { planId: string; expiresAt: number; review: TableClearReview }
export interface TableClearConfirmation { confirm: true; tableName: string }
export interface TableClearCommitResult {
  outcome: 'cleared' | 'rejected' | 'unknown';
  schema: string;
  table: string;
  sql: string;
  message: string;
  /** Only SQLite DELETE provides a native affected count; TRUNCATE is not an affected-row count. */
  affectedRows: string | null;
  executionTimeMs: number;
}

export function parseTableClearInput(value: unknown): TableClearInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('清空目标无效。');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['schema', 'table', 'acknowledgeIdentityReset', 'acknowledgeTriggers'].includes(key))) throw new Error('清空维护不接受原始 SQL 或额外参数。');
  for (const key of ['schema', 'table']) {
    const name = input[key];
    if (typeof name !== 'string' || !name.trim() || new TextEncoder().encode(name).length > 255 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('请输入有效的原生 Schema 和完整表名。');
  }
  for (const key of ['acknowledgeIdentityReset', 'acknowledgeTriggers']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error('风险确认参数必须是布尔值。');
  return { schema: input.schema as string, table: input.table as string, acknowledgeIdentityReset: input.acknowledgeIdentityReset === true, acknowledgeTriggers: input.acknowledgeTriggers === true };
}

export function parseTableClearConfirmation(value: unknown): TableClearConfirmation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请明确确认清空目标。');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || input.confirm !== true || typeof input.tableName !== 'string' || !input.tableName) throw new Error('请输入完整 Schema.表名并明确确认。');
  return { confirm: true, tableName: input.tableName };
}
