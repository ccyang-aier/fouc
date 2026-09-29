'use client';

import type { ReactNode } from 'react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import styles from './editor-layout.module.css';

export function DocumentEditorFrame({ children }: { children: ReactNode }) {
  return <section aria-label="页面编辑器" className={styles.frame}>{children}</section>;
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
