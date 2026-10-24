import { expect, test } from 'bun:test';
import type { ChannelMember } from '@fouc/shared/chats';
import { channelMentionQuery, findChannelMentions } from './channel-mentions';

function member(id: string, name: string, kind: 'user' | 'agent' = 'user', active = true): ChannelMember {
  return { id, name, kind, active, userId: id, image: null, role: 'member', installationId: null, agentOwnerId: null, joinedAt: '2026-10-25T00:00:00Z' };
}
const members = [member('short', '苏晴'), member('person', '苏晴 · 示例'), member('agent', 'Codex CLI', 'agent'), member('inactive', 'Lin', 'user', false)];

test('mentions recognize real identities with spaces and prefer the longest full name', () => {
  const body = '请 @苏晴 · 示例 看看，@Codex CLI 一起讨论。';
  const hits = findChannelMentions(body, members);
  expect(hits.map(hit => hit.member.id)).toEqual(['person', 'agent']);
  expect(hits.map(hit => body.slice(hit.start, hit.end))).toEqual(['@苏晴 · 示例', '@Codex CLI']);
});

test('unknown names, email addresses and partial names stay ordinary text', () => {
  expect(findChannelMentions('@苏晴ABC example@Lin.org @@Lin @Nobody @Codex', members)).toEqual([]);
  expect(findChannelMentions('(@Lin), @苏晴!', members).map(hit => hit.member.id)).toEqual(['inactive', 'short']);
});

test('historical inactive identities remain identifiable and Unicode offsets round-trip', () => {
  const body = '🚀 @Lin 👨‍👩‍👧‍👦 @苏晴 · 示例';
  const hits = findChannelMentions(body, members);
  expect(hits[0].start).toBe(3);
  expect(hits.map(hit => body.slice(hit.start, hit.end))).toEqual(['@Lin', '@苏晴 · 示例']);
});

test('queries support names with spaces and close for completed mentions and other lines', () => {
  expect(channelMentionQuery('请 @Codex C', 10, members)).toBe('Codex C');
  expect(channelMentionQuery('@苏晴 · ', 6, members)).toBe('苏晴 · ');
  expect(channelMentionQuery('@苏', 2, members)).toBe('苏');
  expect(channelMentionQuery('@苏晴 · 示例 ', 9, members)).toBeNull();
  expect(channelMentionQuery('example@Lin', 11, members)).toBeNull();
  expect(channelMentionQuery('@Codex\n普通内容', 12, members)).toBeNull();
});
