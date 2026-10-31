import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Emoji } from './emoji';
import { emojiGroups, emojiEntries, findEmoji, findEmojiInText } from './emoji-catalog';

test('the default picker exposes exactly 448 reviewed emoji in eight complete seven-row categories', () => {
  expect(emojiGroups).toHaveLength(8);
  expect(emojiGroups.every(group => group.items.length === 56)).toBe(true);
  expect(new Set(emojiEntries.map(entry => entry.hexcode)).size).toBe(448);
  expect(new Set(emojiEntries.map(entry => entry.emoji)).size).toBe(448);
});

test('existing Unicode presentation variants resolve to the same local artwork without rewriting the value', () => {
  expect(findEmoji('❤')?.hexcode).toBe(findEmoji('❤️')?.hexcode);
  expect(findEmoji('🧑‍💻')?.hexcode).toBe('1F9D1-200D-1F4BB');
  const html = renderToStaticMarkup(<Emoji value="❤️" size={24} />);
  expect(html).toContain('/icons/openmoji/2764.svg');
  expect(html).toContain('data-emoji="❤️"');
  expect(html).toContain('data-icon-library="openmoji"');
});

test('Unicode outside the curated library stays readable instead of becoming broken image requests', () => {
  const html = renderToStaticMarkup(<Emoji value="👍🏽" />);
  expect(html).toContain('👍🏽');
  expect(html).not.toContain('<img');
  expect(html).toContain('data-icon-library="native-emoji"');
});

test('text decorations preserve UTF-16 boundaries, composite sequences and unsupported content', () => {
  const text = 'A 🧑‍💻 ❤️ B 👩🏽‍💻 ☕️';
  const matches = findEmojiInText(text);
  expect(matches.map(match => text.slice(match.start, match.end))).toEqual(['🧑‍💻', '❤️', '☕️']);
  expect(matches.every(match => match.src.startsWith('/icons/openmoji/'))).toBe(true);
  expect(findEmojiInText('© company 2026 ™ words 123')).toEqual([]);
});
