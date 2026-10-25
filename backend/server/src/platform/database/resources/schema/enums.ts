import { memberRoleSchema } from '@fouc/shared/resources';
import { resourcesNamespace } from './namespaces';

// Zod exposes options as arrays; Drizzle requires a non-empty tuple. Keep enum
// values source-owned while using the PgEnum representation supported by Kit.
function values<T extends string>(options: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = options;
  if (first === undefined) throw new Error('A database enum must not be empty');
  return [first, ...rest];
}

export const memberRole = resourcesNamespace.enum('member_role', values(memberRoleSchema.options));
