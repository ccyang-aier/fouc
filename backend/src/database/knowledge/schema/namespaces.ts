import { pgSchema } from 'drizzle-orm/pg-core';

/** All tenant-owned data lives here and is subject to the same RLS boundary. */
export const knowledge = pgSchema('knowledge');

/** Global authentication identity is not tenant-owned business data. */
export const identity = pgSchema('knowledge_auth');
