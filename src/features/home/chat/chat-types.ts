import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';

export type ChatContext = {
  execution: { kind: "agent" | "model"; id: string; name?: string; provider?: ModelCatalogEntry['provider'] };
  localEnvironment?: { createWorktree: boolean };
  projectId: string | null;
  projectName: string | null;
  knowledgeIncluded: boolean;
};
export type ChatAttachment = { id: string; file: File };
export type ChatSubmission = {
  id: string;
  text: string;
  attachments: ChatAttachment[];
  context: ChatContext;
  createdAt: Date;
};
