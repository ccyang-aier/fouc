'use client';

import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/system-bar.messages';

/** 主区系统栏：macOS 风格全局搜索、通知/任务快捷面板与桌面窗口控制。 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardText,
  MagnifyingGlass,
  Minus,
  Square,
  X,
} from '@phosphor-icons/react';

import { performWindowAction } from '@/lib/tauri-window';
import { cn } from '@/lib/utils';

import { KnowledgeNotificationBell } from '@/features/knowledge/notifications/components/notification-bell';
import type { WorkbenchView } from './workbench-view';

const SEARCH_ITEMS: Array<{
  label: keyof typeof messages;
  detail: keyof typeof messages;
  view: WorkbenchView;
}> = [
  { label: '新对话', detail: '开始一项新任务', view: 'home' },
  { label: '工作台', detail: '查看项目工作台', view: 'workbench' },
  { label: '任务', detail: '查看项目任务', view: 'tasks' },
  { label: '成员', detail: '管理项目成员', view: 'members' },
  { label: '资产', detail: '查看项目资产', view: 'assets' },
  { label: '聊天', detail: '查看项目对话', view: 'chats' },
  { label: 'Agents', detail: '管理本机 Agent', view: 'agents' },
  { label: '社区', detail: '发现 Agent 与技能', view: 'community' },
  { label: '知识库', detail: '查看沉淀的知识', view: 'knowledge' },
  { label: '连接器', detail: '管理外部服务', view: 'connectors' },
  { label: '设置', detail: '调整 Fouc 偏好', view: 'settings' },
  { label: '帮助与反馈', detail: '查看使用帮助并反馈问题', view: 'help' },
];

export function SystemBar({ onNavigate }: { onNavigate: (view: WorkbenchView) => void }) {
  const { t: uiText, locale } = useTranslation(messages);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const results = useMemo(
    () =>
      SEARCH_ITEMS.map((item) => ({
        ...item,
        label: uiText(item.label),
        detail: uiText(item.detail),
      })).filter((item) =>
        `${item.label}${item.detail}`.toLocaleLowerCase(locale).includes(normalizedQuery),
      ),
    [normalizedQuery, uiText, locale],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function navigate(view: WorkbenchView) {
    onNavigate(view);
    setQuery('');
    setSearchOpen(false);
    searchRef.current?.blur();
  }

  return (
    <div
      data-tauri-drag-region
      className="relative flex h-11 shrink-0 select-none items-center border-b border-[var(--wt-sidebar-edge)] bg-panel px-3"
    >
      <form
        data-tauri-drag-region="false"
        className="relative w-[304px] max-w-[38vw] max-[850px]:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          if (results[0]) navigate(results[0].view);
        }}
      >
        <MagnifyingGlass
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-[14px] -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          ref={searchRef}
          type="search"
          value={query}
          role="combobox"
          aria-label={uiText('全局搜索')}
          aria-expanded={searchOpen}
          aria-controls="global-search-results"
          placeholder={uiText('搜索')}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          className="h-7 w-full rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)] pl-8 pr-12 text-[11.5px] text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(20,24,28,0.04)] outline-none transition-[border-color,background-color] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-panel"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] border border-[var(--line)] bg-panel px-1.5 py-0.5 font-sans text-[9px] leading-none text-[var(--muted)] shadow-[0_1px_1px_rgba(20,24,28,0.04)]">
          ⌘ K
        </kbd>
        {searchOpen ? (
          <div
            id="global-search-results"
            role="listbox"
            className="menu-surface absolute left-0 top-[34px] z-50 w-full overflow-hidden rounded-[7px] border bg-elevated p-1"
          >
            {results.length > 0 ? (
              results.slice(0, 6).map((item) => (
                <button
                  key={item.view}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigate(item.view)}
                  className="flex h-9 w-full items-center gap-2 rounded-[7px] px-2.5 text-left outline-none hover:bg-wash focus-visible:bg-wash"
                >
                  <MagnifyingGlass aria-hidden className="size-3.5 shrink-0 text-[var(--muted)]" />
                  <span className="text-[11.5px] font-medium text-[var(--ink)]">{item.label}</span>
                  <span className="ml-auto truncate text-[10px] text-[var(--muted)]">
                    {item.detail}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-2.5 py-3 text-[11px] text-[var(--muted)]">
                {uiText('没有匹配结果')}
              </p>
            )}
          </div>
        ) : null}
      </form>

      <div className="ml-auto flex items-center gap-0.5" data-tauri-drag-region="false">
        {/* 通知铃铛：知识库工作台在线时经桥接快照实时显示真实收件箱，未在线时点击进入知识库 */}
        <KnowledgeNotificationBell onOpenWorkbench={() => onNavigate('knowledge')} />
<button type="button" aria-label={uiText('任务')} title={uiText('任务')} onClick={() => onNavigate('tasks')} className="fouc-action grid size-7 cursor-pointer place-items-center rounded-md text-[var(--muted-strong)]"><ClipboardText size={15} weight="duotone" /></button>
        <span aria-hidden className="mx-1.5 h-5 w-px bg-[var(--line-strong)]" />
        <WindowControl
          label={uiText('最小化')}
          icon={Minus}
          onClick={() => void performWindowAction('minimize')}
        />
        <WindowControl
          label={uiText('最大化或还原')}
          icon={Square}
          onClick={() => void performWindowAction('toggleMaximize')}
          iconClassName="size-[13px]"
        />
        <WindowControl
          label={uiText('关闭')}
          icon={X}
          onClick={() => void performWindowAction('close')}
          danger
        />
      </div>
    </div>
  );
}

function WindowControl({
  label,
  icon: Icon,
  onClick,
  danger,
  iconClassName,
}: {
  label: string;
  icon: typeof Minus;
  onClick: () => void;
  danger?: boolean;
  iconClassName?: string;
}) {
  return (
    <button
      data-tauri-drag-region="false"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-[7px] text-[var(--ink)] outline-none transition-colors focus-visible:bg-wash',
        danger ? 'hover:bg-[#f5e0de] hover:text-[#b8493f]' : 'hover:bg-wash',
      )}
    >
      <Icon className={cn('size-[14px]', iconClassName)} />
    </button>
  );
}
