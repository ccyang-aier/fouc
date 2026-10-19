import { z } from 'zod';
import { entityIdSchema as id } from '../resources';

export const taskBoardVisibilitySchema = z.enum(['private', 'project', 'invited']);
export const taskBoardPermissionSchema = z.enum(['owner', 'editor', 'viewer']);
export const taskBoardMemberRoleSchema = z.enum(['editor', 'viewer']);
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const taskColumnColorSchema = z.enum(['slate', 'blue', 'amber', 'green', 'violet', 'rose']);

export type TaskBoardVisibility = z.infer<typeof taskBoardVisibilitySchema>;
export type TaskBoardPermission = z.infer<typeof taskBoardPermissionSchema>;
export type TaskBoardMemberRole = z.infer<typeof taskBoardMemberRoleSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskColumnColor = z.infer<typeof taskColumnColorSchema>;

export interface TaskBoardSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  visibility: TaskBoardVisibility;
  ownerId: string;
  permission: TaskBoardPermission;
  taskCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskColumn {
  id: string;
  name: string;
  color: TaskColumnColor;
  isDone: boolean;
  position: number;
}

export interface TaskChecklistItem { id: string; title: string; done: boolean }

/** A task's reserved time is independent of its delivery deadline. */
export const taskScheduleSchema = z.strictObject({
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  url: z.string().max(2048).refine(value => {
    if (!value) return true;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }).default(''),
}).refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt), { message: 'End must be after start.', path: ['endsAt'] });
export type TaskSchedule = z.output<typeof taskScheduleSchema>;

export interface BoardTask {
  id: string;
  number: number;
  columnId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeIds: string[];
  labels: string[];
  dueDate: string | null;
  schedule: TaskSchedule | null;
  checklist: TaskChecklistItem[];
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface ProjectTaskMember {
  userId: string;
  name: string;
  email: string;
  image: string | null;
}

export interface TaskBoardMember extends ProjectTaskMember { role: TaskBoardPermission }
export interface TaskBoardDetail extends TaskBoardSummary {
  columns: TaskColumn[];
  tasks: BoardTask[];
  members: TaskBoardMember[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  body: string;
  createdAt: string;
}

const boardName = z.string().trim().min(1).max(120);
const description = z.string().max(12_000);
const nonemptyPatch = (input: object) => Object.keys(input).length > 0;
export const taskProjectScopeSchema = z.strictObject({ projectId: id });
export const taskBoardScopeSchema = taskProjectScopeSchema.extend({ boardId: id });
export const taskScopeSchema = taskBoardScopeSchema.extend({ taskId: id });
export const taskColumnScopeSchema = taskBoardScopeSchema.extend({ columnId: id });
export const taskCommentScopeSchema = taskScopeSchema.extend({ commentId: id });

export const createTaskBoardInputSchema = z.strictObject({
  name: boardName,
  description: description.default(''),
  visibility: taskBoardVisibilitySchema.default('private'),
});
export const updateTaskBoardInputSchema = z.strictObject({ name: boardName.optional(), description: description.optional(), visibility: taskBoardVisibilitySchema.optional() }).refine(nonemptyPatch);
export const setTaskBoardMemberInputSchema = z.strictObject({ userId: id, role: taskBoardMemberRoleSchema.default('viewer') });
export const createTaskColumnInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  color: taskColumnColorSchema.default('slate'),
  isDone: z.boolean().default(false),
});
export const updateTaskColumnInputSchema = z.strictObject({ name: z.string().trim().min(1).max(60).optional(), color: taskColumnColorSchema.optional(), isDone: z.boolean().optional() }).refine(nonemptyPatch);
export const reorderTaskColumnsInputSchema = z.strictObject({ columnIds: z.array(id).min(1).max(24) })
  .refine(({ columnIds }) => new Set(columnIds).size === columnIds.length);

export const taskChecklistItemInputSchema = z.strictObject({
  id: id.optional(), title: z.string().trim().min(1).max(240), done: z.boolean().default(false),
});
const taskFields = {
  columnId: id,
  title: z.string().trim().min(1).max(240),
  description,
  priority: taskPrioritySchema,
  assigneeIds: z.array(id).max(50),
  labels: z.array(z.string().trim().min(1).max(40)).max(20),
  dueDate: z.iso.date().nullable(),
  schedule: taskScheduleSchema.nullable(),
  checklist: z.array(taskChecklistItemInputSchema).max(100),
};
export const createBoardTaskInputSchema = z.strictObject({ ...taskFields, description: taskFields.description.default(''), priority: taskFields.priority.default('medium'),
  assigneeIds: taskFields.assigneeIds.default([]), labels: taskFields.labels.default([]), dueDate: taskFields.dueDate.default(null), schedule: taskFields.schedule.default(null), checklist: taskFields.checklist.default([]) })
  .refine(({ checklist }) => new Set(checklist.flatMap(item => item.id ? [item.id] : [])).size === checklist.filter(item => item.id).length);
export const updateBoardTaskInputSchema = z.strictObject(taskFields).partial().refine(nonemptyPatch)
  .refine(({ checklist }) => !checklist || new Set(checklist.flatMap(item => item.id ? [item.id] : [])).size === checklist.filter(item => item.id).length);
export const moveBoardTaskInputSchema = z.strictObject({ columnId: id, beforeTaskId: id.nullable() });
export const createTaskCommentInputSchema = z.strictObject({ body: z.string().trim().min(1).max(4_000) });

export type CreateTaskBoardInput = z.input<typeof createTaskBoardInputSchema>;
export type UpdateTaskBoardInput = z.input<typeof updateTaskBoardInputSchema>;
export type CreateTaskColumnInput = z.input<typeof createTaskColumnInputSchema>;
export type UpdateTaskColumnInput = z.input<typeof updateTaskColumnInputSchema>;
export type CreateBoardTaskInput = z.input<typeof createBoardTaskInputSchema>;
export type UpdateBoardTaskInput = z.input<typeof updateBoardTaskInputSchema>;
export type MoveBoardTaskInput = z.input<typeof moveBoardTaskInputSchema>;
