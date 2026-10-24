import assets from './emoji-assets.json';

const assetMap: Readonly<Record<string, string>> = assets;
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const pictograph = /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\ufe0f?\u20e3/u;
const skinTone = /[\u{1f3fb}-\u{1f3ff}]/gu;

export type EmojiMatch = { start: number; end: number; emoji: string; src: string };
export type EmojiToken = { text: string; emoji?: string };

export function emojiKey(emoji: string): string {
  return [...emoji].filter(character => character !== '\ufe0f' && character !== '\ufe0e').map(character => character.codePointAt(0)!.toString(16)).join('-');
}

export function emojiAsset(emoji: string): string | null {
  const file = assetMap[emojiKey(emoji)] ?? assetMap[emojiKey(emoji.replace(skinTone, ''))];
  return file ? `/emoji/${file}` : null;
}

/** Offsets follow the source string's UTF-16 positions, including ZWJ and skin modifiers. */
export function findEmoji(text: string): EmojiMatch[] {
  const matches: EmojiMatch[] = [];
  for (const { segment, index } of segmenter.segment(text)) {
    if (!pictograph.test(segment) || /^[©®™]$/.test(segment)) continue;
    const src = emojiAsset(segment);
    if (src) matches.push({ start: index, end: index + segment.length, emoji: segment, src });
  }
  return matches;
}

export function tokenizeEmoji(text: string): EmojiToken[] {
  const tokens: EmojiToken[] = [];
  for (const { segment } of segmenter.segment(text)) {
    if (pictograph.test(segment) && !/^[©®™]$/.test(segment)) tokens.push({ text: segment, emoji: segment });
    else if (tokens.length && !tokens.at(-1)!.emoji) tokens.at(-1)!.text += segment;
    else tokens.push({ text: segment });
  }
  return tokens;
}
