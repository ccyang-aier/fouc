import type { ModelCatalogEntry, ModelReasoningLevel } from '@fouc/shared/model-catalog';
import type { ComposerResourceReference } from '@/features/community/composer-catalog';

export type ChatExecution =
  | { kind: "auto" }
  | { kind: "agent"; id: string; name?: string }
  | { kind: "model"; id: string; name?: string; provider?: ModelCatalogEntry['provider']; reasoningEffort: ModelReasoningLevel | null };

export type AutoModelRules = { modelIds: string[] | null; reasoningEffort: ModelReasoningLevel };

export type ChatContext = {
  resources?: ComposerResourceReference[];
  builtinSkillIds?: string[];
  execution: ChatExecution;
  autoRules: AutoModelRules;
  localEnvironment?: { createWorktree: boolean };
  projectId: string | null;
  projectName: string | null;
  knowledgeIncluded: boolean;
};
export type ChatAttachment = { id: string; file: File };
export type ChatTaskKind = 'website' | 'desktop' | 'slides' | 'design' | 'writing' | 'research' | 'data';
export type ChatMode = 'plan' | 'debug' | 'multitask' | 'goal';
export type ChatSubmission = {
  id: string;
  text: string;
  task: ChatTaskKind | null;
  mode: ChatMode | null;
  attachments: ChatAttachment[];
  context: ChatContext;
  createdAt: Date;
};
