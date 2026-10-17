'use client';
import { uiText } from './i18n/ui-message';

import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connectors-canvas.messages';
/** 连接器目录：使用与社区一致的浏览结构，专注单类系统资源。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CaretDown, CaretUp, MagnifyingGlass, PlugsConnected } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { ViewSwitcher, type ViewMode } from '@/components/ui/view-switcher';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ConnectorCard, ConnectorRow } from './connector-catalog-items';
import { ConnectorDetail } from './connector-detail';
import {
  CONNECTOR_CATEGORIES,
  connectorCategoryLabel,
  connectorPresentation,
  initialConnectors,
} from './connectors-data';
import { clearDtsAuthProfile, dtsConnectorApi } from './dts/api';
type ConnectorSort = 'default' | 'recent' | 'name';
const SORT_OPTIONS = (
  locale?: Locale,
): ReadonlyArray<{
  id: ConnectorSort;
  label: string;
}> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { id: 'default', label: tConnector('defaultOrder') },
    { id: 'recent', label: tConnector('recentlyUpdated') },
    { id: 'name', label: tConnector('sortByName') },
  ];
};
export function ConnectorsCanvas({
  onWorkbenchFocus,
  onOpenProject,
}: {
  onWorkbenchFocus?: () => void;
  onOpenProject: (id: string) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [connectors, setConnectors] = useState(initialConnectors);
  const [category, setCategory] = useState<(typeof CONNECTOR_CATEGORIES)[number]>('全部');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<ConnectorSort>('default');
  const [updatedSortDirection, setUpdatedSortDirection] = useState<'asc' | 'desc'>('desc');
  const [detailId, setDetailId] = useState<string | null>(null);
  const { notify } = useAppAlert();
  const catalogScrollTop = useRef(0);
  const restoreCatalogScroll = useCallback((element: HTMLDivElement | null) => {
    if (element) element.scrollTop = catalogScrollTop.current;
  }, []);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const syncDts = () =>
      void dtsConnectorApi
        .detail()
        .then((detail) => {
          if (disposed) return;
          setConnectors((list) =>
            list.map((item) =>
              item.id === 'connector-dts'
                ? { ...item, connected: detail.instance.authState === 'valid' }
                : item,
            ),
          );
        })
        .catch(() => undefined);
    syncDts();
    void import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        unlisten = await listen('connector://auth-completed', syncDts);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  const connectedCount = connectors.filter((connector) => connector.connected).length;
  function setConnected(id: string, connected: boolean) {
    const item = connectors.find((connector) => connector.id === id);
    if (!item || item.connected === connected) return;
    setConnectors((list) =>
      list.map((connector) => (connector.id === id ? { ...connector, connected } : connector)),
    );
    notify(
      'success',
      connected
        ? tConnector('isConnectedAndAvailableToTasks', { p0: String(item.name) })
        : tConnector('disconnected', { p0: String(item.name) }),
    );
  }
  function connectConnector(id: string) {
    if (
      [
        'connector-dts',
        'connector-mysql',
        'connector-postgres',
        'connector-sqlite',
        'connector-redis',
        'connector-mongodb',
      ].includes(id)
    ) {
      setDetailId(id);
      return;
    }
    setConnected(id, true);
  }
  async function disconnectConnector(id: string) {
    if (id !== 'connector-dts') {
      setConnected(id, false);
      return;
    }
    if (
      !window.confirm(
        tConnector('disconnectingDtsClearsTheLocalConnectionSessionAndDedicatedLogin'),
      )
    )
      return;
    try {
      await dtsConnectorApi.disconnect();
      let profileCleared = true;
      try {
        await clearDtsAuthProfile();
      } catch {
        profileCleared = false;
      }
      setConnectors((list) =>
        list.map((item) => (item.id === id ? { ...item, connected: false } : item)),
      );
      notify(
        profileCleared ? 'success' : 'warning',
        profileCleared
          ? tConnector('dtsDisconnectedAndSessionCredentialsCleared')
          : tConnector('dtsDisconnectedButTheLoginProfileCouldNotBeCleared'),
      );
    } catch (cause) {
      notify(
        'error',
        cause instanceof Error ? uiText(cause, locale) : tConnector('couldNotDisconnectDts'),
      );
    }
  }
  const normalized = query.trim().toLocaleLowerCase(locale);
  const visible = useMemo(() => {
    const filtered = connectors.filter((connector) => {
      const presentation = connectorPresentation(connector, locale);
      return (
        (category === '全部' || connector.category === category) &&
        (!normalized ||
          `${presentation.name} ${presentation.description} ${connectorCategoryLabel(connector.category, locale)}`
            .toLocaleLowerCase(locale)
            .includes(normalized))
      );
    });
    if (sort === 'recent') {
      return filtered.toSorted((a, b) =>
        updatedSortDirection === 'desc'
          ? a.updatedDays - b.updatedDays
          : b.updatedDays - a.updatedDays,
      );
    }
    if (sort === 'name')
      return filtered.toSorted((a, b) =>
        connectorPresentation(a, locale).name.localeCompare(
          connectorPresentation(b, locale).name,
          locale,
        ),
      );
    return filtered;
  }, [connectors, category, normalized, sort, updatedSortDirection, locale]);
  function chooseSort(nextSort: ConnectorSort) {
    setSort(nextSort);
    if (nextSort === 'recent') setUpdatedSortDirection('desc');
  }
  function toggleUpdatedSort() {
    if (sort === 'recent') {
      setUpdatedSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort('recent');
      setUpdatedSortDirection('desc');
    }
  }
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([['全部', connectors.length]]);
    for (const connector of connectors)
      counts.set(connector.category, (counts.get(connector.category) ?? 0) + 1);
    return counts;
  }, [connectors]);
  const categoryLabel =
    category === '全部' ? tConnector('allTypes') : connectorCategoryLabel(category, locale);
  const breadcrumbLabel =
    category === '全部' ? tConnector('allConnectors') : connectorCategoryLabel(category, locale);
  const detailConnector = detailId
    ? connectors.find((connector) => connector.id === detailId)
    : null;
  if (detailConnector)
    return (
      <ConnectorDetail
        connector={detailConnector}
        onBack={() => setDetailId(null)}
        onConnectionChange={(connected) =>
          setConnectors((list) =>
            list.map((item) => (item.id === detailConnector.id ? { ...item, connected } : item)),
          )
        }
        onWorkbenchFocus={onWorkbenchFocus}
        onOpenProject={onOpenProject}
      />
    );
  return (
    <section
      aria-label={tConnector('connectors')}
      className="relative flex h-full min-h-0 flex-col bg-panel"
    >
      <header className="flex h-[42px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-3">
        <nav
          aria-label={tConnector('breadcrumb')}
          className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]"
        >
          <span>{tConnector('connectors')}</span>
          <span aria-hidden className="text-[var(--line-strong)]">
            /
          </span>
          <strong className="truncate font-medium text-[var(--muted-strong)]">
            {breadcrumbLabel}
          </strong>
        </nav>
        <span className="flex h-7 shrink-0 items-center gap-2 text-[10px] font-medium tabular-nums text-[var(--muted-strong)]">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-[var(--ok-ink)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok-ink)_10%,transparent)]"
          />
          {tConnector('connected')}
          {connectedCount} / {connectors.length}
        </span>
      </header>

      <div className="flex min-h-[50px] shrink-0 flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="fouc-action flex h-8 min-w-[112px] items-center justify-between gap-2 rounded-[6px] border border-[var(--control-border)] bg-panel px-2.5 text-[10px] text-[var(--ink-soft)] outline-none transition-colors"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{categoryLabel}</span>
                  <span className="text-[9px] tabular-nums text-[var(--muted)]">
                    {categoryCounts.get(category) ?? 0}
                  </span>
                </span>
                <CaretDown className="size-3 shrink-0 text-[var(--muted)]" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[184px] min-w-0">
              {CONNECTOR_CATEGORIES.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={category === option}
                  onCheckedChange={() => setCategory(option)}
                  className="justify-between text-[11px]"
                >
                  <span>
                    {option === '全部'
                      ? tConnector('allTypes')
                      : connectorCategoryLabel(option, locale)}
                  </span>
                  <span className="ml-auto text-[9px] tabular-nums text-[var(--muted)]">
                    {categoryCounts.get(option) ?? 0}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="whitespace-nowrap text-[9.5px] tabular-nums text-[var(--muted)]">
            {visible.length}
            {tConnector('connectors22')}
          </span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <label className="flex h-8 w-[220px] min-w-[150px] items-center gap-2 rounded-[6px] border border-[var(--control-border)] bg-panel px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] max-[920px]:w-[180px]">
            <MagnifyingGlass className="size-3.5 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={tConnector('searchConnectors')}
              placeholder={tConnector('searchConnectors')}
              className="min-w-0 flex-1 bg-transparent text-[10px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
            />
          </label>

          <ViewSwitcher value={view} onValueChange={setView} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="fouc-action flex h-8 w-[92px] shrink-0 items-center justify-between gap-1 rounded-[6px] border border-[var(--control-border)] bg-panel px-2.5 text-[9.5px] text-[var(--ink-soft)] outline-none transition-colors max-[760px]:hidden"
              >
                {SORT_OPTIONS(locale).find((option) => option.id === sort)?.label}
                <CaretDown className="size-3 text-[var(--muted)]" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[118px] min-w-0">
              {SORT_OPTIONS(locale).map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={sort === option.id}
                  onCheckedChange={() => chooseSort(option.id)}
                  className="text-[11px]"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={restoreCatalogScroll}
        onScroll={(event) => {
          catalogScrollTop.current = event.currentTarget.scrollTop;
        }}
        className="min-h-0 flex-1 overflow-auto px-3 pb-20 pt-2.5"
      >
        {visible.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <PlugsConnected className="size-6 text-[var(--muted)]" />
            <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">
              {tConnector('noMatchingConnectors')}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('全部');
              }}
              className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline"
            >
              {tConnector('clearFilters')}
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-4 gap-3 max-[1240px]:grid-cols-3 max-[980px]:grid-cols-2 max-[700px]:grid-cols-1">
            {visible.map((connector, index) => (
              <motion.div
                key={`grid-${connector.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(index * 0.012, 0.1) }}
              >
                <ConnectorCard
                  connector={connector}
                  onOpen={() => setDetailId(connector.id)}
                  onConnect={() => connectConnector(connector.id)}
                  onDisconnect={() => void disconnectConnector(connector.id)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[minmax(168px,1fr)_96px_minmax(230px,2.2fr)_64px_92px_84px] gap-4 border-y border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[9.5px] font-medium text-[var(--muted)]">
              <span>{tConnector('name')}</span>
              <span>{tConnector('category')}</span>
              <span>{tConnector('description')}</span>
              <span>{tConnector('version')}</span>
              <button
                type="button"
                onClick={toggleUpdatedSort}
                className={cn(
                  'flex items-center gap-1 text-left outline-none hover:text-[var(--ink-soft)] focus-visible:text-[var(--accent-ink)]',
                  sort === 'recent' && 'text-[var(--accent-ink)]',
                )}
              >
                {tConnector('lastUpdated')}
                {sort === 'recent' ? (
                  updatedSortDirection === 'desc' ? (
                    <CaretDown className="size-2.5" weight="bold" />
                  ) : (
                    <CaretUp className="size-2.5" weight="bold" />
                  )
                ) : null}
              </button>
              <span>{tConnector('actions')}</span>
            </div>
            {visible.map((connector, index) => (
              <motion.div
                key={`list-${connector.id}`}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, delay: Math.min(index * 0.01, 0.08) }}
              >
                <ConnectorRow
                  connector={connector}
                  onOpen={() => setDetailId(connector.id)}
                  onConnect={() => connectConnector(connector.id)}
                  onDisconnect={() => void disconnectConnector(connector.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
