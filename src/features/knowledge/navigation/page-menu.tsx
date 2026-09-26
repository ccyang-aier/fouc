'use client';

/**
 * The row context menu of the page tree (U03): opens at the pointer (right
 * click) or below the row's "…" button, portals into the shared overlay root
 * and behaves like a menu — Escape and outside pointer-down close it, arrows
 * walk the items, the trigger row keeps its roving focus after close.
 *
 * Deliberately hand-rolled: the workspace owns no Radix context-menu
 * primitive, and this menu needs pointer-anchored placement only in this one
 * tree, so a focused ~100 lines beat a new dependency.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowBendUpLeft,
  ArrowFatLineDown,
  ArrowFatLineUp,
  ArrowFatLinesRight,
  Image as ImageIcon,
  PencilSimple,
  Plus,
  Smiley,
  Trash,
} from '@phosphor-icons/react';
import { getOverlayRoot } from '@/lib/overlay-root';
import { cn } from '@/lib/utils';
import type { TreeAction } from './tree-actions';

const actionIcons: Record<TreeAction['id'], ReactNode> = {
  'create-child': <Plus aria-hidden className="size-3.5" />,
  rename: <PencilSimple aria-hidden className="size-3.5" />,
  'set-icon': <Smiley aria-hidden className="size-3.5" />,
  'set-cover': <ImageIcon aria-hidden className="size-3.5" />,
  'move-up': <ArrowFatLineUp aria-hidden className="size-3.5" />,
  'move-down': <ArrowFatLineDown aria-hidden className="size-3.5" />,
  indent: <ArrowFatLinesRight aria-hidden className="size-3.5" />,
  outdent: <ArrowBendUpLeft aria-hidden className="size-3.5" />,
  recycle: <Trash aria-hidden className="size-3.5" />,
  restore: <ArrowFatLineUp aria-hidden className="size-3.5" />,
};

export type TreeMenuState = { pageId: string; x: number; y: number } | null;

export function PageTreeMenu({
  state,
  actions,
  disabledActionIds,
  onAction,
  onClose,
}: {
  state: TreeMenuState;
  actions: readonly TreeAction[];
  disabledActionIds?: ReadonlySet<string>;
  onAction: (action: TreeAction) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Measured placement is a DOM synchronization, done imperatively: the menu
  // mounts invisibly at the pointer, the layout effect clamps it inside the
  // viewport and reveals it — no state, no second render.
  useLayoutEffect(() => {
    if (state === null) return;
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const left = Math.min(Math.max(8, state.x), window.innerWidth - rect.width - 8);
    const top = Math.min(Math.max(8, state.y), Math.max(8, window.innerHeight - rect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [state]);

  useEffect(() => {
    if (state === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
      if (items.length === 0) return;
      const index = items.findIndex((item) => item === document.activeElement);
      const next = event.key === 'ArrowDown' ? items[(index + 1 + items.length) % items.length] : items[(index - 1 + items.length) % items.length];
      next.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose, state]);

  if (state === null) return null;
  // The shell registers its panel root; plain web pages fall back to body.
  const overlayRoot = getOverlayRoot() ?? document.body;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="页面操作"
      style={{ left: state.x, top: state.y, visibility: 'hidden' }}
      className="overlay-surface fixed z-50 min-w-44 rounded-[7px] border bg-elevated p-1 text-[12px] text-[var(--ink)] shadow-[0_10px_32px_rgba(28,33,42,0.16)]"
    >
      {actions.map((action) => {
        const disabled = disabledActionIds?.has(action.id) ?? false;
        return (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            disabled={disabled}
            title={disabled ? disabledReasonFor(action.id) : undefined}
            onClick={() => {
              if (disabled) return;
              onAction(action);
              onClose();
            }}
            className={cn(
              'flex h-[30px] w-full items-center gap-2.5 rounded-[5px] px-2.5 text-left outline-none transition-colors',
              'focus:bg-wash disabled:pointer-events-none disabled:opacity-45',
              action.danger && !disabled && 'text-[var(--err-ink)]',
            )}
          >
            <span className="flex size-3.5 items-center justify-center text-[var(--muted)]">{actionIcons[action.id]}</span>
            <span className="min-w-0 flex-1">{action.label}</span>
          </button>
        );
      })}
    </div>,
    overlayRoot,
  );
}

function disabledReasonFor(actionId: string): string {
  if (actionId === 'create-child') return '该页面正在同步，稍后再新建子页面';
  if (actionId === 'indent' || actionId === 'move-up') return '当前结构下该移动不可用';
  if (actionId === 'outdent') return '已经是顶级页面';
  if (actionId === 'move-down') return '已经是最后一位';
  return '该操作暂不可用';
}
