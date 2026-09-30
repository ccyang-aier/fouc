'use client';

import type { KeyboardEvent } from 'react';
import { ArrowRight, GearSix, SlidersHorizontal } from '@phosphor-icons/react';
import { AppearanceSelect, AppearanceSizeControl, AppearanceWidthControl } from '@/components/editor-appearance-controls';
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { documentFonts } from '@/lib/editor-appearance-options';
import { useDocumentAppearance } from './document-appearance';
import styles from './document-appearance-menu.module.css';

function navigateControls(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab' || (event.target as Element).closest('[data-editor-appearance-dropdown]')) return;
  event.preventDefault();
  event.stopPropagation();
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input, button:not(:disabled)'));
  const index = controls.indexOf(document.activeElement as HTMLElement);
  controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
}

export function DocumentAppearanceMenu({ triggerClassName, onOpenSettings }: { triggerClassName: string; onOpenSettings: () => void }) {
  const { appearance, update } = useDocumentAppearance();
  return <DropdownMenuSub>
    <DropdownMenuSubTrigger className={triggerClassName}><SlidersHorizontal aria-hidden />个性化</DropdownMenuSubTrigger>
    <DropdownMenuSubContent className={styles.panel} onKeyDownCapture={navigateControls} aria-label="个性化"
      onFocusOutside={event => event.preventDefault()}
      onInteractOutside={event => { if ((event.target as Element)?.closest('[data-editor-appearance-dropdown]')) event.preventDefault(); }}>
      <h2 className={styles.heading}>个性化</h2>
      <div className={styles.controls}>
        <AppearanceWidthControl value={appearance.width} onChange={width => update({ width })} />
        <AppearanceSelect label="字体" value={appearance.font} options={documentFonts} onChange={font => update({ font })} />
        <AppearanceSizeControl value={appearance.size} onChange={size => update({ size })} />
      </div>
      <button type="button" className={styles.settings} onClick={onOpenSettings}><GearSix size={19} aria-hidden /><span>更多编辑器设置</span><ArrowRight size={17} aria-hidden /></button>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
