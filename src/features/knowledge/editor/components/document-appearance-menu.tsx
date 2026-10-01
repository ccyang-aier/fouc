'use client';

import { useState, type KeyboardEvent } from 'react';
import { SlidersHorizontal } from '@phosphor-icons/react';
import { AppearanceSelect, AppearanceSizeControl, AppearanceWidthControl } from '@/components/editor-appearance-controls';
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { documentFonts, documentCodeFonts, documentLineHeights, documentParagraphSpacings } from '@/lib/editor-appearance-options';
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

export function DocumentAppearanceMenu({ triggerClassName }: { triggerClassName: string }) {
  const { appearance, update } = useDocumentAppearance();
  const [open, setOpen] = useState(false);
  return <DropdownMenuSub open={open} onOpenChange={setOpen}>
    <DropdownMenuSubTrigger className={triggerClassName} onClick={event => { if (open) { event.preventDefault(); setOpen(false); } }}><SlidersHorizontal aria-hidden />个性化</DropdownMenuSubTrigger>
    <DropdownMenuSubContent className={styles.panel} onKeyDownCapture={navigateControls} aria-label="个性化"
      onFocusOutside={event => { if ((event.target as Element)?.closest('[data-editor-appearance-dropdown]')) event.preventDefault(); }}
      onInteractOutside={event => { if ((event.target as Element)?.closest('[data-editor-appearance-dropdown]')) event.preventDefault(); }}>
      <div className={styles.header} data-menu-reveal><h2 className={styles.heading}>个性化</h2></div>
      <div className={styles.controls}>
        <AppearanceWidthControl value={appearance.width} onChange={width => update({ width })} />
        <AppearanceSelect label="字体" value={appearance.font} options={documentFonts} onChange={font => update({ font })} />
        <AppearanceSizeControl value={appearance.size} onChange={size => update({ size })} />
        <AppearanceSelect label="代码字体" value={appearance.codeFont} options={documentCodeFonts} onChange={codeFont => update({ codeFont })} />
        <AppearanceSelect label="行距" value={appearance.lineHeight} options={documentLineHeights.map(id => ({ id, label: `${id} 倍` }))} onChange={lineHeight => update({ lineHeight })} />
        <AppearanceSelect label="段落间距" value={appearance.paragraphSpacing} options={documentParagraphSpacings} onChange={paragraphSpacing => update({ paragraphSpacing })} />
      </div>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
