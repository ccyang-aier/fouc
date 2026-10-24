import { expect, test } from 'bun:test';
import { readFile, stat } from 'node:fs/promises';
import assets from './emoji-assets.json';
import { emojiAsset, findEmoji, tokenizeEmoji } from './emoji-data';
import { emojiCatalog, emojiGroups, searchEmoji } from './emoji-catalog';

test('emoji matches preserve UTF-16 positions across skin tones, ZWJ, flags, keycaps and variation selectors', () => {
  const text = 'A 👩🏽‍💻 和🇨🇳 1️⃣ B\n☕️🙂';
  const matches = findEmoji(text);
  expect(matches.map(({ start, end }) => [start, end])).toEqual([[2, 9], [11, 15], [16, 19], [22, 24], [24, 26]]);
  expect(matches.map(item => text.slice(item.start, item.end))).toEqual(['👩🏽‍💻', '🇨🇳', '1️⃣', '☕️', '🙂']);
  expect(tokenizeEmoji(text).map(item => item.text).join('')).toBe(text);
  expect(findEmoji('© company 2026 ™ words 123')).toEqual([]);
});

test('ordinary and skin-tone emoji share the same local vector artwork style', () => {
  expect(emojiAsset('👍')).toBe('/emoji/twemoji/1f44d.svg');
  expect(emojiAsset('👍🏽')).toBe('/emoji/twemoji/1f44d-1f3fd.svg');
  expect(emojiAsset('❤️')).toBe(emojiAsset('❤'));
  expect(emojiAsset('not an emoji')).toBeNull();
  for (const emoji of ['👨‍👩‍👧‍👦', '🏴‍☠️', '🇨🇳', '🏳️‍🌈', '❤️‍🔥', '🫩']) expect(emojiAsset(emoji)).toStartWith('/emoji/');
});

test('the complete categorized picker is searchable by Chinese, English and common aliases', () => {
  expect(emojiCatalog).toHaveLength(1914);
  for (const group of emojiGroups) expect(searchEmoji('', group).length).toBeGreaterThan(50);
  expect(searchEmoji('点赞', 'Smileys & Emotion').some(entry => entry.emoji === '👍')).toBe(true);
  expect(searchEmoji('rocket', 'Flags').some(entry => entry.emoji === '🚀')).toBe(true);
  expect(searchEmoji('中国', 'Smileys & Emotion').some(entry => entry.emoji === '🇨🇳')).toBe(true);
  expect(searchEmoji('', 'recent', ['👍', 'not-emoji', '🇨🇳']).map(entry => entry.emoji)).toEqual(['👍', '🇨🇳']);
});

test('every referenced asset is local, nonempty, has the expected image signature and retains source licenses', async () => {
  expect(Object.keys(assets)).toHaveLength(4009);
  await Promise.all(Object.values(assets).map(async file => {
    expect(file).toMatch(/^twemoji\/[0-9a-f-]+\.svg$/);
    const url = new URL(`../../../public/emoji/${file}`, import.meta.url);
    const bytes = await readFile(url);
    expect(bytes.toString('utf8')).toStartWith('<svg');
  }));
  for (const file of ['twemoji-LICENSE-GRAPHICS.txt', 'unicode-LICENSE.txt', 'ATTRIBUTION.txt']) expect((await stat(new URL(`../../../public/emoji/${file}`, import.meta.url))).size).toBeGreaterThan(0);
});
