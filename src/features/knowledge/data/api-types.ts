// Type-only contract with the A00 knowledge API. client-types.ts deliberately
// exports no values, so importing it adds nothing to the browser bundle; the
// backend router itself must never be runtime-imported into the frontend.
export type { KnowledgeApiRouter, KnowledgeApiInputs, KnowledgeApiOutputs } from '../../../../backend/src/api/knowledge/client-types';
