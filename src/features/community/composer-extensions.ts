import { createTranslator, type Locale } from '@/lib/i18n';
import type { ComposerResource } from './composer-catalog';

const messages = {
  author: ['Fouc 官方', 'Fouc'], updated: ['2 天前', '2 days ago'],
  website: ['构建网站', 'Build Website'], websiteDescription: ['从需求到页面与交互，构建完整的网站体验。', 'Build complete websites, from requirements to pages and interactions.'],
  desktop: ['开发桌面应用', 'Develop desktop apps'], desktopDescription: ['规划桌面界面、系统交互与应用实现。', 'Plan desktop interfaces, system interactions, and app implementation.'],
  slides: ['制作幻灯片', 'Create slides'], slidesDescription: ['组织内容结构，设计清晰、精致的演示文稿。', 'Structure ideas and design clear, polished presentations.'],
  design: ['设计', 'Design'], designDescription: ['梳理体验与视觉方向，打磨产品界面和交互。', 'Shape product experiences, visual direction, and interactions.'],
  writing: ['写作', 'Writing'], writingDescription: ['根据受众和目的，组织、撰写与润色内容。', 'Plan, write, and refine content for its audience and purpose.'],
  research: ['研究', 'Research'], researchDescription: ['拆解问题，核对信息与来源，形成研究结论。', 'Investigate questions, cross-check sources, and develop findings.'],
  data: ['数据分析', 'Data analysis'], dataDescription: ['梳理分析目标，探索数据并呈现结论。', 'Define analytical goals, explore data, and communicate findings.'],
  requirements: ['产品需求梳理', 'Product requirements'], requirementsDescription: ['按背景、目标、用户场景和验收标准组织产品需求。', 'Organize requirements by context, goals, user scenarios, and acceptance criteria.'],
  review: ['代码审查清单', 'Code review checklist'], reviewDescription: ['从正确性、边界条件、可维护性与风险检查代码变更。', 'Review changes for correctness, edge cases, maintainability, and risk.'],
  researchOutline: ['深度研究提纲', 'Research outline'], researchOutlineDescription: ['将研究问题拆为假设、证据来源与分析步骤。', 'Break a research question into hypotheses, evidence sources, and analytical steps.'],
  weekly: ['周报生成', 'Weekly report'], weeklyDescription: ['整理工作进展、关键结果、风险与下一步计划。', 'Summarize progress, outcomes, risks, and next steps.'],
  meeting: ['会议纪要', 'Meeting notes'], meetingDescription: ['从会议内容提取决议、待办事项与负责人。', 'Extract decisions, action items, and owners from meeting content.'],
  analysis: ['数据分析计划', 'Data analysis plan'], analysisDescription: ['明确指标口径、数据质量检查、分析方法与验证步骤。', 'Define metrics, quality checks, analytical methods, and validation steps.'],
  copy: ['文案润色', 'Copy refinement'], copyDescription: ['保留原意，改善结构、表达与语气的一致性。', 'Preserve meaning while improving structure, wording, and tone.'],
  launch: ['发布检查清单', 'Release checklist'], launchDescription: ['整理发布前的验证、风险确认与回滚准备事项。', 'Prepare validation, risk reviews, and rollback checks before release.'],
} as const;

const pluginSeeds = [
  ['website', '研发'], ['desktop', '研发'], ['slides', '办公'], ['design', '内容'],
  ['writing', '内容'], ['research', '内容'], ['data', '数据'],
] as const;
const promptSeeds = [
  ['requirements', '研发'], ['review', '研发'], ['researchOutline', '内容'], ['weekly', '办公'],
  ['meeting', '办公'], ['analysis', '数据'], ['copy', '内容'], ['launch', '研发'],
] as const;

/** Preview catalogs, sharing the same session-only boundary as the composer MCP catalog. */
export function getComposerPlugins(locale: Locale): ComposerResource[] {
  const t = createTranslator(messages, locale);
  return pluginSeeds.map(([id, category]) => ({ id: `plugin-${id}`, kind: 'plugins', name: t(id),
    description: t(`${id}Description`), category, author: t('author'), updated: t('updated'), rating: 4.9, tone: 'amber' }));
}

export function getComposerPrompts(locale: Locale): ComposerResource[] {
  const t = createTranslator(messages, locale);
  return promptSeeds.map(([id, category]) => ({ id: `prompt-${id}`, kind: 'prompts', name: t(id),
    description: t(`${id}Description`), category, author: t('author'), updated: t('updated'), rating: 4.8, tone: 'rose' }));
}
