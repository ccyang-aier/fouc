import { is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as definitions from './schema/index';
export * from './schema/index';
export const workspaceTenantSchema = definitions;
export const workspaceTenantTables = Object.values<unknown>(definitions).filter((value): value is PgTable => is(value, PgTable));
