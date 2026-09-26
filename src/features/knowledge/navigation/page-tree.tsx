'use client';

/**
 * The workspace page tree (U02 skeleton; U03 completes page operations).
 * Teamspaces render as selectable section rows, their pages nest below in
 * fractional-index order. The whole row set is keyboard-operable as a WAI-ARIA
 * tree: roving focus with the arrow keys, ArrowRight/Left expand and collapse,
 * Enter or Space activates the focused row. Sections without pages yet show an
 * honest hint instead of fabricated entries — the page read API arrives with
 * the API tasks, and this component already renders whatever it is given.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretRight, FileText, Rows, Stack, Table } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
  arrowExpansion,
  flattenNavigationTree,
  stepNavigationFocus,
  type FlatNavigationItem,
  type NavigationSection,
} from './tree-model';

const pageKindIcon = { doc: FileText, database: Table, row: Rows } as const;

export function PageTree({
  sections,
  selectedSectionId,
  selectedPageId,
  onSelectSection,
  className,
}: {
  sections: readonly NavigationSection[];
  selectedSectionId: string | null;
  selectedPageId: string | null;
  onSelectSection: (sectionId: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const items = useMemo(() => flattenNavigationTree(sections, expanded), [sections, expanded]);

  // Derived focus: a stored focus key that no longer exists (the data changed)
  // reads as "no focus" without an extra state-writing render. `expanded`
  // entries for vanished rows are ignored by the flattening, so they never
  // need pruning.
  const focus = focusKey !== null && items.some((item) => item.key === focusKey) ? focusKey : null;

  useEffect(() => {
    if (focus === null) return;
    rowRefs.current.get(focus)?.scrollIntoView({ block: 'nearest' });
  }, [focus]);

  const activate = useCallback(
    (item: FlatNavigationItem) => {
      if (item.pageId === null) onSelectSection(item.sectionId);
    },
    [onSelectSection],
  );

  const toggle = useCallback((key: string) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = focus === null ? null : items.find((item) => item.key === focus) ?? null;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const next = stepNavigationFocus(items, focus, event.key === 'ArrowDown' ? 1 : -1);
        if (next !== null) {
          setFocusKey(next);
          // Roving focus must follow the arrow keys, not just the tabindex.
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

  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);

  return (
    <div
      role="tree"
      aria-label="工作区页面树"
      tabIndex={focus === null ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        // Only a focus landing on the container itself (no row focused yet)
        // enters the tree at the first row; focus arriving on a row keeps the
        // roving state written by its own handlers.
        if (event.target === event.currentTarget && items.length > 0) {
          setFocusKey((current) => (current !== null && current === focus ? current : items[0].key));
        }
      }}
      className={cn('min-w-0 space-y-px outline-none', className)}
    >
      {items.map((item) => {
        const selected = item.pageId === null ? item.sectionId === selectedSectionId : item.pageId === selectedPageId;
        const Icon = item.kind === 'teamspace' ? Stack : pageKindIcon[item.kind];
        const section = item.pageId === null ? sectionById.get(item.sectionId) : undefined;
        return (
          <div key={item.key}>
            <div className="group/row">
              <button
                ref={(element) => {
                  if (element) rowRefs.current.set(item.key, element);
                  else rowRefs.current.delete(item.key);
                }}
                type="button"
                role="treeitem"
                aria-level={item.depth + 1}
                aria-expanded={item.expandable ? item.expanded : undefined}
                aria-selected={selected}
                tabIndex={focus === item.key ? 0 : -1}
                onClick={() => {
                  setFocusKey(item.key);
                  activate(item);
                }}
                onDoubleClick={() => {
                  if (item.expandable) toggle(item.key);
                }}
                className={cn(
                  'flex h-[30px] w-full items-center rounded-[6px] pr-1.5 text-left text-[12.5px] leading-none outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]',
                  selected
                    ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-ink)]'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--raise)] hover:text-[var(--ink)]',
                )}
                style={{ paddingLeft: 6 + item.depth * 16 }}
              >
                <Icon
                  aria-hidden
                  size={15}
                  weight={item.kind === 'teamspace' && selected ? 'fill' : 'regular'}
                  className={cn('mr-2 shrink-0', selected ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)]')}
                />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.expandable ? (
                  <span
                    aria-hidden
                    className={cn(
                      'ml-1 inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] text-[var(--muted)] transition-transform duration-200',
                      item.expanded ? 'rotate-90 opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                    )}
                  >
                    <CaretRight size={10} weight="fill" />
                  </span>
                ) : null}
              </button>
            </div>
            {/* Honest skeleton copy: a section renders its real directory as soon
                as the page read API exists; until then it says so instead of
                showing fabricated entries. */}
            {section && section.pageCount === 0 ? (
              <p className="py-1 pl-[38px] pr-3 text-[10.5px] leading-relaxed text-[var(--muted)]" role="note">
                页面目录尚未接入
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
