import { z } from 'zod';
import type { RelationalProvider } from './relational';

export const structureDefaultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('text'), value: z.string().max(65536) }).strict(),
  z.object({ kind: z.literal('number'), value: z.string().max(256) }).strict(),
  z.object({ kind: z.literal('boolean'), value: z.boolean() }).strict(),
  z.object({ kind: z.literal('null') }).strict(),
  z.object({ kind: z.literal('expression'), value: z.string().min(1).max(8192) }).strict(),
]);
export type StructureDefault = z.infer<typeof structureDefaultSchema>;
export const structureGenerationSchema = z.object({
  expression: z.string().min(1).max(8192), storage: z.enum(['stored', 'virtual']),
}).strict();
export const structureIdentitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('auto-increment') }).strict(),
  z.object({ kind: z.literal('always'), start: z.string().regex(/^-?\d+$/).max(20).optional(), increment: z.string().regex(/^-?\d+$/).max(20).optional() }).strict(),
  z.object({ kind: z.literal('by-default'), start: z.string().regex(/^-?\d+$/).max(20).optional(), increment: z.string().regex(/^-?\d+$/).max(20).optional() }).strict(),
]);
const fields = {
  name: z.string().min(1).max(256), dataType: z.string().min(1).max(2048), nullable: z.boolean(),
  default: structureDefaultSchema, comment: z.string().max(65536),
  generated: structureGenerationSchema.nullable(), identity: structureIdentitySchema.nullable(),
};
export const structureColumnSchema = z.object(fields).strict();
export type StructureColumn = z.infer<typeof structureColumnSchema>;
export const structureColumnPatchSchema = structureColumnSchema.partial().refine((value) => Object.keys(value).length > 0, '字段修改不能为空');
export type StructureColumnPatch = z.infer<typeof structureColumnPatchSchema>;
export const structureIndexSchema = z.object({
  name: z.string().min(1).max(256), unique: z.boolean(), method: z.enum(['btree', 'hash', 'gin', 'gist', 'spgist', 'brin', 'fulltext', 'spatial']),
  parts: z.array(z.object({ column: z.string().min(1).max(256), descending: z.boolean(), prefixLength: z.number().int().min(1).max(65535).optional() }).strict()).min(1).max(32),
  include: z.array(z.string().min(1).max(256)).max(32), predicate: z.string().max(8192), comment: z.string().max(65536),
}).strict();
export type StructureIndex = z.infer<typeof structureIndexSchema>;
const id = z.string().min(1).max(128);
export const structureEditOperationSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('add-column'), column: structureColumnSchema }).strict(),
  z.object({ id, kind: z.literal('update-column'), originalName: z.string().min(1).max(256), patch: structureColumnPatchSchema }).strict(),
  z.object({ id, kind: z.literal('drop-column'), name: z.string().min(1).max(256) }).strict(),
  z.object({ id, kind: z.literal('set-primary-key'), columns: z.array(z.string().min(1).max(256)).max(32) }).strict(),
  z.object({ id, kind: z.literal('add-index'), index: structureIndexSchema }).strict(),
  z.object({ id, kind: z.literal('drop-index'), name: z.string().min(1).max(256) }).strict(),
]);
export type StructureEditOperation = z.infer<typeof structureEditOperationSchema>;
/** HTTP adapters parse this exact object, never client-provided SQL or snapshots. */
export const structureEditInputSchema = z.object({ operations: z.array(structureEditOperationSchema).min(1).max(256) }).strict();
export type StructureEditInput = z.infer<typeof structureEditInputSchema>;
export interface StructureEditIssue { operationId: string | null; severity: 'error' | 'warning' | 'manual'; message: string }
export interface StructureEditStep { id: string; operationId: string; label: string; sql: string; risk: 'normal' | 'review' | 'destructive' }
export interface StructureEditPreview {
  provider: RelationalProvider; schema: string; table: string; operations: StructureEditOperation[];
  steps: StructureEditStep[]; issues: StructureEditIssue[]; executable: boolean;
  transaction: 'atomic' | 'implicit-commit'; script: string;
}
export interface StructureEditStepResult { id: string; status: 'committed' | 'rolled-back' | 'failed' | 'unattempted' | 'unknown'; error?: string }
export interface StructureEditCommitResult {
  provider: RelationalProvider; outcome: 'committed' | 'rolled-back' | 'partial' | 'failed' | 'unknown';
  steps: StructureEditStepResult[]; error: string | null;
}
export { structureTypeOptions, validateStructureDataType, validateStructureExpression, validateStructureIdentifier, structureSqlLiteral } from './relational-structure-edit-validation';
export { structureColumnFromMetadata, structureNativeColumnClause } from './relational-structure-edit-metadata';
