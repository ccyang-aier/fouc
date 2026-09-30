'use client';
import { useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { CaretRight, Check } from '@phosphor-icons/react';
import { TABLE_COLORS } from './table-style';
import { TableColorPicker } from './table-color-picker';
import styles from './table.module.css';

export function TableColorMenuItems({ tableId, background, onChange }: { tableId: string; background: string | null | undefined; onChange: (color: string | null) => void }) {
  const [offset, setOffset] = useState(-8);
  const place = (element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    const viewport = element.ownerDocument.documentElement.clientWidth;
    const width = Math.min(286, viewport - 24);
    setOffset(viewport - bounds.right - 12 >= width || bounds.left - 12 >= width ? -8 : Math.min(-8, viewport - 12 - width - bounds.right));
  };
  return <>
    {TABLE_COLORS.map(color => <Menu.Item key={color.name} className={styles.menuItem} onSelect={() => onChange(color.value)}><span aria-hidden className={styles.swatch} data-empty={!color.value || undefined} style={{ backgroundColor: color.value ?? undefined }} /><span>{color.name}</span>{background?.toLowerCase() === color.value?.toLowerCase() && background !== undefined ? <Check size={18} weight="bold" className={styles.caret} aria-hidden /> : null}</Menu.Item>)}
    <Menu.Sub>
      <Menu.SubTrigger className={styles.menuItem} onPointerEnter={event => place(event.currentTarget)} onFocus={event => place(event.currentTarget)}><span className={`${styles.swatch} ${styles.customSwatch}`} aria-hidden /><span>Custom</span><CaretRight size={12} weight="fill" className={styles.caret} aria-hidden /></Menu.SubTrigger>
      <Menu.Portal><Menu.SubContent data-fouc-table-menu={tableId} className={`${styles.menu} ${styles.pickerMenu}`} sideOffset={offset} collisionPadding={12} aria-label="自定义背景"><TableColorPicker value={background ?? null} onChange={onChange} /></Menu.SubContent></Menu.Portal>
    </Menu.Sub>
  </>;
}
