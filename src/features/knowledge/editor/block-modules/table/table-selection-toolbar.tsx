'use client';
import { useRef, useState, type CSSProperties } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ArrowsInLineHorizontal, ArrowsOutLineHorizontal, ChatText, Code, Link, Palette, TextB, TextHOne, TextHThree, TextHTwo, TextItalic, TextStrikethrough, Triangle } from '@phosphor-icons/react';
import type { Editor } from '@tiptap/core';
import { mergeCells, splitCell } from '@tiptap/pm/tables';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { requestSelectionComment } from '../../../comments/comment-compose-bridge';
import { tableSelectionHasMark, tableSelectionText, setTableSelectionHeading, setTableSelectionLink, toggleTableSelectionMark } from './table-selection-format';
import { setTableColor } from './table-style';
import { TableColorMenuItems } from './table-color-menu-items';
import type { TableCommand } from './table-commands';
import styles from './table.module.css';

function SelectionLink({ editor, tableId, run }: { editor: Editor; tableId: string; run: (command: TableCommand) => void }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState(false);
  return <Menu.Root open={open} modal={false} onOpenChange={next => {
    if (next) {
      let value = '';
      for (const { node } of tableSelectionText(editor.state)) node.descendants(child => { const mark = child.marks.find(mark => mark.type.name === 'link'); if (mark && !value) value = mark.attrs.href; });
      setHref(value); setInvalid(false);
    }
    setOpen(next);
  }}>
    <Menu.Trigger asChild><button type="button" className={styles.toolbarButton} aria-label="设置链接" title="设置链接" data-on={tableSelectionHasMark(editor.state, 'link') || undefined} disabled={!setTableSelectionLink(editor.state, undefined, null)}><Link size={23} weight="bold" aria-hidden /></button></Menu.Trigger>
    <Menu.Portal><Menu.Content className={`${styles.menu} ${styles.linkMenu}`} data-fouc-table-menu={tableId} sideOffset={8} collisionPadding={12} aria-label="选区链接" onCloseAutoFocus={event => event.preventDefault()} onFocusCapture={event => { if (event.target === event.currentTarget) input.current?.focus(); }}>
      <form onSubmit={event => { event.preventDefault(); if (!safeKnowledgeUrl(href, 'link')) { setInvalid(true); return; } run((s, d) => setTableSelectionLink(s, d, href)); setOpen(false); }} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
        <label htmlFor={`table-link-${tableId}`} className={styles.linkLabel}>链接地址</label>
        <input id={`table-link-${tableId}`} ref={input} className={styles.hexInput} value={href} onChange={event => { setHref(event.target.value); setInvalid(false); }} aria-invalid={invalid} placeholder="https://example.com" />
        {invalid ? <p role="alert" className={styles.copyError}>请输入有效的链接地址</p> : null}
        <div className={styles.linkActions}><button type="button" onClick={() => { run((s, d) => setTableSelectionLink(s, d, null)); setOpen(false); }}>移除链接</button><button type="submit">应用</button></div>
      </form>
    </Menu.Content></Menu.Portal>
  </Menu.Root>;
}

export function TableSelectionToolbar({ editor, tableId, run, background, canComment, style }: {
  editor: Editor; tableId: string; run: (command: TableCommand) => void; background: string | null | undefined; canComment: boolean; style: CSSProperties;
}) {
  const blocks = tableSelectionText(editor.state);
  const commentMark = editor.state.schema.marks.comment;
  const canAnchorComment = !!commentMark && blocks.some(({ node }) => node.textContent && node.type.allowsMarkType(commentMark));
  const action = (label: string, Icon: typeof TextB, command: TableCommand, on = false) => <button type="button" className={styles.toolbarButton} aria-label={label} title={label} aria-pressed={on} data-on={on || undefined} disabled={!command(editor.state)} onClick={() => run(command)}><Icon size={23} weight="bold" aria-hidden /></button>;
  const mark = (label: string, Icon: typeof TextB, name: string) => action(label, Icon, (s, d) => toggleTableSelectionMark(s, d, name), tableSelectionHasMark(editor.state, name));
  return <div contentEditable={false} role="toolbar" aria-label="单元格选区格式" className={styles.selectionToolbar} style={style} onMouseDown={event => { if (event.currentTarget.contains(event.target as Node)) event.preventDefault(); }}>
    <div className={styles.toolbarGroup}>{([TextHOne, TextHTwo, TextHThree] as const).map((Icon, index) => <button key={index} type="button" className={styles.toolbarButton} aria-label={`标题 ${index + 1}`} title={`标题 ${index + 1}`} aria-pressed={blocks.length > 0 && blocks.every(({ node }) => node.type.name === 'heading' && node.attrs.level === index + 1)} data-on={blocks.length > 0 && blocks.every(({ node }) => node.type.name === 'heading' && node.attrs.level === index + 1) || undefined} disabled={!setTableSelectionHeading(editor.state, undefined, index + 1)} onClick={() => run((s, d) => setTableSelectionHeading(s, d, index + 1))}><Icon size={23} weight="bold" aria-hidden /></button>)}</div>
    <div className={styles.toolbarGroup}>{action('合并单元格', ArrowsInLineHorizontal, mergeCells)}{action('拆分单元格', ArrowsOutLineHorizontal, splitCell)}</div>
    <div className={styles.toolbarGroup}>
      {mark('加粗', TextB, 'bold')}{mark('斜体', TextItalic, 'italic')}{mark('删除线', TextStrikethrough, 'strike')}
      <Menu.Root modal={false}><Menu.Trigger asChild><button type="button" className={styles.toolbarButton} aria-label="选区背景" title="选区背景"><Palette size={23} weight="fill" aria-hidden /></button></Menu.Trigger><Menu.Portal><Menu.Content data-fouc-table-menu={tableId} className={styles.menu} aria-label="选区背景颜色" sideOffset={8} collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()}><TableColorMenuItems tableId={tableId} background={background} onChange={color => run((s, d) => setTableColor(s, d, 'cell', color))} /></Menu.Content></Menu.Portal></Menu.Root>
      {mark('行内代码', Code, 'code')}
    </div>
    <div className={styles.toolbarGroup}><SelectionLink editor={editor} tableId={tableId} run={run} /><button type="button" className={styles.toolbarButton} aria-label="评论选区" title={canComment ? '评论选区' : '当前文档不支持评论选区'} disabled={!canComment || !canAnchorComment} onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); requestSelectionComment(editor, { x: bounds.left, y: bounds.bottom + 12 }); }}><ChatText size={23} weight="bold" aria-hidden /></button></div>
    <Triangle className={styles.toolbarArrow} size={16} weight="fill" aria-hidden />
  </div>;
}
