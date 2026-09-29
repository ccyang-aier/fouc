'use client';

import { useEffect, useRef, useState } from 'react';
import { Columns, Minus, Plus } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { addColumn, removeLastColumn, setColumnWidths } from './columns-commands';
import styles from './columns.module.css';

const PRESETS: Record<number, { label: string; widths: number[] }[]> = {
  2: [{ label: '等宽', widths: [1, 1] }, { label: '左宽', widths: [2, 1] }, { label: '右宽', widths: [1, 2] }],
  3: [{ label: '等宽', widths: [1, 1, 1] }, { label: '重点在左', widths: [2, 1, 1] }, { label: '重点居中', widths: [1, 2, 1] }],
  4: [{ label: '等宽', widths: [1, 1, 1, 1] }, { label: '重点在左', widths: [2, 1, 1, 1] }],
};

export function ColumnsNodeView({ node, editor, getPos, selected, HTMLAttributes }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const pos = getPos();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!controlsRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const widths = Array.from({ length: node.childCount }, (_, index) => node.child(index).attrs.width as number);

  return (
    <NodeViewWrapper
      as="div" {...HTMLAttributes} data-fouc-node="columns" data-columns="" data-block-id={node.attrs.blockId}
      className={styles.root} data-active={String(selected || hovered || open)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {editor.isEditable ? (
        <div ref={controlsRef} className={styles.controls} contentEditable={false}>
          <button type="button" className={styles.trigger} aria-label="分栏布局" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Columns aria-hidden size={15} /> {node.childCount} 栏</button>
          {open ? <div role="dialog" aria-label="分栏布局" className={styles.menu} onMouseDown={(event) => event.preventDefault()} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
            <div className={styles.menuTitle}>列宽比例</div>
            <div className={styles.presets}>
              {(PRESETS[node.childCount] ?? []).map((preset) => <button key={preset.label} type="button" aria-label={preset.label} aria-pressed={widths.join(':') === preset.widths.join(':')} onClick={() => { if (typeof pos === 'number') setColumnWidths(editor, node, pos, preset.widths); }}>
                <span className={styles.presetPreview}>{preset.widths.map((width, index) => <span key={index} style={{ flex: width }} />)}</span>
                {preset.label}
              </button>)}
            </div>
            <div className={styles.menuDivider} />
            <div className={styles.countRow}>
              <span>栏数 <small>最多 4 栏</small></span>
              <div>
                <button type="button" aria-label="减少一栏并保留内容" disabled={node.childCount <= 2} onClick={() => { if (typeof pos === 'number') removeLastColumn(editor, node, pos); }}><Minus aria-hidden size={14} /></button>
                <strong>{node.childCount}</strong>
                <button type="button" aria-label="增加一栏" disabled={node.childCount >= 4} onClick={() => { if (typeof pos === 'number') addColumn(editor, node, pos); }}><Plus aria-hidden size={14} /></button>
              </div>
            </div>
            <p className={styles.hint}>小屏幕下会自动垂直排列。</p>
          </div> : null}
        </div>
      ) : null}
      <NodeViewContent as="div" className={styles.layout} />
    </NodeViewWrapper>
  );
}
