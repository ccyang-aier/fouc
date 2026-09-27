import * as identity from './identity/schema';
import { identityTables } from './identity/tables';
import { knowledgeSchema, knowledgeBusinessTables } from './knowledge/schema';
export * from './identity/schema';
export * from './knowledge/schema';
export { identityTables } from './identity/tables';
/** One current database catalog, composed from independently owned modules. */
export const applicationSchema = { ...identity, ...knowledgeSchema };
export const allApplicationTables = [...identityTables, ...knowledgeBusinessTables];
