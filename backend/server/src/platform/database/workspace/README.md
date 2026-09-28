# Workspace resource storage

`schema/` owns the workspace-scoped business tables. `organization.ts` defines the workspace and membership root, `projects.ts` defines sibling projects, and `knowledge.ts` defines sibling knowledge bases plus their folders. Global identity tables belong to `../identity/schema.ts`; resource code imports them from that owner.

The combined database catalog, initialization, grants and deployment checks are documented in [the global database README](../README.md). Tenant transactions and resource RLS remain in this module.
