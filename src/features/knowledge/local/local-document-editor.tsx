'use client';

import { useMemo } from 'react';
import { Extension } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import { history, redo, undo } from '@tiptap/pm/history';
import { createBlockIdExtension, createKnowledgeExtensions } from '@fouc/shared/knowledge/schema';
import { ArrowLeft, CloudSlash, Star, Trash } from '@phosphor-icons/react';
import { applyBlockNodeViews } from '../editor/blocks';
import { createSlashPasteExtensions, SlashMenuLayer } from '../editor/commands';
import { DocumentEditorBody, DocumentEditorFrame, DocumentEditorHeader } from '../editor/editor-layout';
import { createBlockEditingExtensions } from '../editor/extensions';
import { IconButton } from '../dense-sidebar/icon-button';
import type { LocalDocument } from './local-library';

const localHistory = Extension.create({
  name: 'localHistory',
  addProseMirrorPlugins: () => [history()],
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => undo(this.editor.state, this.editor.view.dispatch),
      'Mod-Shift-z': () => redo(this.editor.state, this.editor.view.dispatch),
      'Mod-y': () => redo(this.editor.state, this.editor.view.dispatch),
    };
  },
});

export function LocalDocumentEditor({ document, onChange, onBack }: { document: LocalDocument; onChange: (patch: Partial<LocalDocument>) => void; onBack: () => void }) {
  const extensions = useMemo(() => [
    ...applyBlockNodeViews(createKnowledgeExtensions()),
    createBlockIdExtension({ pageId: document.id }),
    ...createBlockEditingExtensions(),
    ...createSlashPasteExtensions(),
    localHistory,
  ], [document.id]);
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: document.body,
    editorProps: { attributes: { 'aria-label': '页面正文' } },
    onUpdate: ({ editor: current }) => onChange({ body: current.getJSON() }),
  }, [extensions]);

  return <DocumentEditorFrame>
    <DocumentEditorHeader editor={editor} editable leading={<IconButton label="返回文档列表" onClick={onBack} className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted-strong)] hover:bg-[var(--raise)]"><ArrowLeft size={16} /></IconButton>} trailing={<>
      <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><CloudSlash size={14} />保存在本机</span>
      <IconButton label={document.starred ? '取消星标' : '添加星标'} onClick={() => onChange({ starred: !document.starred })} className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted-strong)] hover:bg-[var(--raise)]"><Star size={16} weight={document.starred ? 'fill' : 'regular'} /></IconButton>
      <IconButton label="移至回收站" onClick={() => { onChange({ deleted: true }); onBack(); }} className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted-strong)] hover:bg-[var(--raise)]"><Trash size={16} /></IconButton>
    </>} />
    <DocumentEditorBody editor={editor} before={<input aria-label="文档标题" value={document.title} onChange={(event) => onChange({ title: event.target.value })} className="mb-5 w-full bg-transparent text-[22px] font-semibold tracking-[-0.015em] text-[var(--ink)] outline-none" />} />
    <SlashMenuLayer editor={editor} />
  </DocumentEditorFrame>;
}
