'use client';

import { useSyncExternalStore } from 'react';
import { createTranslator, type Locale } from '@/lib/i18n';
import type { ComposerResource } from '@/features/community/composer-catalog';

const messages = {
  author: ['Fouc 官方', 'Fouc'],
  updated: ['2 天前', '2 days ago'],
  research: ['深度研究', 'Deep research'],
  researchDescription: ['拆解研究问题，交叉核对来源，形成有证据支撑的结论。', 'Break down research questions, cross-check sources, and develop evidence-backed conclusions.'],
  documents: ['文档协作', 'Document craft'],
  documentsDescription: ['组织文档结构、打磨表达，为沟通与交付准备清晰的文稿。', 'Structure documents and refine language for clear communication and delivery.'],
  code: ['代码审查', 'Code review'],
  codeDescription: ['检查代码变更、边界与风险，给出可执行的改进建议。', 'Review code changes, boundaries, and risks with actionable improvements.'],
} as const;

const seeds = [
  { id: 'builtin-research', label: 'research', description: 'researchDescription', category: '内容', tone: 'teal' },
  { id: 'builtin-documents', label: 'documents', description: 'documentsDescription', category: '办公', tone: 'amber' },
  { id: 'builtin-code', label: 'code', description: 'codeDescription', category: '研发', tone: 'blue' },
] as const;

export function getBuiltinSkills(locale: Locale): ComposerResource[] {
  const t = createTranslator(messages, locale);
  return seeds.map(item => ({ id: item.id, kind: 'skills', name: t(item.label), description: t(item.description),
    author: t('author'), updated: t('updated'), category: item.category, tone: item.tone, rating: 4.9 }));
}

const initialDisabled: string[] = [];
let disabledIds = initialDisabled;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function useBuiltinSkills() {
  return useSyncExternalStore(subscribe, () => disabledIds, () => initialDisabled);
}

/** Preview preferences belong to this app session, never to an Agent installation. */
export function toggleBuiltinSkill(id: string) {
  if (!seeds.some(item => item.id === id)) return;
  disabledIds = disabledIds.includes(id) ? disabledIds.filter(value => value !== id) : [...disabledIds, id];
  listeners.forEach(listener => listener());
}
