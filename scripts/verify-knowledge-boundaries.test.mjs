import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkKnowledgeImports } from './verify-knowledge-boundaries.mjs';

test('shared pure schema can consume editor primitives but not React or server runtimes', () => {
  assert.deepEqual(checkKnowledgeImports('shared/src/knowledge/schema/index.ts', "import { Schema } from '@tiptap/pm/model';"), []);
  assert.equal(checkKnowledgeImports('shared/src/knowledge/schema/index.ts', "export { x } from 'react'; import('node:fs');").length, 2);
});
test('backend cannot reach client through relative imports', () => {
  assert.equal(checkKnowledgeImports('backend/src/knowledge/test.ts', "import { x } from '../../../src/features/knowledge/knowledge-model';").length, 1);
  assert.equal(checkKnowledgeImports('backend/src/api/knowledge/router.ts', "import { x } from '../../../../src/features/knowledge/knowledge-model';").length, 1);
  assert.equal(checkKnowledgeImports('backend/src/api/knowledge/router.ts', "import React from 'react';").length, 1);
});
test('frontend may import router types but not its runtime', () => {
  const file = 'src/features/knowledge/test.ts';
  const route = '../../../backend/src/api/knowledge/router';
  assert.deepEqual(checkKnowledgeImports(file, `import type { AppRouter } from '${route}';`), []);
  assert.equal(checkKnowledgeImports(file, `import { appRouter } from '${route}';`).length, 1);
});

test('all knowledge model calls stay behind the gateway, while tool schemas remain reusable', () => {
  const outside = 'backend/src/knowledge/tools/search.ts';
  assert.equal(checkKnowledgeImports(outside, "import { generateText as generate } from 'ai';").length, 1);
  assert.equal(checkKnowledgeImports(outside, "import { createOpenAICompatible } from '@ai-sdk/openai-compatible';").length, 1);
  assert.equal(checkKnowledgeImports(outside, "import('ai'); export * from 'ai';").length, 2);
  assert.deepEqual(checkKnowledgeImports(outside, "import { tool, type ModelMessage } from 'ai'; import type { Telemetry } from 'ai';"), []);
  assert.deepEqual(checkKnowledgeImports('backend/src/knowledge/ai/gateway/providers.ts', "import { generateText } from 'ai';"), []);
  assert.equal(checkKnowledgeImports('backend/src/api/knowledge/router.ts', "import { streamText } from 'ai';").length, 1);
  assert.deepEqual(checkKnowledgeImports('backend/src/api/knowledge/router.ts', "import type { TextResult } from '../../knowledge/ai/gateway';"), []);
});
