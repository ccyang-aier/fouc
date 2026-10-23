'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ClipboardText, FolderPlus, MagnifyingGlass, Plus, SlidersHorizontal, Stack, UserCircleGear, UserPlus, UsersThree, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViewSwitcher } from '@/components/ui/view-switcher';
import { useAppAlert } from '@/components/app-alert-provider';
import { usePageVisible } from '@/lib/page-visibility';
import { usePageSessionState } from '@/lib/page-session-state';
import { useProjectResources } from '../project-resources';
import { MemberCollection } from './member-collection';
import { DepartmentDialog, MemberDialog } from './member-dialogs';
import { memberStatuses, referenceMembers, type DirectoryMember, type MemberStatus } from './members.data';
import { messages } from './members.messages';
import { useTranslation } from '@/lib/i18n';
import styles from './members.module.css';

type Panel = { kind: 'member'; id?: string; department?: string } | { kind: 'department' } | null;
export function ProjectMembersPage() {
  const { scopeKey } = useProjectResources();
  return <MembersPreview key={scopeKey ?? 'reference'} />;
}
function MembersPreview() {
  const { t, locale } = useTranslation(messages);
  const { notify } = useAppAlert();
  const visible = usePageVisible();
  const searchInput = useRef<HTMLInputElement>(null);
  const tabsId = useId();
  const [members, setMembers] = usePageSessionState<DirectoryMember[]>('members-reference:directory', referenceMembers);
  const [tab, setTab] = usePageSessionState<'overview' | 'departments'>('members-reference:tab', 'overview');
  const [mode, setMode] = usePageSessionState<'grid' | 'list'>('members-reference:view', 'grid');
  const [search, setSearch] = usePageSessionState<string>('members-reference:search', '');
  const [status, setStatus] = usePageSessionState<MemberStatus | 'all'>('members-reference:status', 'all');
  const [extraDepartments, setExtraDepartments] = usePageSessionState<string[]>('members-reference:departments', []);
  const [panel, setPanel] = useState<Panel>(null);
  const departments = [...new Set([...members.map(member => member.department).filter(Boolean), ...extraDepartments])];
  const term = search.trim().toLocaleLowerCase();
  const matching = members.filter(member => (status === 'all' || status === member.status) && [member.name, member.email, member.position, member.department].some(value => value.toLocaleLowerCase().includes(term)));
  const selected = panel?.kind === 'member' ? members.find(member => member.id === panel.id) : undefined;
  useEffect(() => {
    if (!visible || panel) return;
    function shortcut(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); searchInput.current?.focus(); } }
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [visible, panel]);
  function open(member: DirectoryMember) { setPanel({ kind: 'member', id: member.id }); }
  function save(member: DirectoryMember) {
    const exists = members.some(item => item.id === member.id);
    setMembers(current => exists ? current.map(item => item.id === member.id ? member : item) : [...current, member]);
    notify('success', t(exists ? 'saved' : 'added'));
  }
  const filtered = Boolean(term || status !== 'all');
  return <section className={styles.page} aria-label={t('title')} lang={locale}>
    <header className={styles.header}><div className={styles.heading}><span>{t('title')}</span><h1>{t('title')}</h1></div>
      <div className={styles.headerActions}>
        <Button size="sm" className={styles.add} onClick={() => setPanel({ kind: 'member' })}><UserPlus size={18} />{t('add')}</Button>
        <Button size="sm" variant="outline" className={styles.departmentAction} onClick={() => setPanel({ kind: 'department' })}><FolderPlus size={19} /><span>{t('newDepartment')}</span></Button>
        <DropdownMenu><DropdownMenuTrigger className={styles.newAction}><ClipboardText size={18} />{t('new')}</DropdownMenuTrigger><DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem onSelect={() => setPanel({ kind: 'member' })}><UserPlus size={16} />{t('add')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPanel({ kind: 'department' })}><FolderPlus size={16} />{t('newDepartment')}</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
      </div>
    </header>
    <div className={styles.tabs} role="tablist" aria-label={t('title')}>{(['departments', 'overview'] as const).map(value => { const Icon = value === 'overview' ? UserCircleGear : Stack; return <button key={value} id={`${tabsId}-${value}`} type="button" role="tab" aria-selected={tab === value} aria-controls={`${tabsId}-content`} tabIndex={tab === value ? 0 : -1} className={`fouc-action ${styles.tab}`} onClick={() => setTab(value)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'departments' : event.key === 'End' ? 'overview' : value === 'overview' ? 'departments' : 'overview';
      setTab(next); document.getElementById(`${tabsId}-${next}`)?.focus();
    }}><Icon size={17} />{t(value)}</button>; })}</div>
    <div role="tabpanel" id={`${tabsId}-content`} aria-labelledby={`${tabsId}-${tab}`}>
      <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>{t('members')}</h2><span className="sr-only" aria-live="polite">{t('count', { count: matching.length })}</span></div><div className={styles.tools}>
        <div className={styles.search}><MagnifyingGlass size={20} /><input ref={searchInput} type="search" aria-label={t('search')} placeholder={t('search')} value={search} onChange={event => setSearch(event.target.value)} />{search ? <button type="button" className="fouc-action" aria-label={t('clearSearch')} onClick={() => setSearch('')}><X size={12} /></button> : <kbd aria-hidden>⌘ F</kbd>}</div>
        <DropdownMenu><DropdownMenuTrigger className={styles.filter} data-surface="plain" data-active={status !== 'all' || undefined} aria-label={t('filter')}><SlidersHorizontal size={18} /><span>{status === 'all' ? t('filter') : t(status)}</span></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact"><DropdownMenuRadioGroup value={status} onValueChange={value => setStatus(value as MemberStatus | 'all')}><DropdownMenuRadioItem value="all" indicator="none" emphasizeSelection={false}>{t('allStatuses')}</DropdownMenuRadioItem>{memberStatuses.map(value => <DropdownMenuRadioItem key={value} value={value} indicator="none">{t(value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
        <ViewSwitcher value={mode} onValueChange={setMode} listLabel={t('list')} gridLabel={t('grid')} />
      </div></div>
      {tab === 'overview' && matching.length > 0 && <MemberCollection members={matching} mode={mode} onOpen={open} />}
      {tab === 'departments' && <div className={styles.departmentBoard}>{departments.filter(department => !filtered || matching.some(member => member.department === department)).map(department => <section key={department} className={styles.departmentColumn}><header><h3>{department}<span>{matching.filter(member => member.department === department).length}</span></h3><Button type="button" size="icon-sm" variant="ghost" aria-label={t('newMemberIn', { department })} onClick={() => setPanel({ kind: 'member', department })}><Plus size={16} /></Button></header><MemberCollection members={matching.filter(member => member.department === department)} mode="grid" onOpen={open} /></section>)}</div>}
      {!matching.length && <div className={styles.empty}><UsersThree size={32} /><h2>{t(filtered ? 'noMatches' : 'empty')}</h2>{filtered && <Button type="button" size="sm" variant="outline" onClick={() => { setSearch(''); setStatus('all'); }}>{t('clearFilters')}</Button>}</div>}
    </div>
    {panel?.kind === 'member' && <MemberDialog key={panel.id ?? 'new'} member={selected} initialDepartment={panel.department} departments={departments} onClose={() => setPanel(null)} onSave={save} onRemove={id => { setMembers(current => current.filter(member => member.id !== id)); notify('success', t('removed')); }} />}
    {panel?.kind === 'department' && <DepartmentDialog departments={departments} onClose={() => setPanel(null)} onSave={department => { setExtraDepartments(current => [...current, department]); setTab('departments'); setSearch(''); setStatus('all'); notify('success', t('departmentCreated')); }} />}
  </section>;
}
