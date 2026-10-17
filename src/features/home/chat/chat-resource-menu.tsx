'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { BookOpenText, CaretDown, Check, FunnelSimple, GearSix, Info, PlugsConnected, Plus } from '@phosphor-icons/react';
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/lib/i18n';
import { getBuiltinSkills, toggleBuiltinSkill, useBuiltinSkills } from '@/features/skills/builtin-skills';
import { useComposerCatalog, type ComposerResource, type ComposerResourceKind, type ComposerResourceReference } from '@/features/community/composer-catalog';
import { communityCategoryLabel } from '@/features/community/community-localization';
import { ChatPickerItem, ChatPickerSearch } from './chat-picker';
import { ChatResourceInfo, ResourceIcon } from './chat-resource-info';
import { resourceMessages } from './chat-resource-messages';
import styles from './chat-resource-menu.module.css';
import addStyles from './chat-add-menu.module.css';

export function ChatResourceMenu({ kind, selected, onToggle, onCreate, onConfigure }: {
  kind: ComposerResourceKind;
  selected: ComposerResourceReference[];
  onToggle: (resource: ComposerResource) => void;
  onCreate: () => void;
  onConfigure?: () => void;
}) {
  const { t, locale } = useTranslation(resourceMessages);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sideOffset, setSideOffset] = useState(8);
  const [alignOffset, setAlignOffset] = useState(0);
  const trigger = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const disabledBuiltinIds = useBuiltinSkills();
  const builtin = kind === 'skills' ? getBuiltinSkills(locale) : [];
  const market = useComposerCatalog(kind, locale);
  const all = [...builtin, ...market];
  const normalized = query.trim().toLocaleLowerCase(locale);
  const matches = (item: ComposerResource) => (!category || item.category === category)
    && `${item.name} ${item.description} ${item.author} ${communityCategoryLabel(item.category, locale)}`.toLocaleLowerCase(locale).includes(normalized);
  const builtinResults = builtin.filter(matches);
  const marketResults = market.filter(matches);
  const preview = all.find(item => item.id === previewId);
  const selectedCount = selected.filter(item => item.kind === kind).length;
  const Icon = kind === 'skills' ? BookOpenText : PlugsConnected;

  useLayoutEffect(() => {
    if (!open) return;
    const parentMenu = trigger.current?.closest('[role="menu"]');
    function position() {
      const bounds = trigger.current?.getBoundingClientRect();
      // Overlap the parent when neither side can fit, keeping the full menu usable.
      if (bounds) {
        setSideOffset(Math.min(6, Math.max(bounds.left - 12, window.innerWidth - bounds.right - 12) - Math.min(284, window.innerWidth - 24)));
        setAlignOffset((parentMenu?.getBoundingClientRect().top ?? bounds.top) - bounds.top);
      }
    }
    position();
    const placement = new MutationObserver(position);
    if (parentMenu?.parentElement) placement.observe(parentMenu.parentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', position);
    return () => { placement.disconnect(); window.removeEventListener('resize', position); };
  }, [open]);

  function toggleCategory(value: string) {
    setCategory(value);
    setCategoryOpen(false);
    setPreviewId(null);
    search.current?.focus();
  }

  function renderResource(resource: ComposerResource, builtin = false) {
    const checked = builtin ? !disabledBuiltinIds.includes(resource.id) : selected.some(item => item.id === resource.id && item.kind === kind);
    return <ChatPickerItem key={resource.id} className={styles.resourceRow} role="menuitemcheckbox" aria-checked={checked}
      textValue={resource.name} aria-label={resource.name}
      onPointerMove={event => { if (event.pointerType === 'mouse' && window.innerWidth > 760) setPreviewId(resource.id); }}
      onFocus={() => { if (window.innerWidth > 760) setPreviewId(resource.id); }}
      onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); setPreviewId(resource.id); } }}
      onSelect={event => { event.preventDefault(); if (builtin) toggleBuiltinSkill(resource.id); else onToggle(resource); }}>
      <ResourceIcon resource={resource} />
      <span className={styles.resourceName}>{resource.name}</span>
      {checked ? <Check className={styles.check} size={13} data-static-color aria-hidden="true" /> : null}
      <button type="button" tabIndex={-1} className={`fouc-action ${styles.infoButton}`} aria-label={t('details', { name: resource.name })}
        onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setPreviewId(resource.id); }}><Info size={15} /></button>
    </ChatPickerItem>;
  }

  return <DropdownMenuSub open={open} onOpenChange={next => {
    setOpen(next); setPreviewId(null); setCategoryOpen(false);
    if (next) { setQuery(''); setCategory(''); }
  }}>
    <DropdownMenuSubTrigger ref={trigger} className={addStyles.item} aria-label={t(kind)}>
      <Icon className={addStyles.neutralIcon} aria-hidden="true" /><span>{t(kind)}</span>
      {selectedCount ? <span className={styles.triggerCount} aria-hidden="true">{selectedCount}</span> : null}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent ref={menu} className={styles.menu} collisionPadding={12} sideOffset={sideOffset} alignOffset={alignOffset}
      aria-label={t(kind)}
      onFocusOutside={event => {
        // Radix briefly focuses the parent container while crossing an overlapping submenu.
        const target = event.target;
        if (target instanceof HTMLElement && target.getAttribute('role') === 'menu' && target.contains(trigger.current)) event.preventDefault();
      }}
      onEscapeKeyDown={event => { if (previewId || categoryOpen) { event.preventDefault(); setPreviewId(null); setCategoryOpen(false); search.current?.focus(); } }}>
      <div className={styles.toolbar} onPointerEnter={() => setPreviewId(null)} onKeyDown={event => { if (event.key === 'Tab') event.stopPropagation(); }}>
        <ChatPickerSearch ref={search} value={query} aria-label={t(kind === 'skills' ? 'searchSkills' : 'searchMcp')}
          placeholder={t(kind === 'skills' ? 'searchSkills' : 'searchMcp')} onChange={event => { setQuery(event.target.value); setPreviewId(null); }} />
        <Button type="button" variant="ghost" className={styles.toolbarButton} aria-label={t('category')} aria-expanded={categoryOpen}
          title={t('category')} data-active={Boolean(category)} onClick={() => { setCategoryOpen(value => !value); setPreviewId(null); }}><FunnelSimple size={15} /></Button>
        <Button type="button" variant="ghost" className={styles.toolbarButton} aria-label={t(kind === 'skills' ? 'addSkill' : 'addMcp')}
          title={t(kind === 'skills' ? 'addSkill' : 'addMcp')} onClick={onCreate}><Plus size={16} /></Button>
      </div>
      {categoryOpen || category ? <div className={styles.categories} role="group" aria-label={t('category')}>
        {['', ...new Set(all.map(item => item.category))].map(value => <button key={value} type="button" className={`fouc-action ${styles.category}`}
          aria-pressed={category === value} data-active={category === value} onClick={() => toggleCategory(value)}>{value ? communityCategoryLabel(value, locale) : t('all')}</button>)}
      </div> : null}
      <ScrollArea className={styles.list} viewportClassName={styles.viewport} onPointerLeave={event => {
        const target = event.relatedTarget;
        if (!(target instanceof Node) || !event.currentTarget.parentElement?.contains(target)) setPreviewId(null);
      }}>
        {kind === 'skills' && builtinResults.length ? <section className={styles.section} aria-label={t('builtin')}>
          <div className={styles.sectionHeading}>
            <button type="button" className={`fouc-action ${styles.collapse}`} data-variant="collapsible" aria-expanded={!collapsed}
              onClick={() => { setCollapsed(value => !value); setPreviewId(null); }}><CaretDown size={10} data-collapsed={collapsed} />{t('builtin')}</button>
            <button type="button" className={`fouc-action ${styles.configure}`} aria-label={t('configure')} title={t('configure')} onClick={onConfigure}><GearSix size={14} /></button>
          </div>
          {!collapsed ? builtinResults.map(item => renderResource(item, true)) : null}
        </section> : null}
        {marketResults.length ? <section className={styles.section} aria-label={t(kind === 'skills' ? 'market' : 'mcpMarket')}>
          {kind === 'skills' ? <div className={styles.sectionHeading}><span className={styles.marketHeading}>{t('market')}</span></div> : null}
          {marketResults.map(item => renderResource(item))}
        </section> : null}
        {!builtinResults.length && !marketResults.length ? <div className={styles.empty} role="status"><Icon size={25} /><strong>{t('empty')}</strong><span>{t('emptyHint')}</span>
          <Button variant="ghost" size="sm" onClick={() => { setQuery(''); toggleCategory(''); }}>{t('clear')}</Button></div> : null}
      </ScrollArea>
      {preview ? <ChatResourceInfo resource={preview} anchor={menu} onClose={() => { setPreviewId(null); search.current?.focus(); }} /> : null}
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
}
