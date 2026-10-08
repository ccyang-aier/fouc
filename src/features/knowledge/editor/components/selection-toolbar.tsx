'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { Chat, Code, Highlighter, LinkSimple, ListBullets, ListChecks, ListNumbers, Quotes, TextB, TextItalic, TextStrikethrough } from '@phosphor-icons/react';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getOverlayRoot } from '@/lib/overlay-root';
import { canComposeSelectionComment, requestSelectionComment } from '../../comments/comment-compose-bridge';
import { currentBlockFormat, setBlockFormat, type BlockFormat } from '../extensions/format/block-format';
import styles from './selection-toolbar.module.css';

function SelectionLink({ editor, onOpenChange }: { editor: Editor; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const [invalid, setInvalid] = useState(false);
  const selection = useRef({ from: 0, to: 0 });
  const apply = (url: string | null) => {
    const chain = editor.chain().focus().setTextSelection(selection.current);
    if (url) chain.setMark('link', { href: url }); else chain.unsetMark('link');
    chain.run(); setOpen(false); onOpenChange(false);
  };
  return <DropdownMenu modal={false} open={open} onOpenChange={value => {
    if (value) { selection.current = { from: editor.state.selection.from, to: editor.state.selection.to }; setHref(editor.getAttributes('link').href ?? ''); setInvalid(false); }
    onOpenChange(value);
    setOpen(value);
  }}>
    <DropdownMenuTrigger asChild><button type="button" className={styles.tool} aria-label="设置链接" title="链接" aria-pressed={editor.isActive('link')}><LinkSimple size={18} /></button></DropdownMenuTrigger>
    <DropdownMenuContent data-selection-link align="end" side="bottom" onCloseAutoFocus={event => { event.preventDefault(); editor.commands.focus(); }}>
      <form className={styles.linkForm} onSubmit={event => { event.preventDefault(); const url = safeKnowledgeUrl(href.trim(), 'link'); if (!url) { setInvalid(true); return; } apply(url); }} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
        <label>链接地址<input autoFocus aria-label="正文链接地址" placeholder="https://" value={href} onChange={event => { setHref(event.target.value); setInvalid(false); }} aria-invalid={invalid} /></label>
        {invalid && <p role="alert">请输入有效、安全的链接地址。</p>}
        <div><button type="button" onClick={() => apply(null)}>移除链接</button><button type="submit">应用</button></div>
      </form>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** The shared text-selection surface uses the editor's existing format commands. */
export function SelectionToolbar({ editor }: { editor: Editor | null }) {
  const toolbar = useRef<HTMLDivElement>(null);
  const linkOpen = useRef(false);
  const [position, setPosition] = useState<{ x: number; y: number; maxWidth: number } | null>(null);
  const refresh = useCallback(() => {
    if (!editor || editor.isDestroyed || !editor.isEditable || !(editor.state.selection instanceof TextSelection) || editor.state.selection.empty) { linkOpen.current = false; setPosition(null); return; }
    const active = document.activeElement;
    const inTools = active instanceof Element && (toolbar.current?.contains(active) || active.closest('[data-selection-link]'));
    if (!editor.isFocused && !inTools && !linkOpen.current) { setPosition(null); return; }
    const scroll = editor.view.dom.closest('[data-document-scroll]')?.getBoundingClientRect();
    if (!scroll) return;
    const start = editor.view.coordsAtPos(editor.state.selection.from);
    const end = editor.view.coordsAtPos(editor.state.selection.to, -1);
    if (end.bottom < scroll.top || start.top > scroll.bottom) { linkOpen.current = false; setPosition(null); return; }
    const comments = editor.view.dom.closest('[aria-label="页面编辑器"]')?.querySelector('[aria-label="页面评论"]')?.getBoundingClientRect();
    const edge = comments && comments.left < scroll.right ? comments.left : scroll.right;
    const maxWidth = Math.min(edge - scroll.left - 16, window.innerWidth - 24);
    if (maxWidth < 80) { linkOpen.current = false; setPosition(null); return; }
    const width = Math.min(toolbar.current?.offsetWidth || 460, maxWidth);
    const height = toolbar.current?.offsetHeight || 39;
    const left = Math.max(12, scroll.left + 8);
    const right = Math.min(window.innerWidth - 12, edge - 8);
    const x = Math.min(Math.max((start.left + end.right) / 2 - width / 2, left), right - width);
    const above = start.top - height - 9;
    const y = above >= scroll.top + 8 ? above : Math.min(end.bottom + 9, scroll.bottom - height - 8);
    setPosition({ x, y, maxWidth });
  }, [editor]);
  useEffect(() => {
    if (!editor) return;
    const scroll = editor.view.dom.closest('[data-document-scroll]');
    const blur = () => requestAnimationFrame(refresh);
    editor.on('transaction', refresh); editor.on('focus', refresh); editor.on('blur', blur);
    scroll?.addEventListener('scroll', refresh, { passive: true });
    const observer = new ResizeObserver(refresh);
    if (scroll) observer.observe(scroll);
    window.addEventListener('resize', refresh);
    document.addEventListener('fullscreenchange', refresh);
    return () => {
      editor.off('transaction', refresh); editor.off('focus', refresh); editor.off('blur', blur);
      scroll?.removeEventListener('scroll', refresh); window.removeEventListener('resize', refresh);
      observer.disconnect(); document.removeEventListener('fullscreenchange', refresh);
    };
  }, [editor, refresh]);
  if (!position || !editor?.isEditable) return null;
  const format = currentBlockFormat(editor.state);
  const block = (value: BlockFormat) => editor.chain().focus().command(setBlockFormat(value)).run();
  const isBlock = (kind: BlockFormat['kind'], level?: number) => format?.kind === kind && (kind !== 'heading' || format.kind === 'heading' && format.level === level);
  return createPortal(<div ref={toolbar} role="toolbar" aria-label="选中文本快捷操作" className={styles.toolbar} style={{ left: position.x, top: position.y, maxWidth: position.maxWidth }} onMouseDown={event => { if (!(event.target instanceof HTMLInputElement)) event.preventDefault(); }} onKeyDown={event => { if (event.key === 'Escape') { editor.commands.focus(); setPosition(null); } }}>
    <div className={styles.group}>
      {[1, 2, 3].map(level => <button key={level} type="button" className={styles.tool} aria-label={`标题 H${level}`} title={`标题 H${level}`} aria-pressed={isBlock('heading', level)} onClick={() => block({ kind: 'heading', level })}>H{level}</button>)}
      <button type="button" className={styles.tool} aria-label="引用块" title="引用" aria-pressed={isBlock('blockquote')} onClick={() => block({ kind: 'blockquote' })}><Quotes size={17} weight="fill" /></button>
    </div>
    <div className={styles.group}>
      {([{ kind: 'taskList', label: '任务列表', Icon: ListChecks }, { kind: 'bulletList', label: '无序列表', Icon: ListBullets }, { kind: 'orderedList', label: '有序列表', Icon: ListNumbers }] as const).map(({ kind, label, Icon }) => <button key={kind} type="button" className={styles.tool} aria-label={label} title={label} aria-pressed={isBlock(kind)} onClick={() => block({ kind })}><Icon size={18} /></button>)}
    </div>
    <div className={styles.group}>
      {([{ mark: 'bold', label: '加粗', Icon: TextB }, { mark: 'italic', label: '斜体', Icon: TextItalic }, { mark: 'strike', label: '删除线', Icon: TextStrikethrough }, { mark: 'highlight', label: '高亮', Icon: Highlighter }, { mark: 'code', label: '行内代码', Icon: Code }] as const).map(({ mark, label, Icon }) => <button key={mark} type="button" className={styles.tool} aria-label={label} title={label} aria-pressed={editor.isActive(mark)} disabled={!editor.can().toggleMark(mark)} onClick={() => editor.chain().focus().toggleMark(mark).run()}><Icon size={18} /></button>)}
    </div>
    <div className={styles.group}>
      <SelectionLink editor={editor} onOpenChange={open => { linkOpen.current = open; if (!open) requestAnimationFrame(refresh); }} />
      {canComposeSelectionComment(editor) && <button type="button" className={styles.tool} aria-label="评论选中内容" title="评论" onClick={() => requestSelectionComment(editor, { x: position.x + Math.min(460, position.maxWidth) / 2, y: editor.view.coordsAtPos(editor.state.selection.from).top })}><Chat size={18} /></button>}
    </div>
  </div>, getOverlayRoot() ?? document.body);
}
