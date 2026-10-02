'use client';

import styles from './document-outline.module.css';

export function DocumentOutline({ id, headings, activeHeading, onClose, onNavigate }: {
  id: string;
  headings: { pos: number; level: number; title: string }[];
  activeHeading: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const rows: { heading: typeof headings[number]; index: number; ancestors: number[]; hasNext: boolean }[] = [];
  const ancestors: number[] = [];
  const lastChild = new Map<number | undefined, typeof rows[number]>();
  for (const [index, heading] of headings.entries()) {
    while (ancestors.length && headings[ancestors[ancestors.length - 1]].level >= heading.level) ancestors.pop();
    const parent = ancestors[ancestors.length - 1];
    const previous = lastChild.get(parent);
    if (previous) previous.hasNext = true;
    const row = { heading, index, ancestors: [...ancestors], hasNext: false };
    rows.push(row);
    lastChild.set(parent, row);
    ancestors.push(index);
  }
  return <div id={id} className={styles.panel} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  }}>
    {headings.length ? <nav className={styles.chapters} aria-label="文档章节">
      {rows.map(({ heading, index, ancestors: parents, hasNext }) => {
        const depth = parents.length;
        return <button type="button" key={heading.pos} className={styles.chapter} data-root={depth === 0} data-active={index === activeHeading}
            aria-current={index === activeHeading ? 'location' : undefined}
            style={{ paddingInlineStart: `${8 + depth * 16}px` }}
            onClick={() => onNavigate(index)} title={heading.title}>
            {parents.slice(1).map((parent, level) => rows[parent].hasNext && <span key={parent} aria-hidden className={styles.guide} style={{ insetInlineStart: `${12 + level * 16}px` }} />)}
            {depth > 0 && <span aria-hidden className={styles.branch} data-last={!hasNext} style={{ insetInlineStart: `${12 + (depth - 1) * 16}px` }} />}
            <span className={styles.chapterTitle}>{heading.title}</span>
          </button>;
      })}
    </nav> : <div className={styles.empty} role="status"><strong>暂无章节</strong><p>添加正文标题后，即可在这里快速定位。</p></div>}
  </div>;
}
