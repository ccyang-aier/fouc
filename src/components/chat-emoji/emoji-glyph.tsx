import { Question } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { emojiAsset, tokenizeEmoji } from './emoji-data';
import styles from './emoji.module.css';

export function EmojiGlyph({ emoji, size = 20, className }: { emoji: string; size?: number; className?: string }) {
  const src = emojiAsset(emoji);
  return src
    // Local emoji artwork must retain its exact intrinsic size in text and composer decorations.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={cn(styles.glyph, className)} src={src} width={size} height={size} alt={emoji} draggable={false} loading="lazy" decoding="async" />
    : <span className={cn(styles.glyph, styles.missing, className)} role="img" aria-label={emoji} style={{ width: size, height: size }}><Question size={size * .7} aria-hidden /></span>;
}

export function EmojiText({ text, size = 20, className }: { text: string; size?: number; className?: string }) {
  return <span className={className}>{tokenizeEmoji(text).map((token, index) => token.emoji ? <EmojiGlyph key={index} emoji={token.emoji} size={size} /> : token.text)}</span>;
}
