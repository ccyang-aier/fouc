import { z } from 'zod';
import { entityIdSchema as id, workspaceScopeSchema } from '../workspaces/primitives';

const name = z.string().trim().min(1).max(120);
export const projectSchema = workspaceScopeSchema.extend({ id, name });
export const listProjectsInputSchema = z.strictObject({ workspaceId: id, cursor: id.optional(), limit: z.number().int().min(1).max(100).default(50) });
export const createProjectInputSchema = z.strictObject({ workspaceId: id, name });
export const renameProjectInputSchema = z.strictObject({ workspaceId: id, projectId: id, name });
export const removeProjectInputSchema = z.strictObject({ workspaceId: id, projectId: id });

export type Project = z.infer<typeof projectSchema>;
