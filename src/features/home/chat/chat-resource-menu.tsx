'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ArrowSquareOut, CaretDown, Check, GearSix, Info, PlugsConnected, Plus, SealCheck, SlidersHorizontal } from '@phosphor-icons/react';
import { SkillIcon } from '@/components/icons/skill-icon';
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { getBuiltinSkills, toggleBuiltinSkill, useBuiltinSkills } from '@/features/skills/builtin-skills';
import { useComposerCatalog, type ComposerResource, type ComposerResourceKind, type ComposerResourceReference } from '@/features/community/composer-catalog';
import { communityCategoryLabel } from '@/features/community/community-localization';
import { ChatPickerItem, ChatPickerSearch } from './chat-picker';
import { ChatResourceInfo, ResourceIcon } from './chat-resource-info';
import { resourceMessages } from './chat-resource-messages';
import styles from './chat-resource-menu.module.css';
import addStyles from './chat-add-menu.module.css';

export function ChatResourceMenu({ kind, selected, onToggle, onCreate, onConfigure, onOpenMarket }: {
  kind: ComposerResourceKind;
  selected: ComposerResourceReference[];
  onToggle: (resource: ComposerResource) => void;
  onCreate: () => void;
  onConfigure?: () => void;
  onOpenMarket?: () => void;
}) {
  const { t, locale } = useTranslation(resourceMessages);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [marketCollapsed, setMarketCollapsed] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sideOffset, setSideOffset] = useState(8);
  const [alignOffset, setAlignOffset] = useState(0);
  const [tooltipPlacement, setTooltipPlacement] = useState<{ side: 'top' | 'bottom'; alignOffset: number }>({ side: 'bottom', alignOffset: 0 });
  const trigger = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerMode = useRef(true);
  const hidePreview = useCallback(() => {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    setPreviewId(null);
  }, []);
  const disabledBuiltinIds = useBuiltinSkills();
  const builtin = kind === 'skills' ? getBuiltinSkills(locale) : [];
  const market = useComposerCatalog(kind, locale);
  const all = [...builtin, ...market];
  const normalized = query.trim().toLocaleLowerCase(locale);
  const matches = (item: ComposerResource) => (!category || item.category === category)
    && `${item.name} ${item.description} ${item.author} ${communityCategoryLabel(item.category, locale)}`.toLocaleLowerCase(locale).includes(normalized);
  const builtinResults = builtin.filter(matches);
  const marketResults = market.filter(matches);
  const selectedCount = selected.filter(item => item.kind === kind).length;
  const Icon = kind === 'skills' ? SkillIcon : PlugsConnected;

  useLayoutEffect(() => {
    if (!open) return;
    const parentMenu = trigger.current?.closest('[role="menu"]');
    function position() {
      const bounds = trigger.current?.getBoundingClientRect();
      // Overlap the parent when neither side can fit, keeping the full menu usable.
      if (bounds) {
        const parent = parentMenu?.getBoundingClientRect() ?? bounds;
        const inset = Math.max(parent.right - bounds.right, bounds.left - parent.left);
        // Radix offsets from the inset trigger; the visible menu surfaces need a 6px gap.
        setSideOffset(Math.min(6 + inset, Math.max(bounds.left - 12, window.innerWidth - bounds.right - 12) - Math.min(284, window.innerWidth - 24)));
        setAlignOffset(parent.top - bounds.top);
      }
    }
    position();
    const placement = new MutationObserver(position);
    if (parentMenu?.parentElement) placement.observe(parentMenu.parentElement, { attributes: true, attributeFilter: ['style'] });
    const resize = () => { hidePreview(); position(); };
    window.addEventListener('resize', resize);
    return () => {
      placement.disconnect(); window.removeEventListener('resize', resize);
      if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    };
  }, [open, hidePreview]);

  function toggleCategory(value: string) {
    setCategory(value);
    setCategoryOpen(false);
    hidePreview();
    search.current?.focus();
  }

  function showPreview(id: string, row: HTMLElement) {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    const bounds = row.getBoundingClientRect();
    const width = Math.min(264, window.innerWidth - 24);
    // A modest stagger keeps the card visibly attached to the current row.
    const right = bounds.left + 136;
    const left = bounds.right - width - 136;
    const preferred = right + width <= window.innerWidth - 12 || bounds.left < window.innerWidth - bounds.right ? right : left;
    const x = Math.max(12, Math.min(preferred, window.innerWidth - width - 12));
    const side = bounds.top + bounds.height / 2 < window.innerHeight / 2 ? 'bottom' : 'top';
    setTooltipPlacement({ side, alignOffset: x - bounds.left });
    setPreviewId(id);
  }

  function schedulePreview(id: string, row: HTMLElement) {
    if (previewTimer.current !== null || previewId === id) return;
    previewTimer.current = setTimeout(() => showPreview(id, row), 650);
  }

  function renderResource(resource: ComposerResource, builtin = false) {
    const checked = builtin ? !disabledBuiltinIds.includes(resource.id) : selected.some(item => item.id === resource.id && item.kind === kind);
    return <Tooltip key={resource.id} open={previewId === resource.id} delayDuration={0} disableHoverableContent
      onOpenChange={next => { if (!next) setPreviewId(current => current === resource.id ? null : current); }}>
      <TooltipTrigger asChild><ChatPickerItem className={styles.resourceRow} role="menuitemcheckbox" aria-checked={checked}
        textValue={resource.name} aria-label={resource.name}
        onPointerEnter={event => {
          if (event.pointerType !== 'mouse') return;
          pointerMode.current = true;
          hidePreview();
          schedulePreview(resource.id, event.currentTarget);
        }} onPointerMove={event => { if (event.pointerType === 'mouse') schedulePreview(resource.id, event.currentTarget); }}
        onPointerLeave={hidePreview}
        onFocus={event => { if (!pointerMode.current) showPreview(resource.id, event.currentTarget); }}
        onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); showPreview(resource.id, event.currentTarget); } }}
        onSelect={event => { event.preventDefault(); hidePreview(); if (builtin) toggleBuiltinSkill(resource.id); else onToggle(resource); }}>
        <ResourceIcon resource={resource} />
        <span className={styles.resourceName}>{resource.name}</span>
        {checked ? <span className={styles.check} data-builtin={builtin} aria-hidden="true">
          {builtin ? <SealCheck size={16} data-static-color /> : <Check size={14} weight="bold" data-static-color />}
        </span> : null}
        <button type="button" tabIndex={-1} className={`fouc-action ${styles.infoButton}`} aria-label={t('details', { name: resource.name })}
          onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); showPreview(resource.id, event.currentTarget.parentElement!); }}><Info size={15} /></button>
      </ChatPickerItem></TooltipTrigger>
      <ChatResourceInfo resource={resource} {...tooltipPlacement} onEscape={() => { hidePreview(); search.current?.focus(); }} />
    </Tooltip>;
  }

  return <DropdownMenuSub open={open} onOpenChange={next => {
    setOpen(next); hidePreview(); setCategoryOpen(false);
    if (next) { setQuery(''); setCategory(''); }
  }}>
    <DropdownMenuSubTrigger ref={trigger} className={addStyles.item} aria-label={t(kind)}
      aria-description={selectedCount ? t('selectedCount', { count: selectedCount }) : undefined}>
      <Icon className={addStyles.neutralIcon} data-resource-kind={kind} data-static-color aria-hidden="true" />
      <span className={styles.triggerLabel}><span>{t(kind)}</span>
        {selectedCount ? <span className={`${styles.resourceTone} ${styles.triggerCount}`} data-resource-kind={kind} aria-hidden="true">{selectedCount}</span> : null}
      </span>
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent ref={menu} className={styles.menu} collisionPadding={12} sideOffset={sideOffset} alignOffset={alignOffset}
      aria-label={t(kind)}
      onKeyDownCapture={() => { pointerMode.current = false; hidePreview(); }} onPointerDownCapture={() => { pointerMode.current = true; }}
      onFocusOutside={event => {
        // Radix briefly focuses the parent container while crossing an overlapping submenu.
        const target = event.target;
        if (target instanceof HTMLElement && target.getAttribute('role') === 'menu' && target.contains(trigger.current)) event.preventDefault();
      }}
      onEscapeKeyDown={event => { if (previewId || categoryOpen) { event.preventDefault(); hidePreview(); setCategoryOpen(false); search.current?.focus(); } }}>
      <div className={styles.toolbar} onPointerEnter={hidePreview} onKeyDown={event => { if (event.key === 'Tab') event.stopPropagation(); }}>
        <ChatPickerSearch ref={search} value={query} aria-label={t(kind === 'skills' ? 'searchSkills' : 'searchMcp')}
          placeholder={t(kind === 'skills' ? 'searchSkills' : 'searchMcp')} onChange={event => { setQuery(event.target.value); hidePreview(); }} />
        <Button type="button" variant="ghost" className={styles.toolbarButton} aria-label={t('category')} aria-expanded={categoryOpen}
          title={t('category')} data-active={Boolean(category)} onClick={() => { setCategoryOpen(value => !value); hidePreview(); }}><SlidersHorizontal size={16} weight="bold" /></Button>
        <Button type="button" variant="ghost" className={styles.toolbarButton} aria-label={t(kind === 'skills' ? 'addSkill' : 'addMcp')}
          title={t(kind === 'skills' ? 'addSkill' : 'addMcp')} onClick={onCreate}><Plus size={16} weight="bold" /></Button>
      </div>
      {categoryOpen || category ? <div className={styles.categories} role="group" aria-label={t('category')}>
        {['', ...new Set(all.map(item => item.category))].map(value => <button key={value} type="button" className={`fouc-action ${styles.category}`}
          aria-pressed={category === value} data-active={category === value} onClick={() => toggleCategory(value)}>{value ? communityCategoryLabel(value, locale) : t('all')}</button>)}
      </div> : null}
      <ScrollArea className={styles.list} viewportClassName={styles.viewport} onScrollCapture={hidePreview}
        onKeyDown={event => { if (event.key === 'Tab') event.stopPropagation(); }}>
        {kind === 'skills' && builtinResults.length ? <section className={styles.section} aria-label={t('builtin')}>
          <div className={`fouc-menu-item ${styles.sectionHeading}`} data-variant="group" onPointerEnter={hidePreview}>
            <button type="button" className={`fouc-action ${styles.collapse}`} data-variant="disclosure" aria-expanded={!collapsed}
              onClick={() => { setCollapsed(value => !value); hidePreview(); }}><CaretDown size={10} data-collapsed={collapsed} />{t('builtin')}</button>
            <button type="button" className={`fouc-action ${styles.configure}`} data-variant="disclosure" aria-label={t('configure')} title={t('configure')} onClick={onConfigure}><GearSix size={15} weight="bold" /></button>
          </div>
          {!collapsed ? builtinResults.map(item => renderResource(item, true)) : null}
        </section> : null}
        {marketResults.length ? <section className={styles.section} aria-label={t(kind === 'skills' ? 'market' : 'mcpMarket')}>
          {kind === 'skills' ? <div className={`fouc-menu-item ${styles.sectionHeading}`} data-variant="group" onPointerEnter={hidePreview}>
            <button type="button" className={`fouc-action ${styles.collapse}`} data-variant="disclosure" aria-expanded={!marketCollapsed}
              onClick={() => { setMarketCollapsed(value => !value); hidePreview(); }}><CaretDown size={10} data-collapsed={marketCollapsed} />{t('market')}</button>
            <button type="button" className={`fouc-action ${styles.configure}`} data-variant="disclosure" aria-label={t('openMarket')} title={t('openMarket')}
              onClick={onOpenMarket}><ArrowSquareOut size={15} weight="bold" /></button>
          </div> : null}
          {kind === 'mcp' || !marketCollapsed ? marketResults.map(item => renderResource(item)) : null}
        </section> : null}
        {!builtinResults.length && !marketResults.length ? <div className={styles.empty} role="status"><Icon size={25} /><strong>{t('empty')}</strong><span>{t('emptyHint')}</span>
          <Button variant="ghost" size="sm" onClick={() => { setQuery(''); toggleCategory(''); }}>{t('clear')}</Button></div> : null}
      </ScrollArea>
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
