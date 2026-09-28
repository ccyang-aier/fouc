import { sql } from 'drizzle-orm';
import { check, foreignKey, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { permissionLevel } from './enums';
import { workspace } from './organization';
import { workspaceNamespace } from './namespaces';
import { instant } from './types';

export const knowledgeBase = workspaceNamespace.table('knowledge_base', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  check('knowledge_base_name_not_empty', sql`length(btrim(${table.name})) > 0`),
]);

export const teamspace = workspaceNamespace.table('teamspace', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  defaultAccess: permissionLevel('default_access'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  foreignKey({ name: 'teamspace_knowledge_base_fk', columns: [table.workspaceId, table.knowledgeBaseId], foreignColumns: [knowledgeBase.workspaceId, knowledgeBase.id] }).onDelete('cascade'),
  check('teamspace_name_not_empty', sql`length(btrim(${table.name})) > 0`),
]);
