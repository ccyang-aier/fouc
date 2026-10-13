'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bell, CaretRight, Check, ClockCounterClockwise, DotsThree, FolderSimple, MagnifyingGlass, ShareNetwork, UsersThree } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { AppAlert } from '@/components/app-alert';
import { DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ActivityMap, MilestoneTracker } from './dashboard-charts';
import { DashboardActionDialog, DashboardDeleteDialog, type DashboardAction } from './dashboard-actions';
import { ActivityPanel, MeetingsPanel, TeamPanel, TodayProjects } from './dashboard-panels';
import { DashboardSidebar, type DashboardSection } from './dashboard-sidebar';
import { DashboardTaskDialog } from './dashboard-task-dialog';
import { AvatarGroup, DashboardButton, IconButton, ReferenceIcon, SegmentedControl } from './dashboard-ui';
import { useDashboard } from './use-dashboard';
import type { DashboardPersonId, DashboardStatus, DashboardTask } from './dashboard-model';
import { DashboardMenu as DropdownMenu, DashboardMenuContent as DropdownMenuContent } from './dashboard-menu';
import styles from './dashboard.module.css';

const shortcuts = [
  { label: 'Send a invoice', icon: 'invoice' }, { label: 'Draft a Proposal', icon: 'proposal' }, { label: 'Create a contract', icon: 'contract' }, { label: 'Add a form', icon: 'form' },
] as const;

function subscribeCompactNavigation(listener: () => void) {
  const query = window.matchMedia('(max-width: 1060px)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
const compactNavigation = () => window.matchMedia('(max-width: 1060px)').matches;

export function ProjectDashboard({ projectId, projectName, source, onBack }: { projectId: string; projectName: string; source: 'local' | 'server'; onBack: () => void }) {
  const { state, storageError, saveTask, createTask, removeTask } = useDashboard(`${source}:${projectId}`);
  const [section, setSection] = useState<DashboardSection>('Dashboard');
  const autoCollapsed = useSyncExternalStore(subscribeCompactNavigation, compactNavigation, () => false);
  const [collapsedPreference, setCollapsedPreference] = useState<boolean | null>(null);
  const collapsed = collapsedPreference ?? autoCollapsed;
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [status, setStatus] = useState<DashboardStatus | 'All'>('All');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [action, setAction] = useState<DashboardAction | null>(null);
  const [deleting, setDeleting] = useState<DashboardTask | null>(null);
  const [invited, setInvited] = useState<DashboardPersonId[]>(['jerome', 'kiara', 'tania', 'joe', 'cameron']);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const scrollArea = useRef<HTMLDivElement>(null);
  const { notify } = useAppAlert();
  const task = state.tasks.find(item => item.id === taskId);
  const filteredTasks = state.tasks.filter(item => (!query.trim() || `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(query.trim().toLowerCase())) && (status === 'All' || item.status === status));

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('dashboardTask');
    if (id) queueMicrotask(() => setTaskId(id));
  }, []);

  function changeSection(next: DashboardSection) { setSection(next); setQuery(''); setStatus('All'); scrollArea.current?.scrollTo({ top: 0 }); }
  function openTask(id: string) {
    if (id === 'meeting') { setAction('Dev Sync Meeting'); return; }
    if (id === 'abc') { changeSection('Portfolio'); return; }
    setTaskId(id);
  }
  function closeTask() {
    setTaskId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('dashboardTask')) { url.searchParams.delete('dashboardTask'); window.history.replaceState(null, '', url); }
  }
  function persistTask(next: DashboardTask) { saveTask(next); setRecentlySaved(true); }
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); notify('success', 'Dashboard link copied'); }
    catch { notify('error', 'Could not copy the link'); }
  }
  function exportActivity() {
    const body = state.activities.map(item => `${item.actor} ${item.text} ${item.subject} — ${item.time}`).join('\n');
    const blobUrl = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = blobUrl; link.download = 'project-activity.txt'; link.click(); URL.revokeObjectURL(blobUrl);
  }
  function openSubject(subject: string) { const match = state.tasks.find(item => item.title === subject); if (match) openTask(match.id); else { setQuery(subject); setSection('Portfolio'); } }
  const sharedProjects = { tasks: filteredTasks, onOpen: openTask, onSave: persistTask, onDelete: setDeleting, onCreate: () => setAction('New Project'), onExpand: () => changeSection(section === 'Dashboard' ? 'Portfolio' : 'Dashboard'), expanded: section !== 'Dashboard' };
  const stats = [
    { label: 'Total Projects', value: 12 + state.tasks.length - 2, detail: 'Active Projects', section: 'Portfolio' },
    { label: 'Total Task', value: 108 + state.tasks.length - 2, detail: 'Tasks Created', section: 'My Task' },
    { label: 'In Progress', value: 10 + state.tasks.filter(item => item.status === 'On Progress').length, detail: 'Task', section: 'My Task' },
    { label: 'Completed', value: 76 + state.tasks.filter(item => item.status === 'Completed').length, detail: 'Task', section: 'Goals' },
  ] as const;

  return <section className={styles.dashboard} aria-label={`${projectName} project dashboard`} lang="en">
    <DashboardSidebar section={section} onSectionChange={changeSection} collapsed={collapsed} onCollapse={() => setCollapsedPreference(!collapsed)} favorites={state.favorites} onCreate={() => setAction('Create Task')} onFavorite={() => changeSection('Portfolio')} onHelp={() => setAction('Help Center')} projectName={projectName} onBack={onBack} />
    <div className={styles.workbench}>
      <header className={styles.topbar}>
        <div className={styles.breadcrumb}><button type="button" className="fouc-action" title="Back to Fouc projects" onClick={onBack}>Synchro</button><CaretRight size={14} /><span><ReferenceIcon name="dashboard" size={19} />{section}</span></div>
        <div className={styles.topbarTools}>
          <div className={styles.searchWrap}><label className={styles.search}><MagnifyingGlass size={21} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects..." aria-label="Search projects" onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onKeyDown={event => { if (event.key === 'Enter' && filteredTasks[0]) { setSearchFocused(false); openTask(filteredTasks[0].id); } if (event.key === 'Escape') { setQuery(''); setSearchFocused(false); event.currentTarget.blur(); } }} /></label>
            {searchFocused && query.trim() ? <div className={styles.searchResults}>{filteredTasks.length ? filteredTasks.map(item => <button type="button" className="fouc-action" key={item.id} onMouseDown={event => event.preventDefault()} onClick={() => { setSearchFocused(false); openTask(item.id); }}><FolderSimple size={17} /><span>{item.title}<small>{item.tag} · {item.status}</small></span></button>) : <p>No projects found</p>}</div> : null}
          </div>
          <span className={styles.toolbarDivider} /><IconButton label="Share Dashboard" onClick={() => { void copyLink(); }}><ShareNetwork /></IconButton><IconButton label="Notifications" onClick={() => setAction('Notifications')}><Bell /></IconButton>
        </div>
      </header>
      <div className={styles.titlebar}><h1>{section}</h1><div className={styles.titlebarTools}><span className={styles.lastUpdated}>{recentlySaved ? <Check size={14} /> : <ClockCounterClockwise size={14} />}{recentlySaved ? 'Just now' : '3 min ago'}</span><button type="button" className={styles.collaborators} aria-label="Manage collaborators" onClick={() => setAction('Invite')}><AvatarGroup ids={invited.slice(0, 3)} size={28} extra={Math.max(0, invited.length - 3)} /></button><DashboardButton onClick={() => setAction('Invite')}><UsersThree size={21} weight="fill" />Invite</DashboardButton><DropdownMenu><DropdownMenuTrigger asChild><IconButton label="Dashboard options"><DotsThree weight="bold" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { void copyLink(); }}><ShareNetwork />Copy Dashboard link</DropdownMenuItem><DropdownMenuItem onSelect={() => changeSection('Portfolio')}><FolderSimple />View all projects</DropdownMenuItem><DropdownMenuItem onSelect={onBack}>Back to Fouc projects</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>
      <div ref={scrollArea} className={styles.content}>
        {storageError ? <AppAlert tone="warning" title="Changes can’t be saved on this device" description="You can keep working. Enable browser storage to keep changes after refreshing." /> : null}
        {section === 'Dashboard' ? <>
          <div className={styles.shortcuts}>{shortcuts.map(({ label, icon }) => <button type="button" className={`fouc-action ${styles.shortcut}`} key={label} onClick={() => setAction(label)}><span><ReferenceIcon name={icon} size={40} /></span><strong>{label}</strong></button>)}</div>
          <div className={styles.stats}>{stats.map(stat => <article className={styles.statCard} key={stat.label}><div><span>{stat.label}</span><DropdownMenu><DropdownMenuTrigger asChild><button className={styles.flatIcon} aria-label={`${stat.label} options`}><DotsThree size={17} weight="bold" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { changeSection(stat.section); if (stat.label === 'In Progress') setStatus('On Progress'); if (stat.label === 'Completed') setStatus('Completed'); }}>View {stat.label.toLowerCase()}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><p><strong>{stat.value}</strong><small>{stat.detail}</small></p></article>)}</div>
          <div className={styles.mainGrid}><div className={styles.leftColumn}><ActivityMap onOpenTask={openTask} /><TodayProjects {...sharedProjects} /></div><div className={styles.rightColumn}><TeamPanel onInvite={() => setAction('Invite')} /><MeetingsPanel onOpen={title => setAction(title as DashboardAction)} /></div></div>
          <div className={styles.analyticsGrid}><MilestoneTracker /><ActivityPanel activities={state.activities} onOpen={openSubject} onExport={exportActivity} /></div>
        </> : section === 'My Task' || section === 'Portfolio' ? <><div className={styles.filterBar}><SegmentedControl items={['All', 'To Do', 'On Progress', 'Completed'] as const} value={status} onChange={setStatus} label="Filter tasks by status" /><span>{filteredTasks.length} projects</span></div><TodayProjects {...sharedProjects} /></> : section === 'Reporting' ? <><ActivityMap onOpenTask={openTask} /><div className={styles.analyticsGrid}><MilestoneTracker /><ActivityPanel activities={state.activities} onOpen={openSubject} onExport={exportActivity} /></div></> : section === 'Accounts' ? <TeamPanel expanded onInvite={() => setAction('Invite')} /> : section === 'Inbox' ? <ActivityPanel activities={state.activities} onOpen={openSubject} onExport={exportActivity} /> : <><div className={styles.goalSummary}><h2>{state.tasks.filter(item => item.status === 'Completed').length} of {state.tasks.length} projects completed</h2><p>Keep your projects moving toward their milestones.</p></div><TodayProjects {...sharedProjects} /></>}
      </div>
    </div>
    {task ? <DashboardTaskDialog key={task.id} task={task} onClose={closeTask} onSave={persistTask} /> : null}
    {action ? <DashboardActionDialog key={action} action={action} onClose={() => setAction(null)} onCreate={createTask} invited={invited} onInvite={setInvited} /> : null}
    {deleting ? <DashboardDeleteDialog task={deleting} onClose={() => setDeleting(null)} onDelete={() => { removeTask(deleting.id); setDeleting(null); notify('success', 'Project deleted'); }} /> : null}
  </section>;
}
