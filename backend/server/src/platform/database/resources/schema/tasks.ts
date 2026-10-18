import { sql } from 'drizzle-orm';
import { boolean, check, date, doublePrecision, foreignKey, index, jsonb, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core';
import type { TaskBoardMemberRole, TaskBoardVisibility, TaskChecklistItem, TaskColumnColor, TaskPriority } from '@fouc/shared/tasks';
import { authUser } from '../../identity/schema';
import { resourcesNamespace } from './namespaces';
import { project, projectMember } from './projects';
import { instant } from './types';

export const taskBoard = resourcesNamespace.table('task_board', {
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description').notNull().default(''),
  visibility: varchar('visibility', { length: 12 }).$type<TaskBoardVisibility>().notNull().default('private'),
  ownerId: uuid('owner_id').notNull().references(() => authUser.id),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.id] }),
  check('task_board_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  check('task_board_visibility_valid', sql`${table.visibility} IN ('private', 'project', 'invited')`),
  index('task_board_project_updated_idx').on(table.projectId, table.updatedAt),
]);

export const taskBoardMember = resourcesNamespace.table('task_board_member', {
  projectId: uuid('project_id').notNull(),
  boardId: uuid('board_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 8 }).$type<TaskBoardMemberRole>().notNull().default('viewer'),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.boardId, table.userId] }),
  foreignKey({ name: 'task_board_member_board_fk', columns: [table.projectId, table.boardId], foreignColumns: [taskBoard.projectId, taskBoard.id] }).onDelete('cascade'),
  foreignKey({ name: 'task_board_member_project_member_fk', columns: [table.projectId, table.userId], foreignColumns: [projectMember.projectId, projectMember.userId] }).onDelete('cascade'),
  check('task_board_member_role_valid', sql`${table.role} IN ('viewer', 'editor')`),
]);

export const taskColumn = resourcesNamespace.table('task_column', {
  projectId: uuid('project_id').notNull(),
  boardId: uuid('board_id').notNull(),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 60 }).notNull(),
  color: varchar('color', { length: 8 }).$type<TaskColumnColor>().notNull().default('slate'),
  isDone: boolean('is_done').notNull().default(false),
  position: doublePrecision('position').notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.boardId, table.id] }),
  foreignKey({ name: 'task_column_board_fk', columns: [table.projectId, table.boardId], foreignColumns: [taskBoard.projectId, taskBoard.id] }).onDelete('cascade'),
  check('task_column_name_not_empty', sql`length(btrim(${table.name})) > 0`),
  check('task_column_color_valid', sql`${table.color} IN ('slate', 'blue', 'amber', 'green', 'violet', 'rose')`),
  index('task_column_order_idx').on(table.projectId, table.boardId, table.position),
]);

export const boardTask = resourcesNamespace.table('board_task', {
  projectId: uuid('project_id').notNull(),
  boardId: uuid('board_id').notNull(),
  id: uuid('id').notNull(),
  columnId: uuid('column_id').notNull(),
  title: varchar('title', { length: 240 }).notNull(),
  description: text('description').notNull().default(''),
  priority: varchar('priority', { length: 8 }).$type<TaskPriority>().notNull().default('medium'),
  assigneeIds: uuid('assignee_ids').array().notNull().default(sql`'{}'::uuid[]`),
  labels: text('labels').array().notNull().default(sql`'{}'::text[]`),
  dueDate: date('due_date', { mode: 'string' }),
  checklist: jsonb('checklist').$type<TaskChecklistItem[]>().notNull().default([]),
  position: doublePrecision('position').notNull(),
  createdBy: uuid('created_by').notNull().references(() => authUser.id),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.boardId, table.id] }),
  foreignKey({ name: 'board_task_column_fk', columns: [table.projectId, table.boardId, table.columnId], foreignColumns: [taskColumn.projectId, taskColumn.boardId, taskColumn.id] }),
  foreignKey({ name: 'board_task_board_fk', columns: [table.projectId, table.boardId], foreignColumns: [taskBoard.projectId, taskBoard.id] }).onDelete('cascade'),
  check('board_task_title_not_empty', sql`length(btrim(${table.title})) > 0`),
  check('board_task_priority_valid', sql`${table.priority} IN ('low', 'medium', 'high', 'urgent')`),
  check('board_task_checklist_array', sql`jsonb_typeof(${table.checklist}) = 'array'`),
  index('board_task_column_order_idx').on(table.projectId, table.boardId, table.columnId, table.position),
]);

export const taskComment = resourcesNamespace.table('task_comment', {
  projectId: uuid('project_id').notNull(),
  boardId: uuid('board_id').notNull(),
  taskId: uuid('task_id').notNull(),
  id: uuid('id').notNull(),
  authorId: uuid('author_id').notNull().references(() => authUser.id),
  body: text('body').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.boardId, table.id] }),
  foreignKey({ name: 'task_comment_task_fk', columns: [table.projectId, table.boardId, table.taskId], foreignColumns: [boardTask.projectId, boardTask.boardId, boardTask.id] }).onDelete('cascade'),
  check('task_comment_body_not_empty', sql`length(btrim(${table.body})) > 0`),
  index('task_comment_task_created_idx').on(table.projectId, table.boardId, table.taskId, table.createdAt),
]);
