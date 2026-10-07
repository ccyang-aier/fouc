import * as identity from './identity/schema';
import { identityTables } from './identity/tables';
import { resourceSchema, resourceTables } from './resources/schema';
export * from './identity/schema';
export * from './resources/schema';
export { identityTables } from './identity/tables';
/** One current database catalog, composed from independently owned modules. */
export const applicationSchema = { ...identity, ...resourceSchema };
export const allApplicationTables = [...identityTables, ...resourceTables];
