'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowClockwise, CaretDown, MagnifyingGlass, ShieldCheck, SlidersHorizontal, UserPlus, UsersThree, X } from '@phosphor-icons/react';
import { canManageProjectMember, type ProjectMembers } from '@fouc/shared/projects';
import { AppAlert } from '@/components/app-alert';
import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViewSwitcher } from '@/components/ui/view-switcher';
import { useIdentity } from '@/features/identity/identity-provider';
import { useTranslation } from '@/lib/i18n';
import { usePageVisible } from '@/lib/page-visibility';
import { usePageSessionState } from '@/lib/page-session-state';
import { projectClient, ProjectRequestError } from '../project-client';
import { useProjectResources } from '../project-resources';
import { MemberCollection } from './member-collection';
import { MemberDialog, type MemberAction } from './member-dialogs';
import { messages } from './members.messages';
import styles from './members.module.css';

export function ProjectMembersPage() {
  const { t } = useTranslation(messages);
  const { selectedProject, scopeKey } = useProjectResources();
  const { session, openSignIn } = useIdentity();
  if (selectedProject?.source !== 'server' || session.status !== 'authenticated') return <section className={styles.page} aria-label={t('title')}><header className={styles.header}><h1>{t('title')}</h1></header><div className={styles.empty}><UsersThree size={32} /><h2>{t('localTitle')}</h2><p>{t('localDescription')}</p>{session.status !== 'authenticated' && <Button size="sm" onClick={openSignIn}>{t('signIn')}</Button>}</div></section>;
  return <MembersScope key={scopeKey} projectId={selectedProject.id} actorId={session.user.id} />;
}

function MembersScope(props: { projectId: string; actorId: string }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }));
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}><MembersContent {...props} /></QueryClientProvider>;
}

function MembersContent({ projectId, actorId }: { projectId: string; actorId: string }) {
  const { t } = useTranslation(messages);
  const { notify } = useAppAlert();
  const cache = useQueryClient();
  const visible = usePageVisible();
  const searchInput = useRef<HTMLInputElement>(null);
  const tabsId = useId();
  const pending = useRef(false);
  const [tab, setTab] = usePageSessionState<'all' | 'managers'>('members:tab', 'all');
  const [mode, setMode] = usePageSessionState<'grid' | 'list'>('members:view', 'grid');
  const [search, setSearch] = usePageSessionState<string>('members:search', '');
  const [role, setRole] = usePageSessionState<string>('members:role', 'all');
  const [dialog, setDialog] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['project-members', projectId], queryFn: ({ signal }) => projectClient.members(projectId, signal), enabled: visible, refetchInterval: visible && !dialog ? 30_000 : false });
  const revoked = query.error instanceof ProjectRequestError && [401, 403, 404].includes(query.error.status);
  const data = revoked ? undefined : query.data;
  const members = data?.items ?? [];
  const managers = members.filter(member => ['owner', 'admin'].includes(member.role));
  const term = search.trim().toLocaleLowerCase();
  const matching = (tab === 'managers' ? managers : members).filter(member => (role === 'all' || role === member.role) && `${member.name} ${member.email}`.toLocaleLowerCase().includes(term));
  const selected = members.find(member => member.userId === dialog);
  const canAdd = data && canManageProjectMember(data.actorRole, 'member');
  useEffect(() => {
    if (!visible || dialog) return;
    function shortcut(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); searchInput.current?.focus(); } }
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [visible, dialog]);
  function open(id: string) { setError(null); setDialog(id); }
  async function mutate(action: MemberAction) {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(null);
    await cache.cancelQueries({ queryKey: ['project-members', projectId] });
    try {
      const result: ProjectMembers = action.kind === 'add' ? await projectClient.addMember(projectId, action.email, action.role)
        : action.kind === 'role' ? await projectClient.updateMember(projectId, action.userId, action.role) : await projectClient.removeMember(projectId, action.userId);
      cache.setQueryData(['project-members', projectId], result);
      notify('success', t(action.kind === 'add' ? 'added' : action.kind === 'role' ? 'saved' : 'removed'));
      return true;
    } catch (cause) {
      const code = cause instanceof ProjectRequestError ? cause.code : '';
      setError(t(code === 'PROJECT_ACCOUNT_NOT_FOUND' ? 'missingAccount' : code === 'PROJECT_MEMBER_EXISTS' ? 'duplicate' : ['FORBIDDEN', 'PROJECT_NOT_FOUND', 'PROJECT_MEMBER_NOT_FOUND'].includes(code) ? 'accessChanged' : 'failed'));
      if (cause instanceof ProjectRequestError && [401, 403, 404].includes(cause.status) && code !== 'PROJECT_ACCOUNT_NOT_FOUND') void query.refetch();
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  const filtered = Boolean(term || role !== 'all' || tab !== 'all');
  return <section className={styles.page} aria-label={t('title')}>
    <header className={styles.header}><h1>{t('title')}</h1><div className={styles.headerActions}><Button type="button" variant="ghost" size="icon-sm" className={styles.refresh} aria-label={t('refresh')} disabled={query.isFetching || busy} onClick={() => void query.refetch()}><ArrowClockwise size={17} /></Button>{canAdd && <Button size="sm" className={styles.add} onClick={() => open('add')}><UserPlus size={16} />{t('add')}</Button>}</div></header>
    <div className={styles.tabs} role="tablist" aria-label={t('title')}>{(['all', 'managers'] as const).map(value => { const Icon = value === 'all' ? UsersThree : ShieldCheck; return <button key={value} id={`${tabsId}-${value}`} type="button" role="tab" aria-selected={tab === value} aria-controls={`${tabsId}-content`} tabIndex={tab === value ? 0 : -1} className={`fouc-action ${styles.tab}`} onClick={() => setTab(value)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'all' : event.key === 'End' ? 'managers' : value === 'all' ? 'managers' : 'all';
      setTab(next); document.getElementById(`${tabsId}-${next}`)?.focus();
    }}><Icon size={16} />{t(value)}<span>{value === 'all' ? members.length : managers.length}</span></button>; })}</div>
    <div role="tabpanel" id={`${tabsId}-content`} aria-labelledby={`${tabsId}-${tab}`}>
    <div className={styles.toolbar}><div className={styles.sectionTitle}><h2>{t(tab === 'all' ? 'projectMembers' : 'managers')}</h2><span aria-live="polite">{t('count', { count: matching.length })}</span></div><div className={styles.tools}>
      <div className={styles.search}><MagnifyingGlass size={16} /><input ref={searchInput} type="search" aria-label={t('search')} placeholder={t('search')} value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" className="fouc-action" aria-label={t('clearSearch')} onClick={() => setSearch('')}><X size={12} /></button>}</div>
      <DropdownMenu><DropdownMenuTrigger type="button" className={styles.filter} data-surface="plain" data-active={role !== 'all' || undefined} aria-label={t('filter')}><SlidersHorizontal size={16} /><span>{t(role === 'all' ? 'filter' : role as 'owner' | 'admin' | 'member' | 'guest')}</span><CaretDown size={10} /></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact"><DropdownMenuRadioGroup value={role} onValueChange={setRole}>{(['all', 'owner', 'admin', 'member', 'guest'] as const).map(value => <DropdownMenuRadioItem key={value} value={value} indicator="none" emphasizeSelection={value !== 'all'}>{t(value === 'all' ? 'allRoles' : value)}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
      <ViewSwitcher value={mode} onValueChange={setMode} listLabel={t('list')} gridLabel={t('grid')} />
    </div></div>
    {query.isError && <div className={styles.loadError}><AppAlert tone="error" title={t('loadFailed')} action={<button type="button" onClick={() => void query.refetch()}>{t('retry')}</button>} /></div>}
    {query.isPending ? <div className={styles.loading} role="status" aria-label={t('loading')}>{Array.from({ length: 4 }, (_, i) => <div key={i} />)}</div>
      : matching.length ? <MemberCollection members={matching} actorId={actorId} mode={mode} onOpen={member => open(member.userId)} />
      : !query.isError && <div className={styles.empty}><UsersThree size={32} /><h2>{t(filtered ? 'noMatches' : 'empty')}</h2>{filtered && <><p>{t('noMatchesDescription')}</p><Button type="button" size="sm" variant="outline" onClick={() => { setSearch(''); setRole('all'); setTab('all'); }}>{t('clearFilters')}</Button></>}</div>}
    </div>
    {data && ((dialog === 'add' && canAdd) || selected) && <MemberDialog key={dialog} member={selected} actorRole={data.actorRole} busy={busy} error={error} onClose={() => setDialog(null)} onSubmit={mutate} />}
  </section>;
}
