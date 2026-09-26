import { sql } from 'drizzle-orm';
import { bigint, check, foreignKey, index, integer, jsonb, primaryKey, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import type { Asset, Principal } from '@fouc/shared/knowledge/contracts';
import { assetDerivedSchema } from '@fouc/shared/knowledge/contracts';
import { assetStatus, commentThreadStatus } from './enums';
import { authUser } from './identity';
import { knowledge } from './namespaces';
import { workspace } from './organization';
import { page } from './pages';
import { embeddingVector, instant } from './types';

export const blockIndex = knowledge.table('block_index', {
  // pg_search's key_field must be globally unique, unlike a page-local blockId.
  id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: uuid('workspace_id').notNull(),
  pageId: uuid('page_id').notNull(),
  blockId: varchar('block_id', { length: 128 }).notNull(),
  blockType: varchar('block_type', { length: 60 }).notNull(),
  contentMd: text('content_md').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  embedding: embeddingVector('embedding'),
  embedModel: text('embed_model'),
  embedDimensions: integer('embed_dimensions'),
  principals: text('principals').array().$type<Principal[]>().notNull().default(sql`ARRAY[]::text[]`),
  aclRevision: bigint('acl_revision', { mode: 'number' }).notNull().default(0),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('block_index_workspace_page_block_unique').on(table.workspaceId, table.pageId, table.blockId),
  foreignKey({ columns: [table.workspaceId, table.pageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  check('block_index_block_id_valid', sql`${table.blockId} ~ '^[A-Za-z0-9_-]+$'`),
  check('block_index_content_hash_valid', sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
  check('block_index_embedding_metadata', sql`(${table.embedding} IS NULL AND ${table.embedModel} IS NULL AND ${table.embedDimensions} IS NULL) OR (${table.embedding} IS NOT NULL AND ${table.embedModel} IS NOT NULL AND length(${table.embedModel}) > 0 AND ${table.embedDimensions} IS NOT NULL AND ${table.embedDimensions} > 0 AND vector_dims(${table.embedding}) = ${table.embedDimensions})`),
  check('block_index_acl_revision_nonnegative', sql`${table.aclRevision} >= 0`),
  index('block_index_principals_gin_idx').using('gin', table.principals),
  index('block_index_embedding_model_idx').on(table.workspaceId, table.embedModel, table.embedDimensions),
  // BM25 tokenizers and per-model expression HNSW indexes are owned by H02/H03.
]);

/** Keep active vectors readable while a replacement model is being built. */
export const blockEmbeddingStaging = knowledge.table('block_embedding_staging', {
  workspaceId: uuid('workspace_id').notNull(),
  pageId: uuid('page_id').notNull(),
  blockId: varchar('block_id', { length: 128 }).notNull(),
  embedModel: text('embed_model').notNull(),
  embedDimensions: integer('embed_dimensions').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  embedding: embeddingVector('embedding').notNull(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: 'block_embedding_staging_pk', columns: [table.workspaceId, table.pageId, table.blockId, table.embedModel, table.embedDimensions] }),
  foreignKey({ name: 'block_embedding_staging_block_fk', columns: [table.workspaceId, table.pageId, table.blockId], foreignColumns: [blockIndex.workspaceId, blockIndex.pageId, blockIndex.blockId] }).onDelete('cascade'),
  check('block_embedding_staging_hash_valid', sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
  check('block_embedding_staging_metadata', sql`length(${table.embedModel}) > 0 AND ${table.embedDimensions} > 0 AND vector_dims(${table.embedding}) = ${table.embedDimensions}`),
  index('block_embedding_staging_model_idx').on(table.workspaceId, table.embedModel, table.embedDimensions),
]);

export const backlink = knowledge.table('backlink', {
  workspaceId: uuid('workspace_id').notNull(),
  srcPageId: uuid('src_page_id').notNull(),
  srcBlockId: varchar('src_block_id', { length: 128 }).notNull(),
  dstPageId: uuid('dst_page_id').notNull(),
  dstBlockId: varchar('dst_block_id', { length: 128 }),
}, (table) => [
  unique('backlink_source_target_unique').on(table.workspaceId, table.srcPageId, table.srcBlockId, table.dstPageId, table.dstBlockId).nullsNotDistinct(),
  // A block need not have been indexed yet; references are to authoritative pages.
  foreignKey({ columns: [table.workspaceId, table.srcPageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.workspaceId, table.dstPageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  check('backlink_source_block_valid', sql`${table.srcBlockId} ~ '^[A-Za-z0-9_-]+$'`),
  check('backlink_destination_block_valid', sql`${table.dstBlockId} IS NULL OR ${table.dstBlockId} ~ '^[A-Za-z0-9_-]+$'`),
  index('backlink_destination_idx').on(table.workspaceId, table.dstPageId, table.dstBlockId),
]);

export const asset = knowledge.table('asset', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  hash: varchar('hash', { length: 64 }).notNull(),
  mime: varchar('mime', { length: 200 }).notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  status: assetStatus('status').notNull().default('ready'),
  meta: jsonb('meta').$type<Asset['meta']>().notNull().default({}),
  derived: jsonb('derived').$type<Asset['derived']>().notNull().default({ status: 'pending' }),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.hash] }),
  check('asset_hash_valid', sql`${table.hash} ~ '^[a-f0-9]{64}$'`),
  check('asset_size_nonnegative', sql`${table.size} >= 0`),
  check('asset_mime_valid', sql`${table.mime} ~ '^[A-Za-z0-9_.+-]+/[A-Za-z0-9_.+-]+$'`),
  check('asset_meta_object', sql`jsonb_typeof(${table.meta}) = 'object'`),
  check('asset_derived_object', sql`jsonb_typeof(${table.derived}) = 'object' AND ${table.derived}->>'status' IS NOT NULL AND ${table.derived}->>'status' IN (${sql.join(assetDerivedSchema.shape.status.options.map((status) => sql`${status}`), sql`, `)})`.inlineParams()),
]);

export const commentThread = knowledge.table('comment_thread', {
  workspaceId: uuid('workspace_id').notNull(),
  id: uuid('id').notNull(),
  pageId: uuid('page_id').notNull(),
  status: commentThreadStatus('status').notNull().default('open'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  foreignKey({ columns: [table.workspaceId, table.pageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  index('comment_thread_page_idx').on(table.workspaceId, table.pageId, table.status),
]);

export const comment = knowledge.table('comment', {
  workspaceId: uuid('workspace_id').notNull(),
  id: uuid('id').notNull(),
  threadId: uuid('thread_id').notNull(),
  authorId: uuid('author_id').notNull().references(() => authUser.id),
  bodyMd: text('body_md').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  foreignKey({ name: 'comment_thread_fk', columns: [table.workspaceId, table.threadId], foreignColumns: [commentThread.workspaceId, commentThread.id] }).onDelete('cascade'),
  check('comment_body_valid', sql`length(btrim(${table.bodyMd})) BETWEEN 1 AND 50000`),
  index('comment_thread_time_idx').on(table.workspaceId, table.threadId, table.createdAt),
  index('comment_author_idx').on(table.authorId),
]);
