import * as identity from './identity/schema';
import { identityTables } from './identity/tables';
import { workspaceTenantSchema, workspaceTenantTables } from './workspace/schema';
export * from './identity/schema';
export * from './workspace/schema';
export { identityTables } from './identity/tables';
/** One current database catalog, composed from independently owned modules. */
export const applicationSchema = { ...identity, ...workspaceTenantSchema };
export const allApplicationTables = [...identityTables, ...workspaceTenantTables];
