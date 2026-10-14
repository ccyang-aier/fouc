import { defineMessages } from '@/lib/i18n/messages';

export const messages = defineMessages({
  关于: ['关于', 'About'],
  'Fouc 标识': ['Fouc 标识', 'Fouc logo'],
  'Fouc 智能工作台': ['Fouc 智能工作台', 'Fouc AI workbench'],
  versionSummary: ['版本 {version} · 客户端与 Web 双端', 'Version {version} · Desktop and Web'],
  'Fouc 是构建于 AI Agent 之上的超级工作台，面向个人与企业团队。以人与 Agent 的高效协作为核心，帮助你在同一条工作流中敏捷完成开发、研究、分析与日常办公任务。':
    [
      'Fouc 是构建于 AI Agent 之上的超级工作台，面向个人与企业团队。以人与 Agent 的高效协作为核心，帮助你在同一条工作流中敏捷完成开发、研究、分析与日常办公任务。',
      'Fouc is an AI agent workbench for individuals and teams. Work alongside agents to develop, research, analyze, and handle everyday tasks in one workflow.',
    ],
  'Agent 接入基于 Agent Client Protocol（ACP）：已内置 33 种 CLI Agent 的目录声明，安装即可自动发现、探测与纳管，无需任何手工配置。':
    [
      'Agent 接入基于 Agent Client Protocol（ACP）：已内置 33 种 CLI Agent 的目录声明，安装即可自动发现、探测与纳管，无需任何手工配置。',
      'Agent integration uses Agent Client Protocol (ACP). The catalog includes 33 CLI agents that are discovered and managed automatically after installation.',
    ],
});
