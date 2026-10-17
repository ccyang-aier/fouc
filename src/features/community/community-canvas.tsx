'use client';

import { type Locale } from '@/lib/i18n/locale';
import { createTranslator } from '@/lib/i18n/messages';
import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/community-canvas.messages';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretDown,
  CheckCircle,
  DotsThree,
  DownloadSimple,
  MagnifyingGlass,
  Plus,
  Star,
  StarHalf,
  X,
} from '@phosphor-icons/react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ViewSwitcher, type ViewMode } from '@/components/ui/view-switcher';
import { useAppAlert } from '@/components/app-alert-provider';

import {
  CommunityAssetCard,
  CommunityAssetTable,
  CommunityResourceIcon,
  type CommunityLibraryItem,
} from './community-cards';
import { CommunityDetailPage, type RelatedItem } from './community-detail';
import { CommunityFacets, type CommunityTypeFilter } from './community-facets';
import { CommunityOfficialBadge } from './community-official-badge';
import {
  buildCommunityDetail,
  initialCommunityAgents,
  initialCommunitySkills,
} from './community-data';

import {
  localizeCommunityAgent,
  localizeCommunitySkill,
  communityTagLabel,
  communityUpdatedLabel,
  communityCategoryLabel,
  communityTypeLabel,
  isOfficialCommunityResource,
} from './community-localization';

export type CommunitySortKey = 'popular' | 'rating' | 'name' | 'updated';

function getSortOptions(locale: Locale): Array<{ id: CommunitySortKey; label: string }> {
  const uiText = createTranslator(messages, locale);
  return [
    { id: 'popular', label: uiText('最多获取') },
    { id: 'rating', label: uiText('最高评分') },
    { id: 'name', label: uiText('名称排序') },
    { id: 'updated', label: uiText('最近更新') },
  ];
}

function updatedWeight(value: string) {
  const amount = Number.parseInt(value, 10) || 0;
  if (value.includes('小时')) return amount / 24;
  if (value.includes('周')) return amount * 7;
  return amount;
}

function itemMatchesDomain(item: CommunityLibraryItem, domain: string) {
  if (!domain) return true;
  if (domain === '写作')
    return (
      item.category === '内容' ||
      item.tags.some((value) => ['文档', '长文', '周报', '扩写'].includes(value))
    );
  return item.category === domain;
}

export function CommunityCanvas() {
  const { t: uiText, locale } = useTranslation(messages);
  const SORT_OPTIONS = getSortOptions(locale);
  const [agents, setAgents] = useState(initialCommunityAgents);
  const [skills, setSkills] = useState(initialCommunitySkills);
  const [typeFilter, setTypeFilter] = useState<CommunityTypeFilter>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('communityType') === 'skills' ? 'skills' : 'all');
  const [domain, setDomain] = useState('');
  const [tag, setTag] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [minDownloads, setMinDownloads] = useState(0);
  const [authorQuery, setAuthorQuery] = useState('');
  const [sort, setSort] = useState<CommunitySortKey>('popular');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnSort, setColumnSort] = useState<CommunitySortKey | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTagDraft, setDetailTagDraft] = useState('');
  const [addingDetailTag, setAddingDetailTag] = useState(false);
  const { notify } = useAppAlert();
  const searchRef = useRef<HTMLInputElement>(null);

  const libraryItems = useMemo<CommunityLibraryItem[]>(
    () => [
      ...agents
        .map((item) => localizeCommunityAgent(item, locale))
        .map((agent) => ({
          id: agent.id,
          kind: 'agents' as const,
          name: agent.name,
          glyph: agent.glyph,
          tone: agent.tone,
          category: agent.category,
          summary: agent.tagline,
          author: agent.author,
          official: isOfficialCommunityResource(agent.id),
          version: agent.version,
          installs: agent.installs,
          installed: agent.installed,
          rating: agent.rating,
          tags: agent.tags,
          updated: agent.updated,
        })),
      ...skills
        .map((item) => localizeCommunitySkill(item, locale))
        .map((skill) => ({
          id: skill.id,
          kind: 'skills' as const,
          name: skill.name,
          glyph: skill.name.slice(0, 1),
          tone: skill.tone,
          category: skill.category,
          summary: skill.summary,
          rating: skill.rating,
          author: skill.author,
          official: isOfficialCommunityResource(skill.id),
          version: skill.version,
          installs: skill.installs,
          installed: skill.installed,
          tags: skill.compat,
          updated: skill.updated,
        })),
    ],
    [agents, skills, locale],
  );

  const authorOptions = useMemo(() => {
    const normalizedAuthorQuery = authorQuery.trim().toLocaleLowerCase(locale);
    return [...new Set(libraryItems.map((item) => item.author))]
      .filter(
        (author) =>
          !normalizedAuthorQuery ||
          author.toLocaleLowerCase(locale).includes(normalizedAuthorQuery),
      )
      .sort((a, b) => a.localeCompare(b, locale))
      .slice(0, 6);
  }, [authorQuery, libraryItems, locale]);

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleItems = useMemo(() => {
    const filtered = libraryItems.filter((item) => {
      if (typeFilter === 'agents' || typeFilter === 'skills') {
        if (item.kind !== typeFilter) return false;
      } else if (typeFilter === 'plugins' || typeFilter === 'prompts') return false;
      if (!itemMatchesDomain(item, domain)) return false;
      if (tag && !item.tags.includes(tag)) return false;
      if ((item.rating ?? 0) < minRating) return false;
      if (item.installs < minDownloads) return false;
      if (
        authorQuery.trim() &&
        !item.author
          .toLocaleLowerCase(locale)
          .includes(authorQuery.trim().toLocaleLowerCase(locale))
      )
        return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.summary} ${item.author} ${item.tags.join(' ')}`
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery);
    });
    return filtered.toSorted((a, b) => {
      let comparison = 0;
      if (sort === 'name') comparison = a.name.localeCompare(b.name, locale);
      else if (sort === 'rating')
        comparison = (a.rating ?? 0) - (b.rating ?? 0) || a.installs - b.installs;
      else if (sort === 'updated') comparison = updatedWeight(a.updated) - updatedWeight(b.updated);
      else comparison = a.installs - b.installs;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    authorQuery,
    domain,
    libraryItems,
    minDownloads,
    minRating,
    normalizedQuery,
    sort,
    sortDirection,
    tag,
    typeFilter,
    locale,
  ]);

  const activeSelectedId =
    selectedId && visibleItems.some((item) => item.id === selectedId) ? selectedId : null;
  const selectedItem = libraryItems.find((item) => item.id === activeSelectedId) ?? null;

  const typeCounts = useMemo<Record<CommunityTypeFilter, number>>(
    () => ({
      all: libraryItems.length,
      agents: agents.length,
      skills: skills.length,
      plugins: 0,
      prompts: 0,
    }),
    [agents.length, libraryItems, skills.length],
  );

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const label of ['研发', '办公', '数据', '内容', '写作']) {
      counts.set(label, libraryItems.filter((item) => itemMatchesDomain(item, label)).length);
    }
    return counts;
  }, [libraryItems]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of libraryItems) {
      for (const label of item.tags) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return new Map(
      [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale)),
    );
  }, [libraryItems, locale]);

  function clearAdvancedFilters() {
    setMinRating(0);
    setMinDownloads(0);
    setAuthorQuery('');
  }

  function chooseSort(next: CommunitySortKey) {
    setColumnSort(null);
    if (sort === next) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(next);
      setSortDirection(next === 'name' || next === 'updated' ? 'asc' : 'desc');
    }
  }

  function chooseColumnSort(next: CommunitySortKey) {
    if (columnSort === next) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setColumnSort(next);
      setSort(next);
      setSortDirection(next === 'name' || next === 'updated' ? 'asc' : 'desc');
    }
  }

  function updateItemTags(item: CommunityLibraryItem, nextTags: string[]) {
    if (item.kind === 'agents')
      setAgents((current) =>
        current.map((agent) => (agent.id === item.id ? { ...agent, tags: nextTags } : agent)),
      );
    else
      setSkills((current) =>
        current.map((skill) => (skill.id === item.id ? { ...skill, compat: nextTags } : skill)),
      );
  }

  function addDetailTag(item: CommunityLibraryItem) {
    const next = detailTagDraft.trim();
    if (!next || item.tags.includes(next)) return;
    updateItemTags(item, [...item.tags, next]);
    setDetailTagDraft('');
    setAddingDetailTag(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function acquireItem(item: CommunityLibraryItem) {
    if (item.installed) return;
    if (item.kind === 'agents') {
      setAgents((list) =>
        list.map((agent) => (agent.id === item.id ? { ...agent, installed: true } : agent)),
      );
      notify('success', uiText('{0} 已添加到你的 Agent 列表', { '0': item.name }));
    } else {
      setSkills((list) =>
        list.map((skill) => (skill.id === item.id ? { ...skill, installed: true } : skill)),
      );
      notify('success', uiText('{0} 已安装，可在任务中引用', { '0': item.name }));
    }
  }

  const detail = useMemo(() => {
    if (!detailId) return null;
    const agent = agents.find((item) => item.id === detailId);
    if (agent) {
      return {
        model: buildCommunityDetail('agents', localizeCommunityAgent(agent, locale), locale),
        done: agent.installed,
        onAction: () => acquireItem(libraryItems.find((item) => item.id === agent.id)!),
        related: agents
          .filter((item) => item.id !== agent.id && item.category === agent.category)
          .slice(0, 3)
          .map((item) => localizeCommunityAgent(item, locale))
          .map<RelatedItem>((item) => ({
            id: item.id,
            name: item.name,
            glyph: item.glyph,
            desc: item.tagline,
            done: item.installed,
          })),
      };
    }
    const skill = skills.find((item) => item.id === detailId);
    if (!skill) return null;
    return {
      model: buildCommunityDetail('skills', localizeCommunitySkill(skill, locale), locale),
      done: skill.installed,
      onAction: () => acquireItem(libraryItems.find((item) => item.id === skill.id)!),
      related: skills
        .filter((item) => item.id !== skill.id && item.category === skill.category)
        .slice(0, 3)
        .map((item) => localizeCommunitySkill(item, locale))
        .map<RelatedItem>((item) => ({
          id: item.id,
          name: item.name,
          glyph: item.name.slice(0, 1),
          desc: item.summary,
          done: item.installed,
        })),
    };
    // acquireItem only writes the item selected by this derived detail model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, detailId, libraryItems, skills, locale]);

  if (detail) {
    return (
      <section aria-label={uiText('社区详情')} className="relative flex h-full min-h-0 bg-panel">
        <CommunityFacets
          type={typeFilter}
          domain={domain}
          tag={tag}
          typeCounts={typeCounts}
          domainCounts={domainCounts}
          tagCounts={tagCounts}
          onTypeChange={setTypeFilter}
          onDomainChange={setDomain}
          onTagChange={setTag}
        />
        <div className="min-h-0 min-w-0 flex-1">
          <CommunityDetailPage
            key={detailId}
            detail={detail.model}
            done={detail.done}
            related={detail.related}
            onBack={() => setDetailId(null)}
            onAction={detail.onAction}
            onOpenRelated={(id) => setDetailId(id)}
            onShare={() => notify('success', uiText('详情链接已复制'))}
            onDiscuss={() => notify('info', uiText('讨论区即将开放'))}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={uiText('社区资产库')}
      className="relative flex h-full min-h-0 flex-col bg-panel"
    >
      <div className="flex min-h-0 flex-1">
        <CommunityFacets
          type={typeFilter}
          domain={domain}
          tag={tag}
          typeCounts={typeCounts}
          domainCounts={domainCounts}
          tagCounts={tagCounts}
          onTypeChange={setTypeFilter}
          onDomainChange={setDomain}
          onTagChange={setTag}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-[var(--line)] px-[18px]">
            <nav
              aria-label={uiText('面包屑')}
              className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]"
            >
              <span>{uiText('社区')}</span>
              <span aria-hidden className="text-[var(--line-strong)]">
                /
              </span>
              <strong className="truncate font-medium text-[var(--muted-strong)]">
                {communityTypeLabel(typeFilter, locale)}
              </strong>
            </nav>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => notify('info', uiText('作品提交通道即将开放'))}
                className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-[var(--accent-foreground)] shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_18%,transparent)] outline-none hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <Plus className="size-3.5" weight="bold" />
                {uiText('提交资源')}
              </button>
              <button
                type="button"
                aria-label={uiText('更多社区操作')}
                onClick={() => notify('info', uiText('更多社区能力即将开放'))}
                className="fouc-action flex size-[30px] items-center justify-center rounded-[6px] border border-[var(--control-border)] text-[var(--muted-strong)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <DotsThree className="size-[18px]" weight="bold" />
              </button>
            </div>
          </header>

          <div className="flex shrink-0 items-center justify-between gap-[18px] px-[18px] py-[13px]">
            <div className="flex min-w-0 w-full max-w-[445px] items-center gap-2.5">
              <div className="flex h-8 shrink-0 items-center overflow-hidden rounded-[6px] border border-[var(--control-border)] bg-panel">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-active={minRating > 0 || undefined}
                      className="fouc-action flex h-full items-center gap-1 border-r border-[var(--line)] px-2.5 text-[9.5px] text-[var(--ink-soft)] outline-none data-[active=true]:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] data-[active=true]:text-[var(--accent-ink)]"
                    >
                      <Star className="size-3.5" weight={minRating ? 'fill' : 'regular'} />
                      {uiText('评分')}
                      {minRating ? (
                        <span className="font-mono text-[8px]">{minRating}+</span>
                      ) : null}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[228px] min-w-0 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-medium text-[var(--ink)]">
                        {uiText('社区评分')}
                      </p>
                      <span className="rounded-[5px] bg-[var(--surface-subtle)] px-2 py-1 text-[9px] tabular-nums text-[var(--ink-soft)]">
                        {minRating ? uiText('{0} 星以上', { '0': minRating }) : uiText('不限')}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-[7px] bg-[var(--surface-subtle)] px-2 py-1.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-label={uiText('{0} 星及以上', { '0': value })}
                          aria-pressed={minRating >= value}
                          onClick={() => setMinRating(minRating === value ? 0 : value)}
                          className="flex size-7 items-center justify-center rounded-[5px] outline-none hover:bg-panel focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <Star
                            className={cn(
                              'size-[18px]',
                              minRating >= value ? 'text-[#dfa43c]' : 'text-[var(--line-strong)]',
                            )}
                            weight={minRating >= value ? 'fill' : 'regular'}
                          />
                        </button>
                      ))}
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      {[
                        { label: uiText('不限'), value: 0 },
                        { label: uiText('4 星+'), value: 4 },
                        { label: uiText('5 星'), value: 5 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          aria-pressed={minRating === item.value}
                          onClick={() => setMinRating(item.value)}
                          className="fouc-action h-7 rounded-[6px] border border-[var(--control-border)] text-[9px] text-[var(--ink-soft)] aria-pressed:border-[var(--accent)] aria-pressed:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] aria-pressed:text-[var(--accent-ink)]"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-active={minDownloads > 0 || undefined}
                      className="fouc-action flex h-full items-center gap-1 border-r border-[var(--line)] px-2.5 text-[9.5px] text-[var(--ink-soft)] outline-none data-[active=true]:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] data-[active=true]:text-[var(--accent-ink)]"
                    >
                      <DownloadSimple className="size-3.5" />
                      {uiText('下载数')}
                      {minDownloads ? (
                        <span className="font-mono text-[8px]">{minDownloads / 1000}k+</span>
                      ) : null}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[236px] min-w-0 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-medium text-[var(--ink)]">
                        {uiText('累计获取量')}
                      </p>
                      <span className="rounded-[5px] bg-[var(--surface-subtle)] px-2 py-1 text-[9px] tabular-nums text-[var(--ink-soft)]">
                        {minDownloads ? `${minDownloads.toLocaleString(locale)}+` : uiText('不限')}
                      </span>
                    </div>
                    <div className="mt-3 rounded-[7px] bg-[var(--surface-subtle)] px-3 py-3">
                      <input
                        type="range"
                        aria-label={uiText('最低下载量')}
                        min="0"
                        max="20000"
                        step="1000"
                        value={minDownloads}
                        onChange={(event) => setMinDownloads(Number(event.target.value))}
                        className="h-1.5 w-full accent-[var(--accent)]"
                      />
                      <div className="mt-2 flex justify-between text-[8px] text-[var(--muted)]">
                        <span>0</span>
                        <span>10,000</span>
                        <span>20,000+</span>
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-4 gap-1">
                      {[
                        { label: uiText('不限'), value: 0 },
                        { label: uiText('5千+'), value: 5000 },
                        { label: uiText('1万+'), value: 10000 },
                        { label: uiText('2万+'), value: 20000 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          aria-pressed={minDownloads === item.value}
                          onClick={() => setMinDownloads(item.value)}
                          className="fouc-action h-7 rounded-[6px] border border-[var(--control-border)] text-[8.5px] text-[var(--ink-soft)] aria-pressed:border-[var(--accent)] aria-pressed:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] aria-pressed:text-[var(--accent-ink)]"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-active={authorQuery.trim().length > 0 || undefined}
                      className="fouc-action flex h-full items-center gap-1 px-2.5 text-[9.5px] text-[var(--ink-soft)] outline-none data-[active=true]:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] data-[active=true]:text-[var(--accent-ink)]"
                    >
                      <MagnifyingGlass className="size-3.5" />
                      {uiText('用户')}
                      {authorQuery ? (
                        <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                      ) : null}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[236px] min-w-0 p-2.5">
                    <div className="px-0.5 pb-2">
                      <p className="text-[11px] font-medium text-[var(--ink)]">
                        {uiText('资源作者')}
                      </p>
                    </div>
                    <label className="flex h-8 items-center gap-1.5 rounded-[6px] bg-[var(--surface-subtle)] px-2 text-[var(--muted)] border border-[var(--control-border)] focus-within:border-[var(--accent)]">
                      <MagnifyingGlass className="size-3.5" />
                      <input
                        autoFocus
                        aria-label={uiText('搜索资源作者')}
                        value={authorQuery}
                        onChange={(event) => setAuthorQuery(event.target.value)}
                        placeholder={uiText('输入作者名称')}
                        className="min-w-0 flex-1 bg-transparent text-[10px] text-[var(--ink)] outline-none"
                      />
                      {authorQuery ? (
                        <button
                          type="button"
                          aria-label={uiText('清除作者搜索')}
                          onClick={() => setAuthorQuery('')}
                        >
                          <X className="size-3" />
                        </button>
                      ) : null}
                    </label>
                    <div className="mt-2 space-y-0.5">
                      {authorOptions.map((author) => (
                        <button
                          key={author}
                          type="button"
                          aria-pressed={authorQuery === author}
                          onClick={() => setAuthorQuery(author)}
                          className="fouc-action flex h-8 w-full items-center gap-2 rounded-[6px] px-1.5 text-left text-[9.5px] text-[var(--ink-soft)] aria-pressed:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] aria-pressed:text-[var(--accent-ink)]"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[8px] font-semibold">
                            {author.slice(0, 1)}
                          </span>
                          <span className="truncate">{author}</span>
                          {authorQuery === author ? (
                            <span className="ml-auto size-1.5 rounded-full bg-[var(--accent)]" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <label className="flex h-8 min-w-[140px] max-w-[230px] flex-1 items-center gap-2 rounded-[6px] border border-[var(--control-border)] bg-panel px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)]">
                <MagnifyingGlass className="size-4 shrink-0" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={uiText('搜索社区资源')}
                  placeholder={uiText('搜索资源名称、标签或描述…')}
                  className="min-w-0 flex-1 bg-transparent text-[10.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                />
              </label>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              <ViewSwitcher value={view} onValueChange={setView} gridLabel={uiText('网格视图')} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-[84px] items-center justify-between gap-1 whitespace-nowrap rounded-[6px] border border-[var(--control-border)] px-2 text-[9.5px] text-[var(--ink-soft)] outline-none"
                  >
                    {SORT_OPTIONS.find((item) => item.id === sort)?.label}
                    <CaretDown className="size-3 text-[var(--muted)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[108px] min-w-0">
                  {SORT_OPTIONS.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item.id}
                      checked={sort === item.id}
                      onCheckedChange={() => chooseSort(item.id)}
                    >
                      {item.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-20 pt-0.5">
            <p className="mb-3 text-[10px] tabular-nums text-[var(--muted)]">
              {uiText('共')}
              {visibleItems.length} {uiText('项资源')}
            </p>
            {visibleItems.length > 0 ? (
              view === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-2.5">
                  {visibleItems.map((item) => (
                    <CommunityAssetCard
                      key={item.id}
                      item={item}
                      selected={activeSelectedId === item.id}
                      view="grid"
                      onSelect={() => setSelectedId(item.id)}
                      onOpen={() => setDetailId(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <CommunityAssetTable
                  items={visibleItems}
                  selectedId={activeSelectedId}
                  sort={columnSort}
                  sortDirection={sortDirection}
                  onSort={chooseColumnSort}
                  onSelect={setSelectedId}
                  onOpen={setDetailId}
                />
              )
            ) : (
              <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                <MagnifyingGlass className="size-6 text-[var(--muted)]" />
                <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">
                  {uiText('没有匹配的社区资源')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setTag('');
                    setDomain('');
                    setTypeFilter('all');
                    clearAdvancedFilters();
                  }}
                  className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline"
                >
                  {uiText('清除筛选条件')}
                </button>
              </div>
            )}
          </div>
        </main>

        {selectedItem ? (
          <aside
            aria-label={uiText('资源详情检查器')}
            className="relative w-[304px] shrink-0 min-h-0 overflow-y-auto border-l border-[var(--line)] bg-panel max-[1150px]:hidden"
          >
            <button
              type="button"
              aria-label={uiText('关闭资源详情')}
              title={uiText('关闭')}
              onClick={() => setSelectedId(null)}
              className="fouc-action absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <X className="size-3.5" weight="bold" />
            </button>
            <div className="flex min-h-full flex-col">
              <div className="flex flex-1 flex-col">
                <div className="px-5 pb-4 pt-5">
                  <div className="flex items-start gap-3.5">
                    <CommunityResourceIcon item={selectedItem} size="medium" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h2 className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--ink)]">
                          {selectedItem.name}
                        </h2>
                        {selectedItem.official ? (
                          <CommunityOfficialBadge className="size-4" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {selectedItem.author} ·{' '}
                        {communityUpdatedLabel(selectedItem.updated, locale)}
                        {uiText('更新')}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[9.5px]">
                        <span className="font-semibold text-[var(--accent-ink)]">
                          {communityTypeLabel(selectedItem.kind, locale)}
                        </span>
                        <span className="size-1 rounded-full bg-[var(--line-strong)]" />
                        <span className="text-[var(--muted-strong)]">
                          {communityCategoryLabel(selectedItem.category, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] leading-[19px] text-[var(--ink-soft)]">
                    {selectedItem.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {selectedItem.tags.map((label) => (
                      <span
                        key={label}
                        className="inline-flex h-6 items-center gap-1 rounded-[5px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] pl-2 pr-1 text-[9.5px] font-normal text-[var(--ink-soft)]"
                      >
                        {communityTagLabel(label, locale)}
                        <button
                          type="button"
                          aria-label={uiText('删除标签 {0}', { '0': label })}
                          onClick={() =>
                            updateItemTags(
                              selectedItem,
                              selectedItem.tags.filter((value) => value !== label),
                            )
                          }
                          className="flex size-4 items-center justify-center rounded-[3px] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                    {addingDetailTag ? (
                      <span className="flex h-6 items-center gap-0.5 rounded-[5px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-1">
                        <input
                          autoFocus
                          aria-label={uiText('新增资源标签')}
                          style={{ fontSize: 8.5 }}
                          value={detailTagDraft}
                          onChange={(event) => setDetailTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') addDetailTag(selectedItem);
                            if (event.key === 'Escape') {
                              setAddingDetailTag(false);
                              setDetailTagDraft('');
                            }
                          }}
                          placeholder={uiText('新标签')}
                          className="w-16 bg-transparent px-1 font-normal text-[var(--ink)] outline-none"
                        />
                        <button
                          type="button"
                          aria-label={uiText('确认新增标签')}
                          onClick={() => addDetailTag(selectedItem)}
                          className="flex size-4 items-center justify-center text-[var(--accent-ink)]"
                        >
                          <Plus className="size-2.5" weight="bold" />
                        </button>
                        <button
                          type="button"
                          aria-label={uiText('取消新增标签')}
                          onClick={() => {
                            setAddingDetailTag(false);
                            setDetailTagDraft('');
                          }}
                          className="flex size-4 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={uiText('新增标签')}
                        style={{ fontSize: 8.5 }}
                        onClick={() => setAddingDetailTag(true)}
                        className="flex h-6 items-center gap-1 rounded-[5px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-2 font-normal text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--muted-strong)]"
                      >
                        <Plus className="size-3" />
                        {uiText('标签')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 px-5 py-3">
                  <div>
                    <p className="text-[9px] text-[var(--muted)]">{uiText('累计获取')}</p>
                    <p className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--ink)]">
                      {selectedItem.installs.toLocaleString(locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--muted)]">{uiText('社区评分')}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <RatingStars rating={selectedItem.rating} />
                      <span className="text-[9px] tabular-nums text-[var(--muted)]">
                        {selectedItem.rating ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="px-5 py-2">
                  {[
                    [uiText('类型'), communityTypeLabel(selectedItem.kind, locale)],
                    [uiText('领域'), communityCategoryLabel(selectedItem.category, locale)],
                    [uiText('版本'), `v${selectedItem.version}`],
                    [uiText('状态'), selectedItem.installed ? uiText('已获取') : uiText('可获取')],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 py-2 text-[10.5px]"
                    >
                      <dt className="text-[var(--muted)]">{label}</dt>
                      <dd className="truncate font-medium text-[var(--ink-soft)]">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 p-4">
                  <button
                    type="button"
                    disabled={selectedItem.installed}
                    onClick={() => acquireItem(selectedItem)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-[7px] bg-[var(--accent)] px-3 text-[11px] font-semibold text-[var(--accent-foreground)] outline-none transition-colors hover:bg-[var(--accent-strong)] disabled:bg-[var(--surface-hover)] disabled:text-[var(--ok-ink)]"
                  >
                    {selectedItem.installed ? (
                      <CheckCircle className="size-3.5" weight="fill" />
                    ) : (
                      <DownloadSimple className="size-3.5" />
                    )}
                    {selectedItem.installed
                      ? uiText('已获取')
                      : selectedItem.kind === 'agents'
                        ? uiText('获取 Agent')
                        : uiText('安装 Skill')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailId(selectedItem.id)}
                    className="fouc-action h-9 rounded-[7px] border border-[var(--line-strong)] px-3 text-[10.5px] font-medium text-[var(--ink-soft)]"
                  >
                    {uiText('查看详情')}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function RatingStars({ rating }: { rating?: number }) {
  const uiText = useTranslation(messages).t;
  if (typeof rating !== 'number')
    return <span className="text-[10px] text-[var(--muted)]">{uiText('暂无评分')}</span>;
  return (
    <span className="flex items-center gap-0.5" aria-label={uiText('{0} 星评分', { '0': rating })}>
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = rating >= value - 0.25;
        const half = !filled && rating >= value - 0.75;
        const Icon = half ? StarHalf : Star;
        return (
          <Icon
            key={value}
            className={cn(
              'size-3.5',
              filled || half ? 'text-[#dfa43c]' : 'text-[var(--line-strong)]',
            )}
            weight={filled || half ? 'fill' : 'regular'}
          />
        );
      })}
    </span>
  );
}
