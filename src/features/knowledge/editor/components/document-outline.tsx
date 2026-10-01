'use client';

import styles from './document-outline.module.css';

export function DocumentOutline({ id, headings, activeHeading, onClose, onNavigate }: {
  id: string;
  headings: { pos: number; level: number; title: string }[];
  activeHeading: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const baseLevel = headings.length ? Math.min(...headings.map(heading => heading.level)) : 1;

  return <div id={id} className={styles.panel} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  }}>
    {headings.length ? <nav className={styles.chapters} aria-label="文档章节">
      {headings.map((heading, index) => <button type="button" key={heading.pos} className={styles.chapter} data-active={index === activeHeading} data-root={heading.level === baseLevel} aria-current={index === activeHeading ? 'location' : undefined} style={{ paddingInlineStart: `${2 + (heading.level - baseLevel) * 14}px` }} onClick={() => onNavigate(index)} title={heading.title}>
        <span className={styles.chapterTitle}>{heading.title}</span>
      </button>)}
    </nav> : <div className={styles.empty} role="status">
      <strong>暂无章节</strong>
      <p>添加正文标题后，<br />即可在这里快速定位。</p>
    </div>}
  </div>;
}
