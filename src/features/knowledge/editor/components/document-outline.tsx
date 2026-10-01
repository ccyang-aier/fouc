'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { ListDashes, X } from '@phosphor-icons/react';
import styles from './document-outline.module.css';

export function DocumentOutline({ id, title, headings, activeHeading, trigger, onClose, onNavigate }: {
  id: string;
  title: string;
  headings: { pos: number; level: number; title: string }[];
  activeHeading: number;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const baseLevel = Math.min(...headings.map(heading => heading.level));

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [onClose, trigger]);

  return <aside ref={panel} id={id} className={`${styles.panel} menu-surface`} aria-label="文档目录">
    <header className={styles.header}>
      <div><strong>文档目录</strong><span className={styles.count}>{headings.length} 个章节</span></div>
      <button type="button" className={styles.close} aria-label="关闭目录" onClick={() => { onClose(); trigger.current?.focus(); }}><X aria-hidden size={16} /></button>
    </header>
    <p className={styles.documentTitle} title={title}>{title || '无标题文档'}</p>
    {headings.length ? <>
      <nav className={styles.chapters} aria-label="文档章节">
        {headings.map((heading, index) => <button type="button" key={heading.pos} className={styles.chapter} data-active={index === activeHeading} data-root={heading.level === baseLevel} aria-current={index === activeHeading ? 'location' : undefined} style={{ paddingInlineStart: `${12 + (heading.level - baseLevel) * 16}px` }} onClick={() => onNavigate(index)} title={heading.title}>
          <span className={styles.marker} aria-hidden />
          <span className={styles.chapterTitle}>{heading.title}</span>
        </button>)}
      </nav>
      <footer className={styles.footer}>点击章节，跳转到对应位置</footer>
    </> : <div className={styles.empty}>
      <ListDashes aria-hidden size={28} weight="light" />
      <strong>暂无章节标题</strong>
      <p>在正文中添加 H1–H4 标题，<br />即可生成文档目录。</p>
    </div>}
  </aside>;
}
