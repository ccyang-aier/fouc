'use client';

/**
 * The workspace page tree (U02 structure, U03 operations).
 *
 * Roving keyboard model of U02 stays: arrows walk rows, ArrowRight/Left
 * expand/collapse, Home/End jump, Enter/Space activate. U03 adds the operation
 * layer on the same focus: F2/Enter renames the focused page, Delete recycles
 * it, Cmd/Ctrl+N creates a child (a section row creates a root page),
 * Alt+Arrows move through the fractional order — every intent is validated by
 * the pure move controller before anything optimistically changes.
 *
 * Drag & drop mirrors the keyboard semantics: drop zones per row resolve to
 * the same `{ parentId, afterPageId }` placements, the accepted target
 * highlights (line above/below, ring for "inside") and structurally invalid
 * targets (self, own descendant) show no affordance at all. Rows under a
 * pending operation show an inline spinner and refuse further interaction.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CaretRight, CircleNotch, DotsThree, FileText, Folder, Rows, Table } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Page } from '@fouc/shared/knowledge/contracts';
import {
  arrowExpansion,
  flattenNavigationTree,
  stepNavigationFocus,
  type FlatNavigationItem,
  type NavigationSection,
} from './tree-model';
import { operationKeyIntent, treeActionsForRow, type TreeAction } from './tree-actions';
import { dropModeForRow, keyboardMovePlacement, resolveDropPlacement, type DropMode } from './move-controller';
import type { PageTreeOperations } from './page-operations';
import { PageTreeMenu, type TreeMenuState } from './page-menu';
import { RenameInline } from './rename-inline';

const pageKindIcon = { doc: FileText, database: Table, row: Rows } as const;

export type PageTreeHandle = {
  /** Expands the ancestor chain of the page and focuses its row. */
  revealPage: (pageId: string) => void;
  /** Puts the row straight into rename mode (used right after creation). */
  startRename: (pageId: string) => void;
};

export type PageTreeProps = {
  sections: readonly NavigationSection[];
  /** The raw page rows of the workspace — the move math needs more than the flattened nodes. */
  pages: readonly Page[];
  selectedSectionId: string | null;
  selectedPageId: string | null;
  canEdit: boolean;
  operations: PageTreeOperations;
  onSelectSection: (sectionId: string) => void;
  onSelectPage: (pageId: string) => void;
  onCreateChild: (target: { pageId: string | null; sectionId: string }) => void;
  onSectionMenu?: (id: string) => React.ReactNode;
  onEditAppearance: (pageId: string, mode: 'icon' | 'cover') => void;
  className?: string;
};

export const PageTree = forwardRef<PageTreeHandle, PageTreeProps>(function PageTree(
  {
    sections,
    pages,
    selectedSectionId,
    selectedPageId,
    canEdit,
    operations,
    onSelectSection,
    onSelectPage,
    onCreateChild,
    onEditAppearance,
    onSectionMenu,
    className,
  },
  ref,
) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [menu, setMenu] = useState<TreeMenuState>(null);
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ pageId: string; mode: DropMode } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  const items = useMemo(() => flattenNavigationTree(sections, expanded), [sections, expanded]);
  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);

  const focus = focusKey !== null && itemByKey.has(focusKey) ? focusKey : null;

  useEffect(() => {
    if (focus === null) return;
    rowRefs.current.get(focus)?.scrollIntoView({ block: 'nearest' });
  }, [focus]);

  const toggle = useCallback((key: string) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const activate = useCallback(
    (item: FlatNavigationItem) => {
      if (item.pageId === null) onSelectSection(item.sectionId);
      else onSelectPage(item.pageId);
    },
    [onSelectPage, onSelectSection],
  );

  /** Expands every ancestor section/row of the page, then focuses (and optionally renames) it. */
  const revealPage = useCallback(
    (pageId: string, withRename: boolean) => {
      const chain: string[] = [];
      let cursor: string | null = pageId;
      while (cursor !== null) {
        const page = pages.find((row) => row.id === cursor);
        if (!page) break;
        chain.push(page.id);
        cursor = page.parentId;
      }
      const section = pages.find((row) => row.id === pageId)?.teamspaceId;
      setExpanded((current) => {
        const next = { ...current };
        if (section) next[`section:${section}`] = true;
        for (const id of chain.slice(1)) next[`page:${id}`] = true;
        return next;
      });
      const key = `page:${pageId}`;
      setFocusKey(key);
      // Without rename: focus the row on the next paint (it may not exist
      // until the expanded re-render commits). With rename: the inline input
      // takes focus on mount and keeps it — focusing the row here would blur
      // the input and commit the empty draft in the same frame.
      if (!withRename) requestAnimationFrame(() => rowRefs.current.get(key)?.focus());
      if (withRename) setRenamingPageId(pageId);
    },
    [pages],
  );

  useImperativeHandle(ref, () => ({ revealPage: (pageId) => revealPage(pageId, false), startRename: (pageId) => revealPage(pageId, true) }), [revealPage]);

  // ── Keyboard: navigation (U02) + operation intents (U03) ──────────
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Embedded controls own their keys; Enter on a menu/caret must not activate the row.
    if ((event.target as HTMLElement).closest('button, input')) return;
    const current = focus === null ? null : itemByKey.get(focus) ?? null;
    const intent = operationKeyIntent(event.nativeEvent);
    if (intent !== null && current !== null && canEdit && renamingPageId === null) {
      event.preventDefault();
      if (intent.kind === 'rename') {
        if (current.pageId !== null) revealPage(current.pageId, true);
        else activate(current);
      } else if (intent.kind === 'recycle') {
        if (current.pageId !== null) void operations.recyclePage(current.pageId);
      } else if (intent.kind === 'create-child') {
        onCreateChild({ pageId: current.pageId, sectionId: current.sectionId });
      } else {
        if (current.pageId !== null) void operations.movePageByKeyboard(current.pageId, intent.direction);
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const next = stepNavigationFocus(items, focus, event.key === 'ArrowDown' ? 1 : -1);
        if (next !== null) {
          setFocusKey(next);
          rowRefs.current.get(next)?.focus();
        }
        break;
      }
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (!current) break;
        event.preventDefault();
        const action = arrowExpansion(current, event.key === 'ArrowRight' ? 'right' : 'left');
        if (action) toggle(current.key);
        break;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        if (items.length > 0) {
          const next = event.key === 'Home' ? items[0].key : items[items.length - 1].key;
          setFocusKey(next);
          rowRefs.current.get(next)?.focus();
        }
        break;
      }
      case 'Enter':
      case ' ': {
        if (!current) break;
        event.preventDefault();
        activate(current);
        break;
      }
      default:
        break;
    }
  };

  // ── Context menu ──────────────────────────────────────────────────
  const menuActions = useMemo(() => treeActionsForRow(), []);
  const disabledActionIds = useMemo(() => {
    if (menu === null) return new Set<string>();
    const page = pages.find((row) => row.id === menu.pageId);
    if (!page) return new Set<string>();
    const disabled = new Set<string>();
    if (operations.hasPending(page.id)) {
      for (const action of menuActions) disabled.add(action.id);
      return disabled;
    }
    // The pure controller decides exactly which moves the contract can
    // express from this row; the menu mirrors it one-to-one.
    const moveAvailable = (direction: 'up' | 'down' | 'indent' | 'outdent') => keyboardMovePlacement(pages, page.id, direction).ok;
    if (!moveAvailable('up')) disabled.add('move-up');
    if (!moveAvailable('down')) disabled.add('move-down');
    if (!moveAvailable('indent')) disabled.add('indent');
    if (!moveAvailable('outdent')) disabled.add('outdent');
    return disabled;
  }, [menu, menuActions, operations, pages]);

  const runMenuAction = (action: TreeAction) => {
    if (menu === null) return;
    const pageId = menu.pageId;
    switch (action.id) {
      case 'create-child': {
        const teamspaceId = pages.find((row) => row.id === pageId)?.teamspaceId;
        if (teamspaceId) onCreateChild({ pageId, sectionId: teamspaceId });
        break;
      }
      case 'rename':
        revealPage(pageId, true);
        break;
      case 'set-icon':
      case 'set-cover':
        onEditAppearance(pageId, action.id === 'set-icon' ? 'icon' : 'cover');
        break;
      case 'recycle':
        void operations.recyclePage(pageId);
        break;
      case 'move-up':
        void operations.movePageByKeyboard(pageId, 'up');
        break;
      case 'move-down':
        void operations.movePageByKeyboard(pageId, 'down');
        break;
      case 'indent':
        void operations.movePageByKeyboard(pageId, 'indent');
        break;
      case 'outdent':
        void operations.movePageByKeyboard(pageId, 'outdent');
        break;
      default:
        break;
    }
  };

  // ── Drag & drop ───────────────────────────────────────────────────
  const dragOverRow = (event: React.DragEvent, item: FlatNavigationItem) => {
    const targetPageId = item.pageId;
    if (dragPageId === null || targetPageId === null || targetPageId === dragPageId) {
      setDropTarget(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const mode = dropModeForRow(item.expandable, (event.clientY - rect.top) / Math.max(rect.height, 1));
    const resolution = resolveDropPlacement(pages, dragPageId, { pageId: targetPageId, mode });
    if (!resolution.ok) {
      setDropTarget(null);
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((current) => (current?.pageId === targetPageId && current.mode === mode ? current : { pageId: targetPageId, mode }));
  };

  const dropOnRow = (event: React.DragEvent, item: FlatNavigationItem) => {
    const targetPageId = item.pageId;
    if (dragPageId === null || targetPageId === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mode = dropModeForRow(item.expandable, (event.clientY - rect.top) / Math.max(rect.height, 1));
    const resolution = resolveDropPlacement(pages, dragPageId, { pageId: targetPageId, mode });
    setDropTarget(null);
    if (resolution.ok) {
      event.preventDefault();
      void operations.movePage(dragPageId, resolution.placement);
    }
  };

  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);

  return (
    <div
      role="tree"
      aria-label="工作区页面树"
      tabIndex={focus === null ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget && items.length > 0) {
          setFocusKey((current) => (current !== null && current === focus ? current : items[0].key));
        }
      }}
      onDragEnd={() => {
        setDragPageId(null);
        setDropTarget(null);
      }}
      onDragLeave={(event) => {
        if (event.target === event.currentTarget) setDropTarget(null);
      }}
      className={cn('min-w-0 space-y-px outline-none', className)}
    >
      {items.map((item) => {
        const selected = item.pageId === null ? item.sectionId === selectedSectionId : item.pageId === selectedPageId;
        const Icon = item.kind === 'teamspace' ? Folder : pageKindIcon[item.kind];
        const section = item.pageId === null ? sectionById.get(item.sectionId) : undefined;
        const pageIcon = item.pageId === null ? null : pages.find((row) => row.id === item.pageId)?.icon ?? null;
        const pending = item.pageId !== null && operations.hasPending(item.pageId);
        const renaming = item.pageId !== null && renamingPageId === item.pageId;
        const isDropRow = dropTarget !== null && dropTarget.pageId === item.pageId;
        return (
          <div key={item.key}>
            <div className="group/row">
              <div
                ref={(element) => {
                  if (element) rowRefs.current.set(item.key, element);
                  else rowRefs.current.delete(item.key);
                }}
                role="treeitem"
                aria-level={item.depth + 1}
                aria-expanded={item.expandable ? item.expanded : undefined}
                aria-selected={selected}
                aria-disabled={pending || undefined}
                tabIndex={(focus ?? items[0]?.key) === item.key ? 0 : -1}
                onFocus={() => setFocusKey(item.key)}
                draggable={canEdit && item.pageId !== null && !pending && !renaming}
                onClick={() => {
                  setFocusKey(item.key);
                  activate(item);
                }}
                onDoubleClick={() => {
                  if (item.expandable) toggle(item.key);
                }}
                onContextMenu={(event) => {
                  if (item.pageId === null || !canEdit) return;
                  event.preventDefault();
                  setFocusKey(item.key);
                  setMenu({ pageId: item.pageId, x: event.clientX, y: event.clientY });
                }}
                onDragStart={(event) => {
                  if (item.pageId === null) return;
                  setDragPageId(item.pageId);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', item.pageId);
                }}
                onDragOver={(event) => dragOverRow(event, item)}
                onDrop={(event) => dropOnRow(event, item)}
                className={cn(
                  'relative flex h-[30px] w-full items-center rounded-[6px] pr-1.5 text-left text-[12.5px] leading-none outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
                  selected
                    ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-ink)]'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--raise)] hover:text-[var(--ink)]',
                  isDropRow && dropTarget?.mode === 'inside' && !selected && 'bg-[var(--accent-soft)]',
                  isDropRow && dropTarget?.mode === 'inside' && 'ring-1 ring-[var(--accent-soft-line)]',
                  pending && 'opacity-70',
                  dragPageId === item.pageId && 'opacity-40',
                )}
                style={{ paddingLeft: 6 + item.depth * 16 }}
              >
                {isDropRow && dropTarget?.mode === 'before' ? (
                  <span aria-hidden className="absolute inset-x-2 top-0 h-[2px] rounded-full bg-[var(--accent)]" />
                ) : null}
                {isDropRow && dropTarget?.mode === 'after' ? (
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--accent)]" />
                ) : null}
                {pageIcon !== null ? (
                  <span aria-hidden className="mr-2 size-[15px] shrink-0 text-center text-[13px] leading-[15px]">
                    {pageIcon}
                  </span>
                ) : (
                  <Icon
                    aria-hidden
                    size={15}
                    weight={item.kind === 'teamspace' && selected ? 'fill' : 'regular'}
                    className={cn('mr-2 shrink-0', selected ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)]')}
                  />
                )}
                {renaming && item.pageId !== null ? (
                  <RenameInline
                    initialTitle={pages.find((row) => row.id === item.pageId)?.title ?? ''}
                    disabled={pending}
                    onCommit={(title) => void operations.renamePage(item.pageId!, title)}
                    onCancel={() => undefined}
                    onExit={() => {
                      setRenamingPageId(null);
                      rowRefs.current.get(item.key)?.focus();
                    }}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                )}
                {pending ? (
                  <CircleNotch aria-label="正在同步" size={12} className="ml-1 size-3 shrink-0 animate-spin text-[var(--muted)]" />
                ) : item.expandable ? (
                  <button
                    type="button"
                    aria-label={`${item.expanded ? '收起' : '展开'}「${item.title}」`}
                    aria-expanded={item.expanded}
                    onClick={(event) => { event.stopPropagation(); toggle(item.key); }}
                    className={cn(
                      'ml-1 inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] text-[var(--muted)] transition-transform duration-200',
                      item.expanded ? 'rotate-90 opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                    )}
                  >
                    <CaretRight size={10} weight="fill" />
                  </button>
                ) : null}
                {item.pageId === null ? onSectionMenu?.(item.sectionId) : null}
                {item.pageId !== null && canEdit && !renaming ? (
                  <button
                    type="button"
                    aria-label={`打开「${item.title}」的操作菜单`}
                    title="页面操作"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFocusKey(item.key);
                      const rect = event.currentTarget.getBoundingClientRect();
                      setMenu({ pageId: item.pageId!, x: rect.left, y: rect.bottom + 4 });
                    }}
                    className="ml-0.5 flex size-[20px] shrink-0 items-center justify-center rounded-[5px] text-[var(--muted)] opacity-0 outline-none transition-[opacity,background-color,color] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] group-hover/row:opacity-100"
                  >
                    <DotsThree aria-hidden size={14} weight="bold" />
                  </button>
                ) : null}
              </div>
            </div>
            {/* Empty-section guidance: the page read API is wired now, so an
                empty teamspace offers its first page instead of a placeholder. */}
            {section && section.pageCount === 0 ? (
              canEdit ? (
                <button
                  type="button"
                  onClick={() => onCreateChild({ pageId: null, sectionId: section.id })}
                  className="ml-[38px] flex h-[24px] items-center gap-1.5 rounded-[5px] px-1.5 text-[10.5px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
                >
                  暂无页面 · 新建第一个页面
                </button>
              ) : (
                <p className="ml-[38px] py-1 pr-3 text-[10.5px] leading-relaxed text-[var(--muted)]" role="note">
                  暂无页面
                </p>
              )
            ) : null}
          </div>
        );
      })}
      <PageTreeMenu state={menu} actions={menuActions} disabledActionIds={disabledActionIds} onAction={runMenuAction} onClose={() => setMenu(null)} />
    </div>
  );
});
