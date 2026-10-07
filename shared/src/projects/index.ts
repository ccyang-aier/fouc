import { z } from 'zod';
import { entityIdSchema as id, paginationSchema } from '../resources';

const name = z.string().trim().min(1).max(120);
export const projectSchema = z.strictObject({ id, name });
export const listProjectsInputSchema = paginationSchema;
export const createProjectInputSchema = z.strictObject({ name });
export const renameProjectInputSchema = z.strictObject({ projectId: id, name });
export const removeProjectInputSchema = z.strictObject({ projectId: id });

export type Project = z.infer<typeof projectSchema>;
