'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Editor } from '@tiptap/core';
import type { ChannelMember } from '@fouc/shared/chats';
import { channelTextExtensions } from './channel-text-extensions';
import { CHANNEL_MESSAGE_MAX_LENGTH, channelDocumentText, channelTextDocument, limitChannelText } from './channel-text-document';
import styles from './channel-rich-text.module.css';

export type ChannelTextInputHandle = {
  readonly selectionStart: number;
  readonly selectionEnd: number;
  focus: (options?: FocusOptions) => void;
  setSelectionRange: (from: number, to: number) => void;
};

export function ChannelTextInput({ ref, value, members, label, placeholder, disabled = false, readOnly = false, autoFocus = false, suggestionsId, activeSuggestionId, onChange, onSelectionChange, onKeyDown, onFiles }: {
  ref?: Ref<ChannelTextInputHandle>; value: string; members: ChannelMember[]; label: string; placeholder: string;
  disabled?: boolean; readOnly?: boolean; autoFocus?: boolean; suggestionsId?: string; activeSuggestionId?: string;
  onChange: (value: string, caret: number) => void; onSelectionChange: (caret: number) => void;
  onKeyDown: (event: KeyboardEvent) => void; onFiles: (files: File[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const latest = useRef({ value, members, disabled, readOnly, onChange, onSelectionChange, onKeyDown, onFiles });
  useEffect(() => { latest.current = { value, members, disabled, readOnly, onChange, onSelectionChange, onKeyDown, onFiles }; });

  useImperativeHandle(ref, () => ({
    get selectionStart() { return Math.max(0, (editorRef.current?.state.selection.from ?? 1) - 1); },
    get selectionEnd() { const editor = editorRef.current; return editor ? Math.min(channelDocumentText(editor.state.doc).length, Math.max(0, editor.state.selection.to - 1)) : 0; },
    focus: options => editorRef.current?.view.dom.focus(options),
    setSelectionRange(from, to) {
      const editor = editorRef.current;
      if (!editor) return;
      const length = channelDocumentText(editor.state.doc).length;
      editor.commands.setTextSelection({ from: Math.min(length, Math.max(0, from)) + 1, to: Math.min(length, Math.max(0, to)) + 1 });
    },
  }), []);

  useEffect(() => {
    if (!host.current) return;
    const editor = new Editor({
      element: host.current,
      extensions: channelTextExtensions(() => latest.current.members),
      content: channelTextDocument(latest.current.value),
      editable: !latest.current.disabled && !latest.current.readOnly,
      editorProps: {
        attributes: { class: styles.surface, role: 'textbox', 'aria-multiline': 'true', tabindex: '0' },
        clipboardTextSerializer: slice => slice.content.textBetween(0, slice.content.size, '', node => node.type.name === 'hardBreak' ? '\n' : ''),
        handleKeyDown(_view, event) {
          if (event.isComposing) return false;
          latest.current.onKeyDown(event);
          if (event.defaultPrevented) return true;
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!latest.current.disabled && !latest.current.readOnly) editor.commands.insertContent({ type: 'hardBreak' });
            return true;
          }
          return false;
        },
        handlePaste(view, event) {
          if (latest.current.disabled || latest.current.readOnly) return true;
          const clipboard = event.clipboardData;
          if (!clipboard) return false;
          const files = Array.from(clipboard.files);
          if (files.length) { event.preventDefault(); latest.current.onFiles(files); return true; }
          // Paste text only: copied HTML cannot inject remote images, styling or foreign editor nodes.
          const text = clipboard.getData('text/plain').replace(/\r\n?/g, '\n');
          event.preventDefault();
          const current = channelDocumentText(view.state.doc);
          const { from, to } = view.state.selection;
          const selected = Math.min(current.length, to - 1) - Math.max(0, from - 1);
          const next = limitChannelText(text, CHANNEL_MESSAGE_MAX_LENGTH - current.length + selected);
          editor.commands.insertContent(channelTextDocument(next).content?.[0].content ?? []);
          return true;
        },
        handleDrop: () => true,
      },
      onUpdate({ editor }) {
        const value = channelDocumentText(editor.state.doc);
        editor.view.dom.dataset.empty = String(!value);
        latest.current.onChange(value, Math.max(0, editor.state.selection.from - 1));
      },
      onSelectionUpdate({ editor }) { latest.current.onSelectionChange(Math.max(0, editor.state.selection.from - 1)); },
    });
    editorRef.current = editor;
    return () => { editorRef.current = null; editor.destroy(); };
  }, []);

  useEffect(() => { if (autoFocus) editorRef.current?.view.dom.focus({ preventScroll: true }); }, [autoFocus]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (channelDocumentText(editor.state.doc) !== value) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(channelTextDocument(value), { emitUpdate: false });
      const end = value.length + 1;
      editor.commands.setTextSelection({ from: Math.min(from, end), to: Math.min(to, end) });
    }
    editor.view.dom.dataset.empty = String(!value);
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const editable = !disabled && !readOnly;
    if (editor.isEditable !== editable) editor.setEditable(editable, false);
    // Updating the view also refreshes labels when the member directory changes.
    editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: {
      class: styles.surface, role: 'textbox', 'aria-label': label, 'aria-multiline': 'true',
      'aria-disabled': String(disabled), 'aria-readonly': String(readOnly),
      'aria-autocomplete': 'list', 'aria-controls': suggestionsId ?? '', 'aria-activedescendant': activeSuggestionId ?? '',
      'data-placeholder': placeholder, 'data-empty': String(!channelDocumentText(editor.state.doc)), tabindex: disabled ? '-1' : '0',
    } } });
  }, [members, label, placeholder, disabled, readOnly, suggestionsId, activeSuggestionId]);

  return <div ref={host} className={styles.input} />;
}
