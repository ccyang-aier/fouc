'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getOverlayRoot } from '@/lib/overlay-root';
import { useTranslation } from '@/lib/i18n';
import type { TabCloseAction } from './workbench-tabs';
import { messages } from './i18n/navigation-sidebar.messages';
import styles from './workbench-tab-bar.module.css';

export function WorkbenchTabMenu({ point, hasOthers, hasRight, onClose, onAction, onReturnFocus }: {
  point: { x: number; y: number }; hasOthers: boolean; hasRight: boolean;
  onClose: () => void; onAction: (action: TabCloseAction) => void; onReturnFocus: () => void;
}) {
  const { t } = useTranslation(messages);
  const returnFocus = useRef(false);
  function action(value: TabCloseAction) { returnFocus.current = true; onAction(value); }
  return <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose(); }}>
    {createPortal(<DropdownMenuTrigger aria-hidden tabIndex={-1} className={styles.contextAnchor} style={{ left: point.x, top: point.y }} />, getOverlayRoot() ?? document.body)}
    <DropdownMenuContent aria-label={t('页签操作')} density="compact" side="bottom" align="start" sideOffset={0} collisionPadding={8}
      onEscapeKeyDown={() => { returnFocus.current = true; }}
      onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.current) onReturnFocus(); }}>
      <DropdownMenuItem onSelect={() => action('current')}>{t('关闭当前')}</DropdownMenuItem>
      <DropdownMenuItem disabled={!hasOthers} onSelect={() => action('others')}>{t('关闭其他')}</DropdownMenuItem>
      <DropdownMenuItem disabled={!hasRight} onSelect={() => action('right')}>{t('关闭右侧')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => action('all')}>{t('关闭全部')}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
