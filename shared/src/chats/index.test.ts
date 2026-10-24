import { describe, expect, test } from 'bun:test';
import { CHANNEL_ICON_NAMES, channelColorSchema, channelEmojiSchema, channelIconSchema, createChannelInputSchema, isChannelEmoji, toggleChannelReactionSchema, updateChannelInputSchema } from './index';

const projectId = '2e6a6ef5-8cad-4cd6-8ae7-fb6e4e4f2f05';
const channelId = '26b3b37a-a8f1-4c1c-8f4a-5b6739f45d85';
const messageId = 'b788e0a2-f68c-4ab0-a5ab-7521c1020c56';
describe('channel appearance contracts', () => {
  test('creates with a default icon while leaving the random color decision to the service', () => {
    const channel = createChannelInputSchema.parse({ projectId, name: 'Design' });
    expect(channel.icon).toBe('hash');
    expect(channel.color).toBeUndefined();
    expect(channelColorSchema.options).toEqual(['violet', 'blue', 'green', 'orange', 'rose', 'slate']);
  });
  test('accepts the complete icon catalog and preserves explicit appearance selections', () => {
    for (const icon of CHANNEL_ICON_NAMES) {
      expect(channelIconSchema.parse(icon)).toBe(icon);
      expect(createChannelInputSchema.parse({ projectId, name: 'Design', icon, color: 'rose' })).toMatchObject({ icon, color: 'rose' });
      expect(updateChannelInputSchema.parse({ projectId, channelId, icon })).toMatchObject({ icon });
    }
    expect(channelIconSchema.safeParse('custom-svg').success).toBe(false);
    expect(createChannelInputSchema.safeParse({ projectId, name: 'Design', icon: '<svg/>' }).success).toBe(false);
  });
});

describe('single emoji reaction contracts', () => {
  test.each(['😀', '❤️', '❤', '☀', '☕', '🫩', '👩🏽‍💻', '🧑🏿‍🚀', '🏳️‍🌈', '🏴‍☠️', '🇨🇳', '🇺🇳', '1️⃣', '#️⃣', '👨‍👩‍👧‍👦', '🫱🏽‍🫲🏻', '🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}'])('accepts one emoji grapheme %s', emoji => {
    expect(isChannelEmoji(emoji)).toBe(true);
    expect(channelEmojiSchema.parse(emoji)).toBe(emoji);
    expect(toggleChannelReactionSchema.parse({ projectId, channelId, messageId, emoji }).emoji).toBe(emoji);
  });
  test.each(['', 'text', 'a', '1', '#', '*', '😀😀', '👍 👎', ' 👍', '👍 ', '👍\n', '<img src=x>', '<b>😀</b>', '🏽', '🇨', '\u200d', '😀\u200d', '👩‍🚀‍💻', '☀\uFE0E', '😀\u0301', '😀'.repeat(100)])('rejects text, incomplete sequences or multiple emojis %s', value => {
    expect(isChannelEmoji(value)).toBe(false);
    expect(channelEmojiSchema.safeParse(value).success).toBe(false);
  });
  test('rejects non-string reaction values', () => {
    for (const value of [null, undefined, 1, true, ['👍'], { emoji: '👍' }]) expect(isChannelEmoji(value)).toBe(false);
  });
});
