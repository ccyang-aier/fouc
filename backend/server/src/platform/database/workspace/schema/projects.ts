import { sql } from 'drizzle-orm';
import { check, index, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { authUser } from '../../identity/schema';
import { workspace } from './organization';
import { workspaceNamespace } from './namespaces';
import { instant } from './types';

export const project = workspaceNamespace.table('project', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  createdBy: uuid('created_by').references(() => authUser.id),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  check('project_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  index('project_workspace_name_idx').on(table.workspaceId, table.name),
]);
