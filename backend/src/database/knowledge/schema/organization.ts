import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, primaryKey, text, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { Workspace } from '@fouc/shared/knowledge/contracts';
import { memberRole, permissionLevel, workspaceKind } from './enums';
import { authUser } from '../../identity/schema';
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

export const workspaceInvitation = knowledge.table('workspace_invitation', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  email: text('email').notNull(),
  role: memberRole('role').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  invitedBy: uuid('invited_by').notNull().references(() => authUser.id),
  expiresAt: instant('expires_at').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  acceptedAt: instant('accepted_at'),
  acceptedBy: uuid('accepted_by').references(() => authUser.id, { onDelete: 'set null' }),
  revokedAt: instant('revoked_at'),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  unique('workspace_invitation_token_unique').on(table.workspaceId, table.tokenHash),
  uniqueIndex('workspace_invitation_pending_email_idx').on(table.workspaceId, table.email)
    .where(sql`${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL`),
  index('workspace_invitation_expiry_idx').on(table.workspaceId, table.expiresAt),
  check('workspace_invitation_role', sql`${table.role} <> 'owner'`),
  check('workspace_invitation_email', sql`${table.email} = lower(btrim(${table.email})) AND position('@' IN ${table.email}) > 1`),
  check('workspace_invitation_token_hash', sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
  check('workspace_invitation_expiry', sql`${table.expiresAt} > ${table.createdAt}`),
  check('workspace_invitation_state', sql`(${table.acceptedAt} IS NULL OR ${table.revokedAt} IS NULL) AND (${table.acceptedBy} IS NULL OR ${table.acceptedAt} IS NOT NULL)`),
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
