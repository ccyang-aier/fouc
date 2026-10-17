'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/lib/i18n';
import type { IconTone } from '@/lib/icon-tones';
import { initialCommunitySkills } from './community-data';
import { communityUpdatedLabel, localizeCommunitySkill } from './community-localization';
import { getComposerPlugins, getComposerPrompts } from './composer-extensions';

export const composerResourceKinds = ['skills', 'mcp', 'plugins', 'prompts'] as const;
export type ComposerResourceKind = typeof composerResourceKinds[number];
export type ComposerResource = {
  id: string;
  kind: ComposerResourceKind;
  name: string;
  description: string;
  author: string;
  category: string;
  updated: string;
  rating: number | null;
  tone: IconTone;
};
export type ComposerResourceReference = Pick<ComposerResource, 'id' | 'kind' | 'name'>;

/** Community preview metadata; these entries do not install or authorize a server. */
const mcpCatalog = [
  { id: 'mcp-github', name: 'GitHub', author: 'GitHub', category: '研发', description: ['检索仓库与代码，整理 Issue，协作评审 Pull Request。', 'Explore repositories and code, organize issues, and review pull requests.'], updated: ['1 天前', '1 day ago'], rating: 4.9, tone: 'slate' },
  { id: 'mcp-browser', name: 'Browser Tools', author: 'Browser Lab', category: '研发', description: ['浏览网页、检查页面元素与控制台，辅助验证交互流程。', 'Browse pages, inspect elements and console output, and verify interactions.'], updated: ['2 天前', '2 days ago'], rating: 4.8, tone: 'blue' },
  { id: 'mcp-filesystem', name: 'Filesystem', author: 'MCP Community', category: '办公', description: ['在明确授权的目录中检索、读取与整理本地文件。', 'Search, read, and organize local files in explicitly authorized directories.'], updated: ['3 天前', '3 days ago'], rating: 4.8, tone: 'amber' },
  { id: 'mcp-notion', name: 'Notion', author: 'Notion', category: '办公', description: ['检索页面与数据库，为任务引用文档和结构化知识。', 'Search pages and databases and reference documents and structured knowledge.'], updated: ['3 天前', '3 days ago'], rating: 4.7, tone: 'slate' },
  { id: 'mcp-postgres', name: 'PostgreSQL', author: 'Data Commons', category: '数据', description: ['发现数据库结构，检索表与字段，辅助分析查询结果。', 'Discover database schemas, explore tables and columns, and analyze query results.'], updated: ['4 天前', '4 days ago'], rating: 4.8, tone: 'sky' },
  { id: 'mcp-figma', name: 'Figma', author: 'Figma', category: '内容', description: ['读取设计稿与组件信息，将设计上下文带入开发任务。', 'Bring design files, components, and design context into development tasks.'], updated: ['1 天前', '1 day ago'], rating: 4.9, tone: 'violet' },
  { id: 'mcp-search', name: 'Web Search', author: 'Open Tools', category: '内容', description: ['检索公开网页与资料，为研究任务整理可追溯的来源。', 'Search public pages and research materials with traceable sources.'], updated: ['2 天前', '2 days ago'], rating: 4.6, tone: 'teal' },
  { id: 'mcp-slack', name: 'Slack', author: 'Slack', category: '办公', description: ['检索频道与讨论内容，整理团队协作所需的上下文。', 'Search channels and discussions to gather context for team collaboration.'], updated: ['5 天前', '5 days ago'], rating: 4.7, tone: 'rose' },
] as const;

const emptyResources: ComposerResource[] = [];
let customResources = emptyResources;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Session-only catalog drafts, matching the existing community preview boundary. */
export function addComposerResource(resource: Omit<ComposerResource, 'id' | 'rating' | 'updated' | 'tone'>) {
  const entry: ComposerResource = { ...resource, id: crypto.randomUUID(), rating: null, updated: new Date().toISOString(), tone: 'slate' };
  customResources = [...customResources, entry];
  listeners.forEach(listener => listener());
  return entry;
}

export function getComposerCatalog(kind: ComposerResourceKind, locale: Locale): ComposerResource[] {
  if (kind === 'plugins') return getComposerPlugins(locale);
  if (kind === 'prompts') return getComposerPrompts(locale);
  if (kind === 'skills') return initialCommunitySkills.map(seed => {
      const item = localizeCommunitySkill(seed, locale);
      return { id: item.id, kind, name: item.name, description: item.summary, author: item.author,
        category: item.category, updated: communityUpdatedLabel(item.updated, locale), rating: item.rating, tone: item.tone };
    });
  return mcpCatalog.map(item => ({ ...item, kind, description: item.description[locale === 'zh-CN' ? 0 : 1],
      updated: item.updated[locale === 'zh-CN' ? 0 : 1] }));
}

export function useComposerCatalog(kind: ComposerResourceKind, locale: Locale) {
  const custom = useSyncExternalStore(subscribe, () => customResources, () => emptyResources);
  const market = getComposerCatalog(kind, locale);
  return [...market, ...custom.filter(item => item.kind === kind).map(item => ({ ...item,
    updated: new Date(item.updated).toLocaleDateString(locale) }))];
}
