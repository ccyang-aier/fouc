'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChannelMember } from '@fouc/shared/chats';
import { EmojiGlyph } from '@/components/chat-emoji/emoji-glyph';
import { findEmoji } from '@/components/chat-emoji/emoji-data';
import { findChannelMentions } from './channel-mentions';
import styles from './channel-rich-text.module.css';

type RichNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: RichNode[] };
const plainTags = new Set(['pre', 'code', 'a']);

function channelInlineText(options: { members: ChannelMember[] }) {
  return (tree: RichNode) => {
    function visit(node: RichNode) {
      if (!node.children || plainTags.has(node.tagName ?? '')) return;
      const children: RichNode[] = [];
      for (const child of node.children) {
        if (child.type !== 'text' || !child.value) { visit(child); children.push(child); continue; }
        const value = child.value;
        const mentions = findChannelMentions(value, options.members);
        const parts = [
          ...mentions.map(mention => ({ start: mention.start, end: mention.end, properties: { className: styles.mention, 'data-channel-mention': mention.member.id, 'data-kind': mention.member.kind } })),
          ...findEmoji(value).filter(emoji => !mentions.some(mention => emoji.start >= mention.start && emoji.end <= mention.end)).map(emoji => ({ start: emoji.start, end: emoji.end, properties: { 'data-channel-emoji': emoji.emoji } })),
        ].sort((a, b) => a.start - b.start);
        let cursor = 0;
        for (const part of parts) {
          if (cursor < part.start) children.push({ type: 'text', value: value.slice(cursor, part.start) });
          children.push({ type: 'element', tagName: 'span', properties: part.properties, children: [{ type: 'text', value: value.slice(part.start, part.end) }] });
          cursor = part.end;
        }
        if (cursor < value.length) children.push({ type: 'text', value: value.slice(cursor) });
      }
      node.children = children;
    }
    visit(tree);
  };
}

/** Enhance text nodes only. Code, links and uploaded file cards keep their own rendering. */
export function ChannelMessageMarkdown({ body, members }: { body: string; members: ChannelMember[] }) {
  const richText = useMemo<[typeof channelInlineText, { members: ChannelMember[] }]>(() => [channelInlineText, { members }], [members]);
  return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[richText]} components={{
    a: ({ children, href, title }) => <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ alt }) => <span>{alt}</span>,
    span: ({ node, children, ...props }) => {
      const emoji = node?.properties['data-channel-emoji'];
      return typeof emoji === 'string' ? <EmojiGlyph emoji={emoji} size={20} /> : <span {...props}>{children}</span>;
    },
  }}>{body}</ReactMarkdown>;
}
