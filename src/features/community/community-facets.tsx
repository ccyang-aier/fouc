'use client';

import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/community-facets.messages';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Briefcase,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  CirclesFour,
  Code,
  PenNib,
  Plugs,
  Plus,
  Robot,
  Sparkle,
  Tag,
  TextT,
} from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { SidebarResizeHandle } from '@/components/sidebar-resize';

import { communityCategoryLabel, communityTagLabel } from './community-localization';

export type CommunityTypeFilter = 'all' | 'agents' | 'skills' | 'plugins' | 'prompts';

const TYPE_ITEMS = [
  { id: 'all', label: '全部资源', icon: CirclesFour },
  { id: 'agents', label: 'Agents', icon: Robot },
  { id: 'skills', label: 'Skill', icon: Sparkle },
  { id: 'plugins', label: 'Plugin', icon: Plugs },
  { id: 'prompts', label: 'Prompt', icon: TextT },
] as const;
const DOMAIN_ITEMS = [
  { id: '研发', icon: Code, color: '#6681f5' },
  { id: '办公', icon: Briefcase, color: '#4aa78f' },
  { id: '数据', icon: ChartBar, color: '#8a70d6' },
  { id: '内容', icon: PenNib, color: '#d38b3d' },
  { id: '写作', icon: TextT, color: '#d4657c' },
] as const;
const TAG_COLORS = ['#6f86e8', '#55a68d', '#d18b42', '#9a74d6', '#d26c7d', '#4b9fc4'];
const MIN_WIDTH = 190;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 208;

export function CommunityFacets({
  type,
  domain,
  tag,
  typeCounts,
  domainCounts,
  tagCounts,
  onTypeChange,
  onDomainChange,
  onTagChange,
}: {
  type: CommunityTypeFilter;
  domain: string;
  tag: string;
  typeCounts: Record<CommunityTypeFilter, number>;
  domainCounts: Map<string, number>;
  tagCounts: Map<string, number>;
  onTypeChange: (type: CommunityTypeFilter) => void;
  onDomainChange: (domain: string) => void;
  onTagChange: (tag: string) => void;
}) {
  const { t: uiText, locale } = useTranslation(messages);
  const typeLabels = {
    all: uiText('全部资源'),
    agents: locale === 'zh-CN' ? 'Agent' : 'Agents',
    skills: locale === 'zh-CN' ? '技能' : 'Skills',
    plugins: locale === 'zh-CN' ? '插件' : 'Plugins',
    prompts: locale === 'zh-CN' ? '提示词' : 'Prompts',
  };
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [typesOpen, setTypesOpen] = useState(true);
  const [domainsOpen, setDomainsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const dragStart = useRef<{ pointerX: number; width: number } | null>(null);
  const tags = [...tagCounts.keys(), ...customTags.filter((label) => !tagCounts.has(label))];

  useEffect(() => {
    if (!dragging) return;
    function move(event: PointerEvent) {
      const start = dragStart.current;
      if (start)
        setWidth(
          Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start.width + event.clientX - start.pointerX)),
        );
    }
    function stop() {
      dragStart.current = null;
      setDragging(false);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('lostpointercapture', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('lostpointercapture', stop);
      window.removeEventListener('blur', stop);
    };
  }, [dragging]);

  function beginResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragStart.current = { pointerX: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function addTag() {
    const next = tagDraft.trim();
    if (!next) return;
    setCustomTags((current) => (current.includes(next) ? current : [...current, next]));
    setTagDraft('');
    setCreatingTag(false);
    onTagChange(next);
  }

  return (
    <aside
      aria-label={collapsed ? uiText('社区资源分类（已收起）') : uiText('社区资源分类')}
      data-surface="content"
      style={{ width: collapsed ? 44 : width, flexBasis: collapsed ? 44 : width }}
      className={cn(
        'sidebar-material relative h-full shrink-0 overflow-hidden border-r border-[var(--wt-sidebar-edge)]',
        !dragging &&
          'will-change-[width,flex-basis] transition-[width,flex-basis] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
      )}
    >
      <div
        inert={!collapsed}
        aria-hidden={!collapsed}
        className={cn(
          'absolute inset-0 flex w-11 flex-col items-center transition-[opacity,transform] duration-150',
          collapsed
            ? 'delay-100 translate-x-0 opacity-100'
            : 'pointer-events-none -translate-x-1 opacity-0',
        )}
      >
        <button
          type="button"
          aria-label={uiText('展开社区侧栏')}
          title={uiText('展开社区侧栏')}
          onClick={() => setCollapsed(false)}
          className="mt-2.5 flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none hover:bg-sidebar-hover hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <CaretRight className="size-3.5" weight="bold" />
        </button>
        <div className="mt-2 flex flex-col gap-1">
          {TYPE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = type === item.id && !domain && !tag;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={typeLabels[item.id]}
                title={typeLabels[item.id]}
                data-active={active}
                onClick={() => {
                  onTypeChange(item.id);
                  onDomainChange('');
                  onTagChange('');
                }}
                className="sidebar-nav-row flex size-8 items-center justify-center rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <Icon
                  className={cn(
                    'size-4',
                    active ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)]',
                  )}
                  weight={active ? 'fill' : 'duotone'}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div
        inert={collapsed}
        aria-hidden={collapsed}
        style={{ width }}
        className={cn(
          'absolute inset-y-0 left-0 flex flex-col overflow-y-auto px-[11px] pb-6 transition-[opacity,transform] duration-150',
          collapsed
            ? 'pointer-events-none translate-x-1 opacity-0'
            : 'delay-100 translate-x-0 opacity-100',
        )}
      >
        <div className="flex h-[47px] shrink-0 items-center justify-between px-1">
          <strong className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {uiText('社区')}
          </strong>
          <button
            type="button"
            aria-label={uiText('收起社区侧栏')}
            title={uiText('收起社区侧栏')}
            onClick={() => setCollapsed(true)}
            className="flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none hover:bg-sidebar-hover hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <CaretLeft className="size-3" weight="bold" />
          </button>
        </div>

        <FacetSection
          label={uiText('类型')}
          icon={CirclesFour}
          count={typeCounts.all}
          open={typesOpen}
          onToggle={() => setTypesOpen((open) => !open)}
        >
          {TYPE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = type === item.id && !domain && !tag;
            return (
              <FacetRow
                key={item.id}
                active={active}
                icon={<Icon className="size-4" weight={active ? 'fill' : 'duotone'} />}
                label={typeLabels[item.id]}
                count={typeCounts[item.id]}
                onClick={() => {
                  onTypeChange(item.id);
                  onDomainChange('');
                  onTagChange('');
                }}
              />
            );
          })}
        </FacetSection>

        <FacetSection
          label={uiText('领域')}
          icon={Briefcase}
          count={DOMAIN_ITEMS.length}
          open={domainsOpen}
          onToggle={() => setDomainsOpen((open) => !open)}
          className="mt-3"
        >
          {DOMAIN_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = domain === item.id;
            return (
              <FacetRow
                key={item.id}
                active={active}
                icon={
                  <Icon
                    className="size-4"
                    style={{ color: active ? 'var(--accent-ink)' : item.color }}
                    weight={active ? 'fill' : 'duotone'}
                  />
                }
                label={communityCategoryLabel(item.id, locale)}
                count={domainCounts.get(item.id) ?? 0}
                onClick={() => {
                  onDomainChange(active ? '' : item.id);
                  onTagChange('');
                }}
              />
            );
          })}
        </FacetSection>

        <FacetSection
          label={uiText('标签')}
          icon={Tag}
          count={tags.length}
          open={tagsOpen}
          onToggle={() => setTagsOpen((open) => !open)}
          className="mt-3"
          action={
            <button
              type="button"
              aria-label={uiText('新建标签')}
              title={uiText('新建标签')}
              onClick={(event) => {
                event.stopPropagation();
                setCreatingTag(true);
                setTagsOpen(true);
              }}
              className="ml-auto flex size-5 items-center justify-center rounded-[4px] text-[var(--muted)] hover:bg-sidebar-hover hover:text-[var(--ink-soft)]"
            >
              <Plus className="size-3" weight="bold" />
            </button>
          }
        >
          {creatingTag ? (
            <div className="mb-1 flex items-center gap-1 px-1">
              <input
                autoFocus
                aria-label={uiText('标签名称')}
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTag();
                  if (event.key === 'Escape') setCreatingTag(false);
                }}
                onBlur={() => {
                  if (!tagDraft.trim()) setCreatingTag(false);
                }}
                placeholder={uiText('新标签')}
                className="h-7 min-w-0 flex-1 rounded-[5px] border border-[var(--line-strong)] bg-panel px-2 text-[11px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={addTag}
                className="flex size-7 items-center justify-center rounded-[5px] bg-[var(--accent)] text-[var(--accent-foreground)]"
              >
                <Plus className="size-3" weight="bold" />
              </button>
            </div>
          ) : null}
          {tags.map((label, index) => {
            const active = tag === label;
            return (
              <FacetRow
                key={label}
                active={active}
                icon={
                  <i
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: TAG_COLORS[index % TAG_COLORS.length] }}
                  />
                }
                label={communityTagLabel(label, locale)}
                count={tagCounts.get(label) ?? 0}
                onClick={() => {
                  onTagChange(active ? '' : label);
                  onDomainChange('');
                }}
              />
            );
          })}
        </FacetSection>
      </div>
      {!collapsed && (
        <SidebarResizeHandle
          dragging={dragging}
          onPointerDown={beginResize}
          aria-label={uiText('拖拽调整社区侧栏宽度')}
        />
      )}
    </aside>
  );
}

function FacetRow({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className="sidebar-nav-row group flex h-[29px] w-full items-center gap-2 rounded-[6px] px-2 text-[11px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <span
        className={cn(
          'sidebar-nav-icon flex size-4 shrink-0 items-center justify-center',
          active
            ? 'text-[var(--accent-ink)]'
            : 'text-[var(--muted)] group-hover:text-[var(--muted-strong)]',
        )}
      >
        {icon}
      </span>
      <span className="sidebar-nav-label min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-[var(--muted)]">
        {count}
      </span>
    </button>
  );
}

function FacetSection({
  label,
  icon: Icon,
  count,
  open,
  onToggle,
  action,
  className,
  children,
}: {
  label: string;
  icon: typeof CirclesFour;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex min-h-[27px] items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-[5px] px-1.5 py-1 text-left text-[10.5px] font-normal text-[var(--muted)] outline-none hover:bg-sidebar-hover hover:text-[var(--muted-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Icon className="size-3.5 shrink-0" weight="duotone" />
          <span>{label}</span>
          <span className="font-mono text-[9px]">({count})</span>
          <CaretDown
            className={cn(
              'ml-0.5 size-2.5 transition-transform duration-150',
              !open && '-rotate-90',
            )}
            weight="fill"
          />
        </button>
        {action}
      </div>
      {open ? <div className="space-y-0.5 pl-2.5">{children}</div> : null}
    </section>
  );
}
