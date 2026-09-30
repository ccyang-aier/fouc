'use client';

import type { CSSProperties, ReactNode } from 'react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import styles from './editor-layout.module.css';
import { DocumentAppearanceProvider, useDocumentAppearance } from './components/document-appearance';
import { documentFonts, documentSizes, documentParagraphSpacings } from '@/lib/editor-appearance-options';
import { useEditorBackgrounds } from '@/lib/editor-appearance';
import './document-fonts.css';

export function DocumentEditorFrame({ children, appearanceScope }: { children: ReactNode; appearanceScope: string }) {
  return <DocumentAppearanceProvider key={appearanceScope} scope={appearanceScope}><EditorSurface>{children}</EditorSurface></DocumentAppearanceProvider>;
}

function EditorSurface({ children }: { children: ReactNode }) {
  const { appearance } = useDocumentAppearance();
  const { backgrounds } = useEditorBackgrounds();
  const background = backgrounds.find(item => item.id === appearance.background);
  return <section aria-label="页面编辑器" className={styles.frame} style={{ backgroundColor: background?.color ?? '#fff', backgroundImage: background?.image ? `url("${background.image}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>{children}</section>;
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
  const { appearance } = useDocumentAppearance();
  const font = documentFonts.find(({ id }) => id === appearance.font)!;
  const size = documentSizes.find(({ id }) => id === appearance.size)!;
  const spacing = documentParagraphSpacings.find(({ id }) => id === appearance.paragraphSpacing)!;
  return <div className={styles.scrollArea}>
    <div className={styles.document} data-width={appearance.width} data-font={appearance.font} data-size={appearance.size} style={{ '--document-width': `${appearance.width}%`, '--document-font': font.family, '--document-size': `${size.pixels}px`, '--document-line-height': appearance.lineHeight, '--document-paragraph-gap': `${spacing.pixels}px` } as CSSProperties}>{before}<EditorContent editor={editor} /></div>
  </div>;
}
