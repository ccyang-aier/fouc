'use client';

import { TextAlignCenter, TextAlignLeft, TextAlignRight } from '@phosphor-icons/react';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { TABLE_COLORS, setTableAlignment, setTableColor, setTableVariant } from './table-style';
import type { TableAlignment, TableStyleTarget, TableVariant } from './table-style';
import styles from './table.module.css';

type TableCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

const TARGETS: { value: TableStyleTarget; label: string }[] = [
  { value: 'cell', label: '单元格' }, { value: 'row', label: '行' }, { value: 'column', label: '列' }, { value: 'table', label: '整表' },
];
const VARIANTS: { value: TableVariant; label: string }[] = [
  { value: 'plain', label: '经典' }, { value: 'striped', label: '交替色' }, { value: 'minimal', label: '极简' },
];
const ALIGNMENTS = [
  { value: 'left', label: '左对齐', icon: TextAlignLeft },
  { value: 'center', label: '居中', icon: TextAlignCenter },
  { value: 'right', label: '右对齐', icon: TextAlignRight },
] as const;

export function TableStyleMenu({ target, onTargetChange, run, variant, align, above }: {
  target: TableStyleTarget;
  onTargetChange: (target: TableStyleTarget) => void;
  run: (command: TableCommand) => void;
  variant: TableVariant;
  align: TableAlignment | null;
  above: boolean;
}) {
  return (
    <div role="dialog" aria-label="表格样式" className={styles.styleMenu} data-above={String(above)} onMouseDown={(event) => event.preventDefault()}>
      <div className={styles.menuHeading}>应用到</div>
      <div className={styles.segmented} role="group" aria-label="样式范围">
        {TARGETS.map((item) => <button key={item.value} type="button" aria-pressed={target === item.value} onClick={() => onTargetChange(item.value)}>{item.label}</button>)}
      </div>
      <div className={styles.menuHeading}>背景颜色</div>
      <div className={styles.colorGrid} role="group" aria-label="背景颜色">
        {TABLE_COLORS.map((color) => <button key={color.name} type="button" title={color.name} aria-label={color.name} className={styles.colorButton} style={{ background: color.value ?? '#fff' }} onClick={() => run((state, dispatch) => setTableColor(state, dispatch, target, color.value))}>{color.value ? null : <span aria-hidden className={styles.noColor}>／</span>}</button>)}
        <label title="自定义颜色" className={styles.customColor}><span aria-hidden>＋</span><input type="color" aria-label="自定义背景颜色" onChange={(event) => run((state, dispatch) => setTableColor(state, dispatch, target, event.target.value))} /></label>
      </div>
      <div className={styles.menuHeading}>文本对齐</div>
      <div className={styles.segmented} role="group" aria-label="文本对齐">
        {ALIGNMENTS.map((item) => <button key={item.value} type="button" title={item.label} aria-label={item.label} aria-pressed={align === item.value} onClick={() => run((state, dispatch) => setTableAlignment(state, dispatch, target, item.value))}><item.icon aria-hidden size={17} /></button>)}
      </div>
      {target === 'table' ? <><div className={styles.menuHeading}>表格风格</div><div className={styles.segmented} role="group" aria-label="表格风格">{VARIANTS.map((item) => <button key={item.value} type="button" aria-pressed={variant === item.value} onClick={() => run((state, dispatch) => setTableVariant(state, dispatch, item.value))}>{item.label}</button>)}</div></> : null}
    </div>
  );
}
