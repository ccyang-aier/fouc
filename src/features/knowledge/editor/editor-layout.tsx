'use client';

import type { ReactNode } from 'react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { FileText } from '@phosphor-icons/react';
import type { PageUndo } from '../collaboration/page-undo';
import { EditorToolbar } from './components/editor-toolbar';
import styles from './editor-layout.module.css';

export function DocumentEditorFrame({ children }: { children: ReactNode }) {
  return <section aria-label="页面编辑器" className={styles.frame}>{children}</section>;
}

export function DocumentEditorHeader({ editor, pageUndo, editable, title, leading, trailing }: {
  editor: Editor | null;
  pageUndo?: PageUndo;
  editable: boolean;
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return <header className={styles.header}>
    <div className={styles.breadcrumb}>
      {leading}
      <FileText size={20} weight="duotone" aria-hidden className={styles.breadcrumbIcon} />
      <span className={styles.breadcrumbRoot}>文档</span>
      <span aria-hidden className={styles.breadcrumbDivider}>/</span>
      <span className={styles.breadcrumbCurrent} title={title}>{title || '无标题文档'}</span>
    </div>
    <div className={styles.headerActions}>
      <EditorToolbar editor={editor} pageUndo={pageUndo} editable={editable} />
      {trailing}
    </div>
  </header>;
}

export function DocumentHeading({ title, onTitleChange, onTitleCommit, editable = true, metadata }: {
  title: string;
  onTitleChange?: (title: string) => void;
  onTitleCommit?: () => void;
  editable?: boolean;
  metadata?: ReactNode;
}) {
  return <div className={styles.heading}>
    {onTitleChange && editable
      ? <input
          aria-label="文档标题"
          className={styles.titleInput}
          value={title}
          placeholder="无标题文档"
          maxLength={500}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={onTitleCommit}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        />
      : <h1 className={styles.title}>{title || '无标题文档'}</h1>}
    {metadata ? <div className={styles.metadata}>{metadata}</div> : null}
  </div>;
}

export function DocumentEditorBody({ editor, before }: { editor: Editor | null; before?: ReactNode }) {
  return <div className={styles.scrollArea}>
    <div className={styles.document}>{before}<EditorContent editor={editor} /></div>
  </div>;
}
