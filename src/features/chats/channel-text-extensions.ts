import { Extension, Node } from '@tiptap/core';
import { history, redo, undo } from '@tiptap/pm/history';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { ChannelMember } from '@fouc/shared/chats';
import { findEmojiInText } from '@/components/icons/emoji-catalog';
import { findChannelMentions } from './channel-mentions';
import { CHANNEL_MESSAGE_MAX_LENGTH, channelDocumentText } from './channel-text-document';
import styles from './channel-rich-text.module.css';

const Doc = Node.create({ name: 'doc', topNode: true, content: 'paragraph' });
const Paragraph = Node.create({ name: 'paragraph', content: 'inline*', group: 'block', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
const Text = Node.create({ name: 'text', group: 'inline' });
const HardBreak = Node.create({ name: 'hardBreak', group: 'inline', inline: true, selectable: false, linebreakReplacement: true, parseHTML: () => [{ tag: 'br' }], renderHTML: () => ['br'] });

export function channelTextExtensions(getMembers: () => ChannelMember[]) {
  const RichText = Extension.create({
    name: 'channelRichText',
    addKeyboardShortcuts() {
      return {
        'Mod-z': () => undo(this.editor.state, this.editor.view.dispatch),
        'Mod-Shift-z': () => redo(this.editor.state, this.editor.view.dispatch),
        'Mod-y': () => redo(this.editor.state, this.editor.view.dispatch),
        'Shift-Enter': () => this.editor.commands.insertContent({ type: 'hardBreak' }),
      };
    },
    addProseMirrorPlugins() {
      return [history(), new Plugin({
        filterTransaction: transaction => !transaction.docChanged || channelDocumentText(transaction.doc).length <= CHANNEL_MESSAGE_MAX_LENGTH,
        props: {
          decorations(state) {
            const value = channelDocumentText(state.doc);
            const mentions = findChannelMentions(value, getMembers());
            const decorations = mentions.map(({ start, end, member }) => Decoration.inline(start + 1, end + 1, {
              class: styles.mention, 'data-channel-mention': member.id, 'data-kind': member.kind,
            }));
            for (const { start, end, emoji, src } of findEmojiInText(value)) {
              if (mentions.some(mention => start >= mention.start && end <= mention.end)) continue;
              decorations.push(Decoration.inline(start + 1, end + 1, {
                class: styles.editorEmoji, 'data-channel-emoji': emoji, style: `background-image:url("${src}")`,
              }));
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      })];
    },
  });
  return [Doc, Paragraph, Text, HardBreak, RichText];
}
