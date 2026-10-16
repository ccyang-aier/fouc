import type { ChatContext } from "./chat-types";
import type { ModelCatalogEntry } from '@fouc/shared/model-catalog';

export type ChatExecutionOption = {
  id: string;
  name: string;
  brand: "auto" | "claude" | "openai" | "deepseek" | "gemini" | "nanobanana" | "nova" | "codey" | "sage" | "model";
};

export const autoExecutionOption: ChatExecutionOption = { id: 'auto', name: 'Auto', brand: 'auto' };

export const modelProviders = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'deepseek', name: 'DeepSeek' },
] as const satisfies readonly { id: ModelCatalogEntry['provider']; name: string }[];

export const chatAgents: readonly ChatExecutionOption[] = [
  { id: "nova", name: "Nova", brand: "nova" },
  { id: "codey", name: "Codey", brand: "codey" },
  { id: "sage", name: "Sage", brand: "sage" },
];

export function modelExecutionOption(model: ModelCatalogEntry): ChatExecutionOption {
  return { id: model.id, name: model.name, brand: model.provider === 'anthropic' ? 'claude' : model.provider === 'google' ? (model.capabilities.imageGeneration ? 'nanobanana' : 'gemini') : model.provider };
}

export function getChatExecutionOption(execution: ChatContext["execution"]): ChatExecutionOption {
  if (execution.kind === 'auto') return autoExecutionOption;
  return execution.kind === 'agent'
    ? chatAgents.find(option => option.id === execution.id) ?? { id: execution.id, name: execution.name ?? execution.id, brand: 'model' as const }
    : { id: execution.id, name: execution.name ?? execution.id, brand: execution.provider === 'anthropic' ? 'claude' as const : execution.provider === 'google' ? 'gemini' as const : execution.provider ?? 'model' as const };
}
