import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as definitions from './schema/index';

export * from './schema/index';

/** Pass this object to drizzle; the same exports are the sole DDL source. */
export const knowledgeSchema = definitions;
export const allKnowledgeTables = Object.values<unknown>(definitions).filter((value): value is PgTable => is(value, PgTable));
export const knowledgeBusinessTables = allKnowledgeTables.filter((table) => getTableConfig(table).schema === 'knowledge');
export const knowledgeIdentityTables = allKnowledgeTables.filter((table) => getTableConfig(table).schema === 'knowledge_auth');
