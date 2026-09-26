/**
 * Authorship presentation of one suggestion (S02, design §4.5/§9.3/§9.5).
 *
 * S01 stores a raw `author` string on every mark/annotation. Humans and
 * agents share that one path, so the *display* has to derive kind, name and
 * source from the string alone — using the same origin grammar B08/B09
 * produce (`human:` `agent:{taskId}` `mcp:{clientName}:{taskId}`), with a
 * plain-name fallback for persons. Pure string work: no DOM, no editor.
 */

import { parseKnowledgeOrigin } from '@fouc/shared/knowledge/collaboration';

export type SuggestionAuthorKind = 'human' | 'agent' | 'mcp' | 'restore';

export interface SuggestionAuthorBadge {
  kind: SuggestionAuthorKind;
  /** Display name: a person's name, the AI label, or the MCP client name. */
  label: string;
  /** Chip copy naming where the suggestion came from. */
  source: string;
  /** Task/checkpoint identifier of the machine source, if any. */
  detail: string | null;
}

const CHIP_TEXT: Record<SuggestionAuthorKind, string> = { human: '人', agent: 'AI', mcp: 'MCP', restore: 'CP' };

/** The one-to-three character glyph the in-text badge widget renders. */
export function authorBadgeGlyph(kind: SuggestionAuthorKind): string {
  return CHIP_TEXT[kind];
}

/**
 * Maps a stored author string onto its badge. Unknown shapes stay honest:
 * anything unparseable is presented as a person carrying the raw string.
 */
export function describeSuggestionAuthor(author: string): SuggestionAuthorBadge {
  const origin = parseKnowledgeOrigin(author);
  if (origin?.kind === 'agent') {
    return { kind: 'agent', label: 'AI 助手', source: 'AI 任务', detail: origin.taskId };
  }
  if (origin?.kind === 'mcp') {
    return { kind: 'mcp', label: origin.clientName, source: 'MCP 客户端', detail: origin.taskId };
  }
  if (origin?.kind === 'restore') {
    return { kind: 'restore', label: '检查点恢复', source: '检查点', detail: origin.checkpointId };
  }
  if (origin?.kind === 'human') {
    // `human:{clientId}` names a session, not a person; the authenticated
    // name is not part of the mark, so the badge stays generic on purpose.
    return { kind: 'human', label: '成员', source: '本人输入', detail: null };
  }
  const user = /^user:(.+)$/.exec(author);
  if (user?.[1]) return { kind: 'human', label: user[1], source: '本人输入', detail: null };
  return { kind: 'human', label: author || '成员', source: '本人输入', detail: null };
}

/** Relative time with a date fallback; an unparseable value shows verbatim. */
export function formatSuggestionTime(createdAt: string, now: Date = new Date()): string {
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return createdAt;
  const elapsed = Math.max(0, now.getTime() - time);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const date = new Date(time);
  const sameYear = date.getFullYear() === now.getFullYear();
  const plain = `${sameYear ? '' : `${date.getFullYear()}/`}${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  return `${plain} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
