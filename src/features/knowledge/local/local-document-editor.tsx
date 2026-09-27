'use client';

/** Editor for an explicitly selected local document. */

import { useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { createKnowledgeExtensions } from '@fouc/shared/knowledge/schema';
import { TextB, TextItalic, TextH, ListBullets, ArrowLeft, Star, Trash, CloudSlash } from '@phosphor-icons/react';
import { createBlockEditingExtensions, setBlockFormat } from '../editor/extensions';
import { IconButton } from '../dense-sidebar/icon-button';
import type { LocalDocument } from './local-library';

export function LocalDocumentEditor({ document, onChange, onBack }: { document: LocalDocument; onChange: (patch: Partial<LocalDocument>) => void; onBack: () => void }) {
  const extensions = useMemo(() => [...createKnowledgeExtensions(), ...createBlockEditingExtensions()], []);
  const editor = useEditor({ extensions, immediatelyRender: false, content: document.body, onUpdate: ({ editor: current }) => onChange({ body: current.getJSON() }) });
  return <section className="flex h-full min-h-0 flex-col">
    <header className="flex min-h-12 items-center gap-2 border-b border-[var(--line)] px-5">
      <IconButton label="返回文档列表" onClick={onBack} className="rounded-md p-1.5 hover:bg-[var(--surface-hover)]"><ArrowLeft size={16} /></IconButton>
      <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><CloudSlash size={14} />保存在本机</span>
      <IconButton label={document.starred ? '取消星标' : '添加星标'} onClick={() => onChange({ starred: !document.starred })} className="rounded-md p-1.5 hover:bg-[var(--surface-hover)]"><Star size={16} weight={document.starred ? 'fill' : 'regular'} /></IconButton>
      <IconButton label="移至回收站" onClick={() => { onChange({ deleted: true }); onBack(); }} className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"><Trash size={16} /></IconButton>
    </header>
    <div className="flex gap-1 border-b border-[var(--line)] px-5 py-2 text-[var(--muted-strong)]">
      <IconButton label="加粗" onClick={() => editor?.chain().focus().toggleMark('bold').run()} className="rounded-md p-1.5 hover:bg-[var(--surface-hover)]"><TextB size={16} /></IconButton>
      <IconButton label="斜体" onClick={() => editor?.chain().focus().toggleMark('italic').run()} className="rounded-md p-1.5 hover:bg-[var(--surface-hover)]"><TextItalic size={16} /></IconButton>
      <IconButton label="标题" onClick={() => { if (editor) editor.chain().focus().command(setBlockFormat({ kind: 'heading', level: 2 })).run(); }} className="rounded-md p-1.5 hover:bg-[var(--surface-hover)]"><TextH size={16} /></IconButton>
      <IconButton label="列表" onClick={() => { if (editor) editor.chain().focus().command(setBlockFormat({ kind: 'bulletList' })).run(); }} className="rounded-md p-1.5 hover:bg-[var(--surface-hover)]"><ListBullets size={16} /></IconButton>
      <button type="button" aria-pressed={document.draft} onClick={() => onChange({ draft: !document.draft })} className="ml-auto rounded-md px-2 text-[11px] hover:bg-[var(--surface-hover)]">{document.draft ? '已标记草稿' : '标记为草稿'}</button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-[800px] px-10 py-10">
        <input aria-label="文档标题" value={document.title} onChange={(event) => onChange({ title: event.target.value })} className="mb-6 w-full bg-transparent text-[26px] font-semibold tracking-tight text-[var(--ink)] outline-none" />
        <EditorContent editor={editor} className="text-[14px] leading-8 text-[var(--ink-soft)] [&_.ProseMirror]:min-h-[50vh] [&_.ProseMirror]:outline-none [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6" />
      </div>
    </div>
  </section>;
}
