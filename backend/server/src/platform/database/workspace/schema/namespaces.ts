import { pgSchema } from 'drizzle-orm/pg-core';

/** All tenant-owned data lives here and is subject to the same RLS boundary. */
export const workspaceNamespace = pgSchema('workspace');
