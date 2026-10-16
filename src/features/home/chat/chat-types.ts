import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';

export type ChatExecution =
  | { kind: "auto" }
  | { kind: "agent"; id: string; name?: string }
  | { kind: "model"; id: string; name?: string; provider?: ModelCatalogEntry['provider'] };

export type ChatContext = {
  execution: ChatExecution;
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
