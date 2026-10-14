'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-tab-strip.messages';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCode, PushPin, X } from '@phosphor-icons/react';
import type { SqlDraftSnapshot, SqlDraftTab, SqlExecutionMode } from '@fouc/shared';
import { getOverlayRoot } from '@/lib/overlay-root';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { sqlTabDirty } from './sql-tabs';
import { navigateWorkbenchTabs } from './workbench-tab-navigation';
import { ArrowsLeftRight, ClockCounterClockwise, FolderOpen } from '@phosphor-icons/react';
import styles from './sql-tabs.module.css';
export type SqlTabAction =
  'pin' | 'rename' | 'duplicate' | 'close' | 'others' | 'left' | 'right' | 'all' | 'reopen';
const dragMime = 'application/x-fouc-sql-tab';
export function SqlTabStrip({
  snapshot,
  scope,
  busyIds,
  canBack,
  canForward,
  canReopen,
  onSelect,
  onNavigate,
  onAction,
  onReorder,
  active,
  disabled,
  mode,
  onModeChange,
  onHistory,
  onLibrary,
  onCompare,
  canLibrary,
  canCompare,
  onMutation,
  canMutate,
}: {
  snapshot: SqlDraftSnapshot;
  scope: string;
  busyIds: ReadonlySet<string>;
  canBack: boolean;
  canForward: boolean;
  canReopen: boolean;
  onSelect: (id: string) => void;
  onNavigate: (direction: -1 | 1) => void;
  onAction: (action: SqlTabAction, tab: SqlDraftTab | null) => void;
  onReorder: (id: string, beforeId: string) => void;
  active: boolean;
  disabled: boolean;
  mode: SqlExecutionMode;
  onModeChange: (mode: SqlExecutionMode) => void;
  onHistory: (id: string) => void;
  onLibrary: (id: string) => void;
  onCompare: () => void;
  canLibrary: boolean;
  canCompare: boolean;
  onMutation: () => void;
  canMutate: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const list = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<{
    tab: SqlDraftTab;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    const reveal = () =>
      list.current
        ?.querySelector('[aria-selected=true]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const resize = new ResizeObserver(reveal);
    if (list.current) resize.observe(list.current);
    reveal();
    return () => resize.disconnect();
  }, [snapshot.activeTabId, active]);
  return (
    <>
      <div
        className={styles.list}
        ref={list}
        onKeyDown={(event) => {
          if (!disabled) navigateWorkbenchTabs(event);
        }}
      >
        {snapshot.tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active && tab.id === snapshot.activeTabId}
            aria-disabled={disabled}
            aria-controls="fouc-sql-query-document"
            aria-haspopup="menu"
            aria-label={`${tab.title}${busyIds.has(tab.id) ? tConnector('queryRunning') : sqlTabDirty(tab) ? tConnector('queryModified') : ''}`}
            data-tab-id={tab.id}
            tabIndex={active && tab.id === snapshot.activeTabId && !disabled ? 0 : -1}
            className={`${styles.tab} ${active && tab.id === snapshot.activeTabId ? styles.active : ''} fouc-action`}
            draggable={!disabled}
            title={`${tab.title} · ${tab.database}${tab.schema ? ` / ${tab.schema}` : ''}`}
            onClick={() => {
              if (!disabled) onSelect(tab.id);
            }}
            onKeyDown={(event) => {
              if (disabled || event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(tab.id);
              }
              if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault();
                onSelect(tab.id);
                const bounds = event.currentTarget.getBoundingClientRect();
                setContext({ tab, x: bounds.left, y: bounds.bottom });
              }
            }}
            onContextMenu={(event) => {
              if (!disabled) {
                event.preventDefault();
                onSelect(tab.id);
                setContext({ tab, x: event.clientX, y: event.clientY });
              }
            }}
            onDragStart={(event) => {
              event.dataTransfer.setData(dragMime, JSON.stringify({ scope, id: tab.id }));
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              if (!disabled && event.dataTransfer.types.includes(dragMime)) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (disabled) return;
              try {
                const data = JSON.parse(event.dataTransfer.getData(dragMime));
                if (data.scope === scope && typeof data.id === 'string') onReorder(data.id, tab.id);
              } catch {
                /* Unrelated drag. */
              }
            }}
          >
            {tab.pinned ? (
              <PushPin size={15} weight="fill" />
            ) : (
              <FileCode size={15} weight="bold" />
            )}
            <span>{tab.title}</span>
            {busyIds.has(tab.id) ? (
              <i className={styles.running} aria-hidden />
            ) : sqlTabDirty(tab) ? (
              <i className={styles.dirty} aria-hidden />
            ) : null}
            <button
              type="button"
              className={`${styles.close} fouc-action`}
              data-variant="nested"
              aria-label={tConnector('close', { p0: String(tab.title) })}
              disabled={disabled || busyIds.has(tab.id)}
              onClick={(event) => {
                event.stopPropagation();
                onAction('close', tab);
              }}
            >
              <X size={13} weight="bold" />
            </button>
          </div>
        ))}
      </div>
      {context && (
        <DropdownMenu
          open
          modal={false}
          onOpenChange={(open) => {
            if (!open) setContext(null);
          }}
        >
          {createPortal(
            <DropdownMenuTrigger
              aria-hidden
              tabIndex={-1}
              className={styles.contextAnchor}
              style={{ left: context.x, top: context.y }}
            />,
            getOverlayRoot() ?? document.body,
          )}
          <DropdownMenuContent
            aria-label={tConnector('sqlTabActions')}
            density="compact"
            side="bottom"
            align="start"
            sideOffset={0}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              list.current
                ?.closest('[role="tablist"]')
                ?.querySelector<HTMLElement>('[aria-selected=true]')
                ?.focus();
            }}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onHistory(context.tab.id)}>
                <ClockCounterClockwise />
                {tConnector('queryHistory')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canLibrary} onSelect={() => onLibrary(context.tab.id)}>
                <FolderOpen />
                {tConnector('sqlLibrary')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canCompare} onSelect={onCompare}>
                <ArrowsLeftRight />
                {tConnector('compareQueryResults')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMutate} onSelect={onMutation}>
                {tConnector('sqlChangePreview')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onAction('pin', context.tab)}>
                {context.tab.pinned ? tConnector('unpinTab') : tConnector('pinTab')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('rename', context.tab)}>
                {tConnector('renameTab')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('duplicate', context.tab)}>
                {tConnector('duplicateAsANewQuery')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={busyIds.has(context.tab.id)}
                onSelect={() => onAction('close', context.tab)}
              >
                {tConnector('closeThisTab')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('others', context.tab)}>
                {tConnector('closeOtherUnpinnedTabs')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('left', context.tab)}>
                {tConnector('closeUnpinnedTabsToTheLeft')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('right', context.tab)}>
                {tConnector('closeUnpinnedTabsToTheRight')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('all', context.tab)}>
                {tConnector('closeAllUnpinnedTabs')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={!canReopen} onSelect={() => onAction('reopen', null)}>
                {tConnector('reopenClosedTab')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canBack} onSelect={() => onNavigate(-1)}>
                {tConnector('previousQueryTab')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canForward} onSelect={() => onNavigate(1)}>
                {tConnector('nextQueryTab')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={mode === 'current'}
                onCheckedChange={() => onModeChange('current')}
              >
                {tConnector('runCurrentStatementByDefault')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={mode === 'all'}
                onCheckedChange={() => onModeChange('all')}
              >
                {tConnector('runAllStatementsByDefault')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
