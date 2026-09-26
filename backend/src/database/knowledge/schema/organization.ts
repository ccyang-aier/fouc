import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, primaryKey, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import type { Workspace } from '@fouc/shared/knowledge/contracts';
import { memberRole, permissionLevel, workspaceKind } from './enums';
import { authUser } from './identity';
import { knowledge } from './namespaces';
import { instant } from './types';

export const workspace = knowledge.table('workspace', {
  // The root entity's id IS its tenant key, without a redundant second UUID.
  id: uuid('workspace_id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  kind: workspaceKind('kind').notNull(),
  settings: jsonb('settings').$type<Workspace['settings']>().notNull().default({}),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  check('workspace_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  check('workspace_settings_object', sql`jsonb_typeof(${table.settings}) = 'object'`),
]);

export const member = knowledge.table('member', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  role: memberRole('role').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  index('member_user_idx').on(table.userId, table.workspaceId),
]);

export const group = knowledge.table('group', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  unique('group_workspace_name_unique').on(table.workspaceId, table.name),
  check('group_name_not_empty', sql`length(btrim(${table.name})) > 0`),
]);

export const groupMember = knowledge.table('group_member', {
  workspaceId: uuid('workspace_id').notNull(),
  groupId: uuid('group_id').notNull(),
  userId: uuid('user_id').notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.groupId, table.userId] }),
  foreignKey({ columns: [table.workspaceId, table.groupId], foreignColumns: [group.workspaceId, group.id] }).onDelete('cascade'),
  foreignKey({ name: 'group_member_membership_fk', columns: [table.workspaceId, table.userId], foreignColumns: [member.workspaceId, member.userId] }).onDelete('cascade'),
  index('group_member_user_idx').on(table.workspaceId, table.userId),
]);

export const teamspace = knowledge.table('teamspace', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  defaultAccess: permissionLevel('default_access'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  check('teamspace_name_not_empty', sql`length(btrim(${table.name})) > 0`),
]);
