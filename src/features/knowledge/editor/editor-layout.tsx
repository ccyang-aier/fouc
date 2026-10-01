'use client';

import type { CSSProperties, ReactNode } from 'react';
import { EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import styles from './editor-layout.module.css';
import { DocumentAppearanceProvider, useDocumentAppearance } from './components/document-appearance';
import { documentFonts, documentCodeFonts, documentSizes, documentParagraphSpacings } from '@/lib/editor-appearance-options';
import './document-fonts.css';
import './code-fonts.css';
import { DocumentNavigationTools } from './document-tools';
import type { DocumentLinkTarget } from './document-link';

export function DocumentEditorFrame({ children, header, sidebar, navigation, appearanceScope }: {
  children: ReactNode;
  header: ReactNode;
  sidebar?: ReactNode;
  navigation: { editor: Editor | null; title: string; target: DocumentLinkTarget };
  appearanceScope: string;
}) {
  return <DocumentAppearanceProvider key={appearanceScope} scope={appearanceScope}><section aria-label="页面编辑器" className={styles.frame}><DocumentNavigationTools {...navigation} header={header} sidebar={sidebar}>{children}</DocumentNavigationTools></section></DocumentAppearanceProvider>;
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
  const codeFont = documentCodeFonts.find(({ id }) => id === appearance.codeFont)!;
  const size = documentSizes.find(({ id }) => id === appearance.size)!;
  const spacing = documentParagraphSpacings.find(({ id }) => id === appearance.paragraphSpacing)!;
  return <div className={styles.scrollArea} data-document-scroll>
    <div className={styles.document} data-width={appearance.width} data-font={appearance.font} data-size={appearance.size} style={{ '--document-width': `${appearance.width}%`, '--document-font': font.family, '--document-code-font': codeFont.family, '--document-size': `${size.pixels}px`, '--document-line-height': appearance.lineHeight, '--document-paragraph-gap': `${spacing.pixels}px` } as CSSProperties}>{before}<EditorContent editor={editor} /></div>
  </div>;
}
