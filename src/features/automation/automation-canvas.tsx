'use client';

import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/automation-canvas.messages';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsDownUp,
  CaretDown,
  Clock,
  MagnifyingGlass,
  WarningCircle,
} from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { AutomationDetailPanel } from './automation-detail-panel';
import {
  type AutomationDefinition,
  type AutomationStatus,
  initialAutomations,
} from './automation-data';
import { AutomationHeader, type AutomationTab } from './automation-header';
import { AutomationTable, RunRecordsTable } from './automation-table';

import { displayAutomation, getRunRecords } from './automation-localization';

type Filter = 'all' | 'enabled' | 'paused';
type Sort = 'default' | 'recent' | 'name';

export function AutomationCanvas() {
  const { t: uiText, locale } = useTranslation(messages);
  const [tab, setTab] = useState<AutomationTab>('automations');
  const [automations, setAutomations] = useState(() => initialAutomations);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialAutomations[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');
  const [query, setQuery] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);
  const { notify } = useAppAlert();
  const searchRef = useRef<HTMLInputElement>(null);
  const runs = getRunRecords(locale);

  const displayed = useMemo(
    () => automations.map((item) => displayAutomation(item, locale)),
    [automations, locale],
  );
  const selected = displayed.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    const result = displayed.filter((item) => {
      const enabledMatch =
        filter === 'all' || (filter === 'enabled' ? item.enabled : !item.enabled);
      const searchMatch =
        !normalized || `${item.title} ${item.agent}`.toLocaleLowerCase(locale).includes(normalized);
      return enabledMatch && searchMatch;
    });
    if (sort === 'name') return [...result].sort((a, b) => a.title.localeCompare(b.title, locale));
    if (sort === 'recent')
      return [...result].sort((a, b) => a.lastRun.localeCompare(b.lastRun, locale));
    return result;
  }, [displayed, filter, query, sort, locale]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  function openItem(id: string) {
    setCreating(false);
    setSelectedId(id);
  }

  function updateSelected(patch: Partial<AutomationDefinition>) {
    if (!selectedId) return;
    setAutomations((items) =>
      items.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)),
    );
  }

  function runAutomation(id: string) {
    const item = automations.find((automation) => automation.id === id);
    if (!item) return;
    setRunningId(id);
    window.setTimeout(() => {
      setAutomations((items) =>
        items.map((automation) =>
          automation.id === id
            ? {
                ...automation,
                enabled: true,
                status: 'running' as AutomationStatus,
                lastRun: '刚刚',
                lastRunDetail: '正在启动',
              }
            : automation,
        ),
      );
      setRunningId(null);
      notify('success', uiText('{0} 已开始运行', { '0': item.title }));
    }, 700);
  }

  const detailVisible = tab === 'automations' && (selected !== null || creating);

  return (
    <section aria-label={uiText('自动化')} className="relative flex h-full min-h-0 bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <AutomationHeader
          tab={tab}
          enabledCount={automations.filter((item) => item.enabled).length}
          todayRunCount={
            runs.filter((record) => record.startedAt.startsWith(uiText('今天'))).length
          }
          attentionCount={automations.filter((item) => item.status === 'attention').length}
          onTabChange={(next) => {
            setTab(next);
            if (next === 'runs') setCreating(false);
          }}
          onCreate={() => {
            setTab('automations');
            setCreating(true);
            setSelectedId(null);
          }}
        />

        <OperationalStrip items={displayed} onOpen={openItem} />

        <AutomationToolbar
          tab={tab}
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchRef={searchRef}
          counts={{
            all: automations.length,
            enabled: automations.filter((item) => item.enabled).length,
            paused: automations.filter((item) => !item.enabled).length,
          }}
          sort={sort}
          onSortChange={setSort}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-panel px-3 pt-[10px]">
          <div className="min-h-full overflow-hidden rounded-t-[8px] border border-b-0 border-[var(--line)] bg-panel">
            {tab === 'automations' ? (
              <AutomationTable
                items={filtered}
                selectedId={selectedId}
                onSelect={openItem}
                hasAutomations={automations.length > 0}
              />
            ) : (
              <RunRecordsTable records={runs} />
            )}
          </div>
        </div>

        <footer className="flex h-10 shrink-0 items-center border-t border-[var(--line)] px-5 text-[9.5px] text-[var(--muted)]">
          {tab === 'automations'
            ? uiText('共 {0} 个自动化', { '0': filtered.length })
            : uiText('共 {0} 条运行记录', { '0': runs.length })}
          <span className="ml-auto">{uiText('当前为演示数据')}</span>
        </footer>
      </div>

      {detailVisible ? (
        <>
          <button
            type="button"
            aria-label={uiText('关闭自动化详情')}
            onClick={() => {
              setSelectedId(null);
              setCreating(false);
            }}
            className="modal-backdrop absolute inset-0 z-20 hidden max-[1060px]:block"
          />
          <AutomationDetailPanel
            item={selected}
            creating={creating}
            running={runningId === selected?.id}
            onClose={() => {
              setSelectedId(null);
              setCreating(false);
            }}
            onToggle={(enabled) => {
              updateSelected({ enabled, status: enabled ? 'enabled' : 'paused' });
              notify('success', enabled ? uiText('自动化已启用') : uiText('自动化已暂停'));
            }}
            onRun={() => selected && runAutomation(selected.id)}
            onSave={() => notify('success', uiText('更改已保存'))}
            onCreate={(draft) => {
              const id = `AUTO-${String(automations.length + 1).padStart(3, '0')}`;
              const created: AutomationDefinition = {
                id,
                title: draft.title.trim(),
                description: draft.instruction.trim(),
                schedule: draft.schedule,
                timezone:
                  draft.schedule === '有新内容时' ? '事件触发' : 'Asia/Shanghai (UTC+08:00)',
                agent: draft.agent,
                agentInitial: draft.agent.slice(0, 1),
                lastRun: '尚未运行',
                lastRunDetail: '—',
                status: 'enabled',
                enabled: true,
                notification: '失败时通知',
                timeout: '30 分钟',
              };
              setAutomations((items) => [created, ...items]);
              setCreating(false);
              setSelectedId(id);
              setFilter('all');
              notify('success', uiText('{0} 已创建', { '0': created.title }));
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function OperationalStrip({
  items,
  onOpen,
}: {
  items: AutomationDefinition[];
  onOpen: (id: string) => void;
}) {
  const uiText = useTranslation(messages).t;
  const running = items.find((item) => item.status === 'running');
  const next = items.find((item) => item.enabled && item.status !== 'running');
  const attention = items.find((item) => item.status === 'attention');
  return (
    <section
      aria-label={uiText('当前运行状态')}
      className="grid h-[44px] shrink-0 grid-cols-[1fr_1.15fr_.86fr] divide-x divide-[var(--line)] border-y border-[var(--line)] bg-[#fafbfc] max-[850px]:grid-cols-2"
    >
      <button
        type="button"
        disabled={!running}
        onClick={() => running && onOpen(running.id)}
        className="group flex min-w-0 items-center gap-3 px-5 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-default"
      >
        <span className="text-[9px] text-[var(--muted)]">{uiText('正在运行')}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[var(--ink-soft)]">
          {running?.title ?? uiText('暂无运行')}
        </span>
      </button>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onOpen(next.id)}
        className="flex min-w-0 items-center gap-3 px-5 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-default max-[850px]:hidden"
      >
        <Clock className="size-3.5 shrink-0 text-[var(--muted-strong)]" />
        <span className="text-[9px] text-[var(--muted)]">{uiText('下一次')}</span>
        <span className="truncate text-[10px] text-[var(--ink-soft)]">
          {next ? `${next.title} · ${next.schedule}` : uiText('尚未设置')}
        </span>
      </button>
      <button
        type="button"
        disabled={!attention}
        onClick={() => attention && onOpen(attention.id)}
        className="flex items-center gap-2 px-5 text-left text-[10px] font-medium text-[var(--warn-ink)] outline-none transition-colors hover:bg-[var(--warn-soft)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-default disabled:text-[var(--muted)]"
      >
        <WarningCircle className="size-3.5 shrink-0" />
        <span className="truncate">
          {attention ? uiText('1 项需要处理') : uiText('暂无待处理')}
        </span>
        {attention ? <span className="ml-auto text-[9px]">{uiText('查看')}</span> : null}
      </button>
    </section>
  );
}

function AutomationToolbar({
  tab,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  searchRef,
  counts,
  sort,
  onSortChange,
}: {
  tab: AutomationTab;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  counts: Record<Filter, number>;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
}) {
  const uiText = useTranslation(messages).t;
  const filterOptions = [
    { id: 'all' as const, label: uiText('全部') },
    { id: 'enabled' as const, label: uiText('已启用') },
    { id: 'paused' as const, label: uiText('已暂停') },
  ];
  return (
    <div className="flex h-[58px] shrink-0 items-center gap-3 px-5">
      {tab === 'automations' ? (
        <div
          role="tablist"
          aria-label={uiText('自动化状态')}
          className="flex h-9 shrink-0 items-center overflow-hidden rounded-[7px] border border-[var(--line)] bg-panel"
        >
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              onClick={() => onFilterChange(option.id)}
              className={cn(
                'flex h-full items-center gap-2 border-l border-[var(--line)] px-3 text-[10.5px] font-medium outline-none transition-colors first:border-l-0 hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
                filter === option.id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                  : 'text-[var(--muted-strong)]',
              )}
            >
              <span>{option.label}</span>
              <span className="text-[9px] opacity-65">{counts[option.id]}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="text-[10.5px] font-medium text-[var(--ink-soft)]">
          {uiText('最近 7 天')}
        </span>
      )}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        <label className="flex h-9 w-[282px] items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10px] text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] max-[1380px]:w-[160px]">
          <MagnifyingGlass className="size-4 shrink-0" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label={uiText('搜索自动化')}
            placeholder={uiText('搜索名称 / Agent')}
            className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <kbd className="whitespace-nowrap font-sans text-[9px] text-[var(--muted)] max-[1380px]:hidden">
            Ctrl K
          </kbd>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={uiText('排序')}
              className="flex h-9 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowsDownUp className="size-4" />
              <span className="max-[1380px]:hidden">{uiText('排序')}</span>
              <CaretDown className="size-3 max-[1380px]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel>{uiText('排序方式')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(
              [
                { id: 'default', label: uiText('默认顺序') },
                { id: 'recent', label: uiText('最近运行') },
                { id: 'name', label: uiText('名称') },
              ] as const
            ).map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={sort === option.id}
                onCheckedChange={() => onSortChange(option.id)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
