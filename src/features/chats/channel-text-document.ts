import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export const CHANNEL_MESSAGE_MAX_LENGTH = 20_000;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function limitChannelText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  for (const { segment, index } of graphemes.segment(value)) {
    if (index + segment.length > limit) return value.slice(0, index);
  }
  return value;
}

/** One text block keeps UTF-16 text offsets identical to editor positions minus one. */
export function channelTextDocument(value: string): JSONContent {
  const content: JSONContent[] = [];
  value.replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
    if (index) content.push({ type: 'hardBreak' });
    if (line) content.push({ type: 'text', text: line });
  });
  return { type: 'doc', content: [{ type: 'paragraph', content }] };
}

export function channelDocumentText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, '', node => node.type.name === 'hardBreak' ? '\n' : '');
}
