import type { ChatContext } from "./chat-types";

export type ChatExecutionOption = {
  id: string;
  name: string;
  brand: "claude" | "openai" | "deepseek" | "nanobanana" | "nova" | "codey" | "sage";
  tone?: "pink";
  reasoning?: "low" | "medium" | "high";
  isNew?: boolean;
  image?: boolean;
  capability?: number;
  speed?: number;
  multiplier?: string;
};

export const chatAgents: readonly ChatExecutionOption[] = [
  { id: "nova", name: "Nova", brand: "nova" },
  { id: "codey", name: "Codey", brand: "codey" },
  { id: "sage", name: "Sage", brand: "sage" },
];

// Reference-image examples for the home UI preview, not a live model or pricing catalog.
export const chatModels: readonly ChatExecutionOption[] = [
  { id: "claude-haiku-preview", name: "Claude Haiku", brand: "claude", reasoning: "low", isNew: true, capability: 64, speed: 86, multiplier: "0.1x" },
  { id: "nano-banana-preview", name: "Nano Banana", brand: "nanobanana", image: true, isNew: true, multiplier: "1.74x" },
  { id: "deepseek-v4-preview", name: "DeepSeek V4.1", brand: "deepseek", reasoning: "high", capability: 60, speed: 96, multiplier: "0.3x" },
  { id: "claude-sonnet-preview", name: "Claude Sonnet", brand: "claude", reasoning: "high", capability: 92, speed: 67, multiplier: "2x" },
  { id: "claude-sonnet-5-preview", name: "Claude Sonnet 5", brand: "claude", reasoning: "high", capability: 54, speed: 65, multiplier: "2x" },
  { id: "claude-haiku-4-5-preview", name: "Claude Haiku 4.5", brand: "claude", capability: 20, speed: 80, multiplier: "1x" },
  { id: "gpt-6-1-sol-preview", name: "GPT-6.1 Sol", brand: "openai", reasoning: "medium", capability: 88, speed: 35, multiplier: "2x" },
  { id: "gpt-6-sol-preview", name: "GPT-6 Sol", brand: "openai", reasoning: "medium", capability: 76, speed: 47, multiplier: "2x" },
  { id: "gpt-6-luna-preview", name: "GPT-6 Luna", brand: "openai", reasoning: "medium", capability: 55, speed: 45, multiplier: "0.1x" },
  { id: "gpt-5-6-terra-preview", name: "GPT-5.6 Terra", brand: "openai", tone: "pink", reasoning: "medium", capability: 63, speed: 65, multiplier: "2x" },
  { id: "gpt-5-6-luna-preview", name: "GPT-5.6 Luna", brand: "openai", tone: "pink", reasoning: "medium", capability: 48, speed: 52, multiplier: "0.2x" },
];

export function getChatExecutionOption(execution: ChatContext["execution"]) {
  const options = execution.kind === "agent" ? chatAgents : chatModels;
  return options.find((option) => option.id === execution.id) ?? options[0];
}
