import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkArchitectureImports } from './verify-architecture.mjs';

test('runtime packages cannot import each other, including type-only and dynamic imports', () => {
  assert.equal(checkArchitectureImports('backend/device/src/agents/registry.ts', "import type { X } from '../../../server/src/platform/identity';").length, 1);
  assert.equal(checkArchitectureImports('backend/server/src/entrypoints/server.ts', "import('../../../device/src/agents/registry');").length, 1);
  assert.equal(checkArchitectureImports('backend/device/src/agents/registry.ts', "import { Pool } from 'pg';").length, 2);
});

test('frontend public router types are erased and cannot be loaded as runtime values', () => {
  const file = 'src/features/knowledge/data/api-types.ts';
  assert.deepEqual(checkArchitectureImports(file, "export type { KnowledgeApiRouter } from '@fouc/server/knowledge-api';"), []);
  assert.equal(checkArchitectureImports(file, "import('@fouc/server/knowledge-api');").length, 1);
  assert.equal(checkArchitectureImports(file, "export type { KnowledgeApiRouter } from '../../../../backend/server/src/modules/knowledge/api/router';").length, 1);
});

test('shared protocols cannot introduce platform code and private subpaths cannot bypass exports', () => {
  assert.equal(checkArchitectureImports('shared/src/knowledge/contracts/page.ts', "import('bun:sqlite');").length, 1);
  assert.equal(checkArchitectureImports('backend/device/src/agents/catalog.ts', "import type { ProviderSpec } from '@fouc/shared/src/index';").length, 1);
  assert.deepEqual(checkArchitectureImports('backend/device/src/agents/catalog.ts', "import type { ProviderSpec } from '@fouc/shared';"), []);
});
