import { KNOWLEDGE_BLOCKS } from './blocks';
import { KNOWLEDGE_MARKS } from './marks';
import { BlockRegistry } from './registry';
import type { BlockDefinition, MarkDefinition } from './types';

export { KNOWLEDGE_BLOCKS } from './blocks';
export { KNOWLEDGE_MARKS } from './marks';
export { BlockRegistry } from './registry';
export { defineBlock, isKnowledgeBlock } from './types';
export type { BlockDefinition, MarkDefinition, MarkdownMapping } from './types';
export { safeKnowledgeUrl } from './urls';
export type { KnowledgeUrlPurpose } from './urls';

export function createKnowledgeRegistry(additions: {
  blocks?: readonly BlockDefinition[];
  marks?: readonly MarkDefinition[];
} = {}): BlockRegistry {
  return new BlockRegistry([...KNOWLEDGE_BLOCKS, ...additions.blocks ?? []], [...KNOWLEDGE_MARKS, ...additions.marks ?? []]);
}

export function createKnowledgeExtensions(registry = createKnowledgeRegistry()) {
  return registry.createExtensions();
}

export const knowledgeSchema = createKnowledgeRegistry().createSchema();
