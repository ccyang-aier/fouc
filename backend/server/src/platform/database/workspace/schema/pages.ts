import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, jsonb, primaryKey, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import type { PgTableExtraConfigValue } from 'drizzle-orm/pg-core';
import type { Principal, Properties, PropertyDefinition } from '@fouc/shared/knowledge/contracts';
import { pageKind, permissionLevel } from './enums';
import { authUser } from '../../identity/schema';
import { workspaceNamespace } from './namespaces';
import { teamspace } from './knowledge';
import { bytea, instant, ltree } from './types';

export const page = workspaceNamespace.table('page', {
  workspaceId: uuid('workspace_id').notNull(),
  id: uuid('id').notNull(),
  teamspaceId: uuid('teamspace_id').notNull(),
  parentId: uuid('parent_id'),
  position: varchar('position', { length: 256 }).notNull(),
  path: ltree('path').notNull(),
  kind: pageKind('kind').notNull().default('doc'),
  databaseId: uuid('database_id'),
  properties: jsonb('properties').$type<Properties>().notNull().default({}),
  title: varchar('title', { length: 500 }).notNull().default(''),
  icon: varchar('icon', { length: 200 }),
  cover: varchar('cover', { length: 2048 }),
  inheritsPermissions: boolean('inherits_permissions').notNull().default(true),
  // ACL materializations must match this revision before serving access.
  aclRevision: bigint('acl_revision', { mode: 'number' }).notNull().default(0),
  createdBy: uuid('created_by').notNull().references(() => authUser.id),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
  deletedAt: instant('deleted_at'),
}, (table): PgTableExtraConfigValue[] => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  unique('page_workspace_teamspace_id_unique').on(table.workspaceId, table.teamspaceId, table.id),
  unique('page_workspace_teamspace_id_kind_unique').on(table.workspaceId, table.teamspaceId, table.id, table.kind),
  unique('page_workspace_path_unique').on(table.workspaceId, table.path),
  foreignKey({ name: 'page_teamspace_fk', columns: [table.workspaceId, table.teamspaceId], foreignColumns: [teamspace.workspaceId, teamspace.id] }).onDelete('cascade'),
  foreignKey({ name: 'page_parent_fk', columns: [table.workspaceId, table.teamspaceId, table.parentId], foreignColumns: [table.workspaceId, table.teamspaceId, table.id] }).onUpdate('cascade'),
  foreignKey({ name: 'page_database_fk', columns: [table.workspaceId, table.teamspaceId, table.databaseId], foreignColumns: [databaseDefinition.workspaceId, databaseDefinition.teamspaceId, databaseDefinition.pageId] }).onUpdate('cascade'),
  check('page_not_own_parent', sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`),
  check('page_row_database_relation', sql`(${table.kind} = 'row') = (${table.databaseId} IS NOT NULL)`),
  check('page_not_own_database', sql`${table.databaseId} IS NULL OR ${table.databaseId} <> ${table.id}`),
  check('page_position_valid', sql`${table.position} ~ '^[A-Za-z0-9]+$'`),
  check('page_path_valid', sql`nlevel(${table.path}) > 0 AND subpath(${table.path}, -1)::text = replace(${table.id}::text, '-', '_')`),
  check('page_root_path_depth', sql`(${table.parentId} IS NULL) = (nlevel(${table.path}) = 1)`),
  check('page_properties_object', sql`jsonb_typeof(${table.properties}) = 'object'`),
  check('page_acl_revision_nonnegative', sql`${table.aclRevision} >= 0`),
  index('page_tree_idx').on(table.workspaceId, table.teamspaceId, table.parentId, table.position).where(sql`${table.deletedAt} IS NULL`),
  index('page_parent_idx').on(table.workspaceId, table.teamspaceId, table.parentId),
  index('page_database_idx').on(table.workspaceId, table.teamspaceId, table.databaseId),
  index('page_path_gist_idx').using('gist', table.path),
  index('page_created_by_idx').on(table.createdBy),
]);

export const databaseDefinition = workspaceNamespace.table('database_definition', {
  workspaceId: uuid('workspace_id').notNull(),
  pageId: uuid('page_id').notNull(),
  teamspaceId: uuid('teamspace_id').notNull(),
  pageKind: pageKind('page_kind').notNull().default('database'),
  properties: jsonb('properties').$type<PropertyDefinition[]>().notNull().default([]),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table): PgTableExtraConfigValue[] => [
  primaryKey({ columns: [table.workspaceId, table.pageId] }),
  unique('database_definition_teamspace_page_unique').on(table.workspaceId, table.teamspaceId, table.pageId),
  foreignKey({ name: 'database_definition_page_fk', columns: [table.workspaceId, table.teamspaceId, table.pageId, table.pageKind], foreignColumns: [page.workspaceId, page.teamspaceId, page.id, page.kind] }).onDelete('cascade').onUpdate('cascade'),
  check('database_definition_database_kind', sql`${table.pageKind} = 'database'`),
  check('database_definition_properties_array', sql`jsonb_typeof(${table.properties}) = 'array' AND jsonb_array_length(${table.properties}) <= 100`),
]);

export const docState = workspaceNamespace.table('doc_state', {
  workspaceId: uuid('workspace_id').notNull(),
  pageId: uuid('page_id').notNull(),
  state: bytea('state').notNull(),
  stateVector: bytea('state_vector').notNull(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.pageId] }),
  foreignKey({ columns: [table.workspaceId, table.pageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
]);

export const docCheckpoint = workspaceNamespace.table('doc_checkpoint', {
  workspaceId: uuid('workspace_id').notNull(),
  id: uuid('id').notNull(),
  pageId: uuid('page_id').notNull(),
  state: bytea('state').notNull(),
  stateVector: bytea('state_vector').notNull(),
  authors: uuid('authors').array().notNull().default(sql`ARRAY[]::uuid[]`),
  label: varchar('label', { length: 200 }),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  foreignKey({ columns: [table.workspaceId, table.pageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  index('doc_checkpoint_page_time_idx').on(table.workspaceId, table.pageId, table.createdAt),
]);

export const pageAcl = workspaceNamespace.table('page_acl', {
  workspaceId: uuid('workspace_id').notNull(),
  pageId: uuid('page_id').notNull(),
  principal: text('principal').$type<Principal>().notNull(),
  level: permissionLevel('level').notNull(),
  inherited: boolean('inherited').notNull().default(false),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.pageId, table.principal] }),
  foreignKey({ columns: [table.workspaceId, table.pageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  check('page_acl_principal_valid', sql`${table.principal} ~ '^(user|group|workspace|link):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`),
  index('page_acl_principal_idx').on(table.workspaceId, table.principal),
]);

export const pageEffectiveAcl = workspaceNamespace.table('page_effective_acl', {
  workspaceId: uuid('workspace_id').notNull(),
  pageId: uuid('page_id').notNull(),
  view: text('view_principals').array().$type<Principal[]>().notNull().default(sql`ARRAY[]::text[]`),
  comment: text('comment_principals').array().$type<Principal[]>().notNull().default(sql`ARRAY[]::text[]`),
  edit: text('edit_principals').array().$type<Principal[]>().notNull().default(sql`ARRAY[]::text[]`),
  full: text('full_principals').array().$type<Principal[]>().notNull().default(sql`ARRAY[]::text[]`),
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.pageId] }),
  foreignKey({ columns: [table.workspaceId, table.pageId], foreignColumns: [page.workspaceId, page.id] }).onDelete('cascade'),
  check('page_effective_acl_level_hierarchy', sql`${table.view} @> ${table.comment} AND ${table.comment} @> ${table.edit} AND ${table.edit} @> ${table.full}`),
  check('page_effective_acl_revision_nonnegative', sql`${table.revision} >= 0`),
  index('page_effective_acl_view_gin_idx').using('gin', table.view),
  index('page_effective_acl_comment_gin_idx').using('gin', table.comment),
  index('page_effective_acl_edit_gin_idx').using('gin', table.edit),
  index('page_effective_acl_full_gin_idx').using('gin', table.full),
]);
