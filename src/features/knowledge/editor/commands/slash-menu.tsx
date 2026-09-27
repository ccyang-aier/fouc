'use client';

/**
 * The '/' floating menu (E06): a thin React view over the `foucSlashMenu`
 * plugin state. Every behavior decision — open/close, query, keyboard
 * highlight, running an item — lives in the plugin; this layer only positions
 * and renders. The menu portals to the overlay root, never takes focus
 * (keyboard stays in the editor), follows the caret of the '/query' trigger,
 * and groups the registry-generated items with Chinese section labels.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { Editor } from '@tiptap/react';
import { getOverlayRoot } from '@/lib/overlay-root';
import { cn } from '@/lib/utils';
import { filterSlashItems } from './slash-items';
import type { SlashGroup, SlashMenuItem } from './slash-items';
import { closeSlashMenu, runSlashItem, setActiveSlashItem, slashItemsOfEditor, slashMenuPluginKey } from './slash-paste';

const GROUP_LABELS: Record<SlashGroup, string> = {
  text: '文本',
  layout: '布局',
  media: '媒体',
  knowledge: '知识',
  ai: 'AI',
};

const MENU_WIDTH = 280;
const MENU_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

interface OpenMenuState {
  range: { from: number; to: number };
  query: string;
  active: number;
}

export function SlashMenuLayer({ editor }: { editor: Editor | null }) {
  // Keyed by editor: a stale editor's menu never renders after a scope switch
  // (derived, not reset in an effect).
  const [menuState, setMenuState] = useState<{ editor: Editor | null; menu: OpenMenuState | null }>({ editor: null, menu: null });
  const menu = menuState.editor === editor ? menuState.menu : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const pointerInsideRef = useRef(false);

  // The plugin state is the single source; every editor transaction re-reads it.
  useLayoutEffect(() => {
    if (!editor) return undefined;
    const read = () => {
      const state = slashMenuPluginKey.getState(editor.state);
      setMenuState({
        editor,
        menu: state?.open && state.range ? { range: state.range, query: state.query, active: state.active } : null,
      });
    };
    read();
    editor.on('transaction', read);
    return () => {
      editor.off('transaction', read);
    };
  }, [editor]);

  // Blur closes the menu — unless the pointer is choosing inside it.
  useEffect(() => {
    if (!editor || !menu) return undefined;
    const onBlur = () => {
      if (!pointerInsideRef.current) closeSlashMenu(editor.view);
    };
    editor.on('blur', onBlur);
    return () => {
      editor.off('blur', onBlur);
    };
  }, [editor, menu]);

  const items = useMemo(() => (editor ? slashItemsOfEditor(editor) : []), [editor]);
  const filtered = useMemo(() => filterSlashItems(items, menu?.query ?? ''), [items, menu?.query]);
  const activeIndex = Math.min(menu?.active ?? 0, filtered.length - 1);
  const activeItem = activeIndex >= 0 ? filtered[activeIndex] : null;

  // Group the filtered items by first appearance (registry display order).
  const sections = useMemo(() => {
    const grouped = new Map<SlashGroup, SlashMenuItem[]>();
    for (const item of filtered) {
      const list = grouped.get(item.group);
      if (list) list.push(item);
      else grouped.set(item.group, [item]);
    }
    return [...grouped.entries()];
  }, [filtered]);

  // Position at the caret (viewport coords), clamped and flipped above when
  // near the bottom. The panel renders hidden first; measuring then revealing
  // is imperative because React never re-manages this style after mount.
  useLayoutEffect(() => {
    if (!editor || !menu) return;
    const panel = panelRef.current;
    if (!panel) return;
    let coords: { left: number; top: number; bottom: number };
    try {
      coords = editor.view.coordsAtPos(menu.range.from);
    } catch {
      closeSlashMenu(editor.view);
      return;
    }
    const height = Math.min(panel.offsetHeight, MENU_MAX_HEIGHT);
    const left = Math.min(Math.max(VIEWPORT_MARGIN, coords.left), Math.max(VIEWPORT_MARGIN, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));
    const below = coords.bottom + 6;
    const top = below + height + VIEWPORT_MARGIN > window.innerHeight
      ? Math.max(VIEWPORT_MARGIN, coords.top - height - 6)
      : below;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = 'visible';
  }, [editor, menu]);

  // Keep the highlighted item inside the scroll viewport.
  useEffect(() => {
    if (!menu) return;
    panelRef.current?.querySelector('[data-slash-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [menu, activeItem]);

  // The editor's contenteditable owns the menu semantics for screen readers.
  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.view.dom;
    if (menu && activeItem) dom.setAttribute('aria-activedescendant', `fouc-slash-item-${activeItem.name}`);
    else dom.removeAttribute('aria-activedescendant');
    return () => dom.removeAttribute('aria-activedescendant');
  }, [editor, menu, activeItem]);

  if (!editor || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {menu ? (
        <motion.div
          ref={panelRef}
          role="menu"
          aria-label="插入块"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          style={{ visibility: 'hidden', width: MENU_WIDTH }}
          onMouseEnter={() => { pointerInsideRef.current = true; }}
          onMouseLeave={() => { pointerInsideRef.current = false; }}
          className="fixed z-50 max-h-[320px] overflow-y-auto rounded-[10px] border border-[var(--line)] bg-[var(--panel)] p-1 shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
        >
          {filtered.length === 0 ? (
            <p className="flex h-16 items-center justify-center text-[12px] text-[var(--muted)]">无匹配的块</p>
          ) : sections.map(([group, groupItems]) => (
            <div key={group}>
              <p aria-hidden className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium tracking-[0.04em] text-[var(--muted)]">
                {GROUP_LABELS[group]}
              </p>
              {groupItems.map((item) => {
                const active = item === activeItem;
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    id={`fouc-slash-item-${item.name}`}
                    type="button"
                    role="menuitem"
                    data-slash-active={active || undefined}
                    // mousedown would drag focus out of the editor; the click still lands.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSlashItem(editor.view, filtered.indexOf(item))}
                    onClick={() => runSlashItem(editor.view, item)}
                    className={cn(
                      'relative flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] outline-none transition-colors',
                      active ? 'bg-[var(--accent-soft)] text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:bg-[var(--raise)]',
                    )}
                  >
                    {active ? <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-[var(--accent)]" /> : null}
                    {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-[var(--muted-strong)]" /> : null}
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {item.keywords.length ? (
                      <span aria-hidden className="max-w-[96px] shrink-0 truncate text-[10.5px] text-[var(--muted)]">
                        {item.keywords.join(' ')}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    getOverlayRoot() ?? document.body,
  );
}
