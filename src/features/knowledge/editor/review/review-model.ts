/**
 * The review view-model (S02, design §4.5/§9.3): pure derivations from the
 * S01 `collectSuggestions` summaries over the current document — one panel
 * row per suggestion, honest statistics, and the readonly action matrix that
 * keeps every accept/reject control disabled *with its reason*. No React, no
 * DOM: everything here is decidable in a plain test.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { SuggestionSummary } from '@fouc/shared/knowledge/schema/suggestions';
import { describeSuggestionAuthor, formatSuggestionTime } from './author';
import type { SuggestionAuthorBadge } from './author';

export type SuggestionKind = 'insert' | 'delete' | 'replace';
export type SuggestionScope = 'text' | 'block' | 'mixed';

/** One reviewable suggestion flattened into everything the panel/card show. */
export interface ReviewRow {
  suggestionId: string;
  author: SuggestionAuthorBadge;
  createdAt: string;
  createdAtLabel: string;
  kind: SuggestionKind;
  scope: SuggestionScope;
  /** Short human excerpt of the proposed change ('旧 → 新' for replacements). */
  excerpt: string;
  /** Position span of the first (uppermost) range — the locate anchor. */
  anchor: { from: number; to: number };
}

export interface ReviewStats {
  total: number;
  inserts: number;
  deletes: number;
  replaces: number;
  /** Suggestions covering whole non-text blocks (images, math, …). */
  blockScoped: number;
  authors: { badge: SuggestionAuthorBadge; count: number }[];
}

export function suggestionKindOf(summary: SuggestionSummary): SuggestionKind {
  const inserts = summary.ranges.some((range) => range.type === 'suggestion_insert');
  const deletes = summary.ranges.some((range) => range.type === 'suggestion_delete');
  return inserts && deletes ? 'replace' : inserts ? 'insert' : 'delete';
}

export function suggestionScopeOf(summary: SuggestionSummary): SuggestionScope {
  const node = summary.ranges.some((range) => range.storage === 'node');
  const text = summary.ranges.some((range) => range.storage === 'mark');
  return node && text ? 'mixed' : node ? 'block' : 'text';
}

const nodeLabels: Record<string, string> = {
  image: '图片', video: '视频', audio: '音频', file: '附件', math: '公式',
  inlineMath: '行内公式', embed: '嵌入', blockReference: '块引用', pageLink: '页面链接',
};

function rangeText(doc: ProseMirrorNode, from: number, to: number): string {
  const text = doc.textBetween(from, to, ' ', ' ').replace(/\s+/g, ' ').trim();
  if (text) return text;
  const node = doc.nodeAt(from);
  return node ? (nodeLabels[node.type.name] ?? `「${node.type.name}」`) : '';
}

function clip(text: string, limit = 40): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** Excerpt as the reviewer reads it: what is added, removed, or swapped. */
export function suggestionExcerpt(doc: ProseMirrorNode, summary: SuggestionSummary): string {
  const inserted: string[] = [];
  const deleted: string[] = [];
  for (const range of summary.ranges) {
    const text = rangeText(doc, range.from, range.to);
    if (!text) continue;
    (range.type === 'suggestion_insert' ? inserted : deleted).push(text);
  }
  const kind = suggestionKindOf(summary);
  if (kind === 'replace') return clip(`${deleted.join(' ')} → ${inserted.join(' ')}`);
  return clip((kind === 'insert' ? inserted : deleted).join(' '));
}

/** Panel rows in document order — the same order the marks appear top to bottom. */
export function reviewRows(summaries: SuggestionSummary[], doc: ProseMirrorNode): ReviewRow[] {
  return summaries.map((summary) => {
    const first = summary.ranges.reduce((min, range) => (range.from < min.from ? range : min));
    return {
      suggestionId: summary.suggestionId,
      author: describeSuggestionAuthor(summary.author),
      createdAt: summary.createdAt,
      createdAtLabel: formatSuggestionTime(summary.createdAt),
      kind: suggestionKindOf(summary),
      scope: suggestionScopeOf(summary),
      excerpt: suggestionExcerpt(doc, summary),
      anchor: { from: first.from, to: first.to },
    };
  });
}

export function reviewStats(summaries: SuggestionSummary[]): ReviewStats {
  const authors = new Map<string, { badge: SuggestionAuthorBadge; count: number }>();
  const stats: ReviewStats = { total: summaries.length, inserts: 0, deletes: 0, replaces: 0, blockScoped: 0, authors: [] };
  for (const summary of summaries) {
    stats[suggestionKindOf(summary) === 'insert' ? 'inserts' : suggestionKindOf(summary) === 'delete' ? 'deletes' : 'replaces'] += 1;
    if (suggestionScopeOf(summary) !== 'text') stats.blockScoped += 1;
    const badge = describeSuggestionAuthor(summary.author);
    const entry = authors.get(`${badge.kind}:${badge.label}:${badge.detail ?? ''}`) ?? { badge, count: 0 };
    entry.count += 1;
    authors.set(`${badge.kind}:${badge.label}:${badge.detail ?? ''}`, entry);
  }
  stats.authors = [...authors.values()].sort((a, b) => b.count - a.count || a.badge.label.localeCompare(b.badge.label));
  return stats;
}

/** Why an accept/reject control is disabled — `null` means it is enabled. */
export type ReviewActionsView = {
  canDecide: boolean;
  canDecideAll: boolean;
  disabledReason: string | null;
};

/**
 * The readonly matrix in one place: both the controls and their explanation
 * come from this decision, so a disabled button can never be silent and an
 * enabled one can never appear while the page refuses edits.
 */
export function reviewActionsView(input: { editable: boolean; total: number }): ReviewActionsView {
  if (!input.editable) {
    return { canDecide: false, canDecideAll: false, disabledReason: '只读模式：接受或拒绝建议会修改正文，需要此页面的编辑权限。' };
  }
  if (input.total === 0) {
    return { canDecide: false, canDecideAll: false, disabledReason: '当前没有待审阅的建议。' };
  }
  return { canDecide: true, canDecideAll: true, disabledReason: null };
}
