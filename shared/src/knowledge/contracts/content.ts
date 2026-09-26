import { z } from 'zod';
import { assetHashSchema, blockIdSchema, entityIdSchema, pageScopeSchema, timestampSchema, workspaceScopeSchema } from './primitives';

export const blockReferenceSchema = pageScopeSchema.extend({ blockId: blockIdSchema });
export const citationSchema = blockReferenceSchema.extend({ pageTitle: z.string(), excerpt: z.string() });
export const searchInputSchema = workspaceScopeSchema.extend({
  query: z.string().trim().min(1).max(4000),
  filters: z.strictObject({
    teamspaceId: entityIdSchema.optional(),
    pageIds: z.array(entityIdSchema).max(100).optional(),
    blockTypes: z.array(z.string().min(1).max(60)).max(30).optional(),
  }).default({}),
  limit: z.number().int().min(1).max(20).default(20),
});
export const searchHitSchema = citationSchema.extend({ score: z.number().finite(), contentMd: z.string(), blockType: z.string() });
export const readPageInputSchema = pageScopeSchema.extend({ range: z.array(blockIdSchema).min(1).max(100).optional() });
export const blockWriteInputSchema = pageScopeSchema.extend({ markdown: z.string().min(1).max(1_000_000) });
export const insertBlocksInputSchema = blockWriteInputSchema.extend({ afterBlockId: blockIdSchema.nullable() });
export const replaceBlocksInputSchema = blockWriteInputSchema.extend({ blockIds: z.array(blockIdSchema).min(1).max(1000) });
export const deleteBlocksInputSchema = pageScopeSchema.extend({ blockIds: z.array(blockIdSchema).min(1).max(1000) });

export const commentThreadSchema = pageScopeSchema.extend({ id: entityIdSchema, status: z.enum(['open', 'resolved']), createdAt: timestampSchema });
export const commentSchema = workspaceScopeSchema.extend({
  id: entityIdSchema, threadId: entityIdSchema, authorId: entityIdSchema,
  bodyMd: z.string().trim().min(1).max(50_000), createdAt: timestampSchema, updatedAt: timestampSchema,
});
export const checkpointSummarySchema = pageScopeSchema.extend({
  id: entityIdSchema, createdAt: timestampSchema, authors: z.array(entityIdSchema), label: z.string().max(200).nullable(),
});
export const transcriptSegmentSchema = z.strictObject({ start: z.number().nonnegative(), end: z.number().nonnegative(), text: z.string() })
  .refine((segment) => segment.end >= segment.start, '转写片段结束时间不能早于开始时间');
export const assetDerivedSchema = z.strictObject({
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  description: z.string().optional(),
  ocr: z.string().optional(),
  markdown: z.string().optional(),
  transcript: z.array(transcriptSegmentSchema).optional(),
  error: z.string().optional(),
});
export const assetSchema = workspaceScopeSchema.extend({
  hash: assetHashSchema, mime: z.string().min(1).max(200), size: z.number().int().nonnegative(),
  meta: z.record(z.string(), z.json()), derived: assetDerivedSchema,
});
export const uploadIntentSchema = workspaceScopeSchema.extend({
  hash: assetHashSchema, mime: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
  size: z.number().int().positive().max(5 * 1024 ** 3), name: z.string().min(1).max(255),
});

export type BlockReference = z.infer<typeof blockReferenceSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type SearchHit = z.infer<typeof searchHitSchema>;
export type CommentThread = z.infer<typeof commentThreadSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetDerived = z.infer<typeof assetDerivedSchema>;
