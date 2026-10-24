import type { ChannelMember } from '@fouc/shared/chats';

export type ChannelMention = { start: number; end: number; member: ChannelMember };

function mentionBoundary(text: string, index: number) {
  return index === 0 || !/[\w@]/u.test(text[index - 1]);
}

/** Match real channel identities, including names with spaces; prefer the longest name. */
export function findChannelMentions(text: string, members: ChannelMember[]): ChannelMention[] {
  const names = [...members].filter(member => member.name).sort((a, b) => b.name.length - a.name.length);
  const mentions: ChannelMention[] = [];
  for (let start = text.indexOf('@'); start !== -1; start = text.indexOf('@', start + 1)) {
    if (!mentionBoundary(text, start)) continue;
    const member = names.find(candidate => {
      const end = start + candidate.name.length + 1;
      return text.startsWith(candidate.name, start + 1) && (end === text.length || !/[\p{L}\p{N}_]/u.test(text[end]));
    });
    if (member) {
      const end = start + member.name.length + 1;
      mentions.push({ start, end, member });
      start = end - 1;
    }
  }
  return mentions;
}

/** A completed mention stays a label instead of reopening member suggestions. */
export function channelMentionQuery(text: string, caret: number, members: ChannelMember[]): string | null {
  const prefix = text.slice(0, caret);
  const start = prefix.lastIndexOf('@');
  if (start < 0 || !mentionBoundary(prefix, start)) return null;
  const query = prefix.slice(start + 1);
  if (query.includes('\n')) return null;
  if (members.some(member => member.name.length > query.length && member.name.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()))) return query;
  if (findChannelMentions(prefix, members).some(mention => mention.start === start)) return null;
  return query;
}
