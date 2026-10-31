import catalog from './openmoji-catalog.json';

export const emojiGroups = catalog;
export type EmojiEntry = (typeof emojiGroups)[number]['items'][number];
export const emojiEntries: readonly EmojiEntry[] = emojiGroups.flatMap(group => group.items);
export const normalizeEmoji = (value: string) => value.replace(/\uFE0F/g, '');
const byEmoji = new Map(emojiEntries.map(entry => [normalizeEmoji(entry.emoji), entry]));
export const findEmoji = (value: string) => byEmoji.get(normalizeEmoji(value));

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
export type EmojiMatch = { start: number; end: number; emoji: string; src: string };

/** Markdown annotations retain the source's UTF-16 offsets; other Unicode stays text. */
export function findEmojiInText(text: string): EmojiMatch[] {
  const matches: EmojiMatch[] = [];
  for (const { segment, index } of segmenter.segment(text)) {
    const entry = findEmoji(segment);
    if (entry) matches.push({ start: index, end: index + segment.length, emoji: segment, src: `/icons/openmoji/${entry.hexcode}.svg` });
  }
  return matches;
}
