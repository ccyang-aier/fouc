'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLineRight, Tabs, X, XSquare, type Icon } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getOverlayRoot } from '@/lib/overlay-root';
import { useTranslation } from '@/lib/i18n';
import type { TabCloseAction } from './workbench-tabs';
import { messages } from './i18n/navigation-sidebar.messages';
import styles from './workbench-tab-bar.module.css';

export function WorkbenchTabMenu({ point, title, icon: PageIcon, otherCount, rightCount, onClose, onAction, onReturnFocus }: {
  point: { x: number; y: number }; title: string; icon: Icon; otherCount: number; rightCount: number;
  onClose: () => void; onAction: (action: TabCloseAction) => void; onReturnFocus: () => void;
}) {
  const { t } = useTranslation(messages);
  const returnFocus = useRef(false);
  function action(value: TabCloseAction) { returnFocus.current = true; onAction(value); }
  return <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose(); }}>
    {createPortal(<DropdownMenuTrigger aria-hidden tabIndex={-1} className={styles.contextAnchor} style={{ left: point.x, top: point.y }} />, getOverlayRoot() ?? document.body)}
    <DropdownMenuContent aria-label={t('页签操作')} className={styles.menu} side="bottom" align="start" sideOffset={4} collisionPadding={8}
      onEscapeKeyDown={() => { returnFocus.current = true; }}
      onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.current) onReturnFocus(); }}>
      <div className={styles.menuHeading}><span className={styles.menuBadge}><PageIcon size={16} weight="duotone" aria-hidden /></span><span className={styles.menuTitle}>{title}</span></div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => action('current')}><X aria-hidden />{t('关闭当前')}</DropdownMenuItem>
      <DropdownMenuItem disabled={otherCount === 0} onSelect={() => action('others')}><Tabs weight="duotone" aria-hidden />{t('关闭其他')}<span aria-hidden className={styles.menuCount}>{otherCount}</span></DropdownMenuItem>
      <DropdownMenuItem disabled={rightCount === 0} onSelect={() => action('right')}><ArrowLineRight aria-hidden />{t('关闭右侧')}<span aria-hidden className={styles.menuCount}>{rightCount}</span></DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => action('all')}><XSquare weight="duotone" aria-hidden />{t('关闭全部')}<span aria-hidden className={styles.menuCount}>{otherCount + 1}</span></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
