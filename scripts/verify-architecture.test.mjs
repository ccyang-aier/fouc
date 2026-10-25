import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkArchitectureImports } from './verify-architecture.mjs';

test('runtime packages cannot import each other, including type-only and dynamic imports', () => {
  assert.equal(checkArchitectureImports('backend/device/src/agents/registry.ts', "import type { X } from '../../../server/src/platform/identity';").length, 1);
  assert.equal(checkArchitectureImports('backend/server/src/entrypoints/server.ts', "import('../../../device/src/agents/registry');").length, 1);
  assert.equal(checkArchitectureImports('backend/device/src/agents/registry.ts', "import { Pool } from 'pg';").length, 1);
});

test('PostgreSQL is allowed only inside the user data-source driver', () => {
  assert.deepEqual(checkArchitectureImports('backend/device/src/database/drivers/postgres.ts', "import { Pool } from 'pg';"), []);
  assert.equal(checkArchitectureImports('backend/device/src/database/relational-session.ts', "import { Pool } from 'pg';").length, 1);
  assert.equal(checkArchitectureImports('backend/device/src/database/drivers/postgres.ts', "import { database } from '../../../../server/src/platform/database/resources';").length, 1);
});

test('frontend cannot import business-service implementation, including type-only exports', () => {
  const file = 'src/features/tasks/api-types.ts';
  assert.equal(checkArchitectureImports(file, "export type { TaskRouter } from '@fouc/server';").length, 2);
  assert.equal(checkArchitectureImports(file, "import('@fouc/server');").length, 2);
  assert.equal(checkArchitectureImports(file, "export type { TaskRouter } from '../../../backend/server/src/modules/tasks/router';").length, 1);
});

test('shared protocols cannot introduce platform code and private subpaths cannot bypass exports', () => {
  assert.equal(checkArchitectureImports('shared/src/tasks/index.ts', "import('bun:sqlite');").length, 1);
  assert.equal(checkArchitectureImports('backend/device/src/agents/catalog.ts', "import type { ProviderSpec } from '@fouc/shared/src/index';").length, 1);
  assert.deepEqual(checkArchitectureImports('backend/device/src/agents/catalog.ts', "import type { ProviderSpec } from '@fouc/shared';"), []);
});
