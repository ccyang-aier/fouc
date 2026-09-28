import { z } from 'zod';

export const entityIdSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const workspaceScopeSchema = z.strictObject({ workspaceId: entityIdSchema });
export const paginationSchema = z.strictObject({ cursor: entityIdSchema.optional(), limit: z.number().int().min(1).max(100).default(50) });
export type WorkspaceScope = z.infer<typeof workspaceScopeSchema>;
