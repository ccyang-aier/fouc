'use client';

import { ArrowsOutSimple, Check, ChatCenteredDots, DotsThree, Export, LinkSimple, Plus, Star, Trash } from '@phosphor-icons/react';
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarGroup, DashboardButton, IconButton, ReferenceIcon } from './dashboard-ui';
import { dashboardPeople, type DashboardActivity, type DashboardTask } from './dashboard-model';
import { DashboardMenu as DropdownMenu, DashboardMenuContent as DropdownMenuContent } from './dashboard-menu';
import styles from './dashboard.module.css';

export function TaskCard({ task, onOpen, onSave, onDelete }: { task: DashboardTask; onOpen: (id: string) => void; onSave: (task: DashboardTask) => void; onDelete: (task: DashboardTask) => void }) {
  return <article className={styles.taskCard}>
    <div className={styles.taskCardTop}><button type="button" className={`fouc-action ${styles.projectIcon}`} aria-label={`Open ${task.title}`} onClick={() => onOpen(task.id)}><ReferenceIcon name="project" size={36} /></button>
      <DropdownMenu><DropdownMenuTrigger asChild><button className={styles.flatIcon} aria-label={`${task.title} options`}><DotsThree size={18} weight="bold" /></button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onOpen(task.id)}>Open project</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSave({ ...task, starred: !task.starred })}><Star weight={task.starred ? 'fill' : 'regular'} />{task.starred ? 'Remove from favourites' : 'Add to favourites'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSave({ ...task, status: task.status === 'Completed' ? 'On Progress' : 'Completed', progress: task.status === 'Completed' ? 0 : 100 })}><Check />{task.status === 'Completed' ? 'Reopen project' : 'Mark as complete'}</DropdownMenuItem>
        <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}><Trash />Delete project</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
    <div className={styles.taskTitle}><button type="button" onClick={() => onOpen(task.id)}>{task.title}</button><span className={styles.priority} data-priority={task.priority}>{task.priority}</span>{task.starred ? <Star size={13} weight="fill" /> : null}</div>
    <p className={styles.taskDescription}>{task.description}</p>
    <div className={styles.progressRow}><div className={styles.progressTrack} role="progressbar" aria-label={`${task.title} progress`} aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100}><span data-color={task.color} style={{ width: `${task.progress}%` }} /></div><span>Progress :{task.progress}%</span></div>
    <div className={styles.taskFooter}><AvatarGroup ids={task.cardPeople} size={28} /><div><button type="button" className="fouc-action" aria-label={`${task.title} comments`} onClick={() => onOpen(task.id)}><ChatCenteredDots size={20} /><span>{task.commentCount}</span></button><button type="button" className="fouc-action" aria-label={`${task.title} links`} onClick={() => onOpen(task.id)}><LinkSimple size={19} /><span>{task.links}</span></button></div></div>
  </article>;
}

export function TodayProjects({ tasks, onOpen, onSave, onDelete, onCreate, onExpand, expanded = false }: { tasks: DashboardTask[]; onOpen: (id: string) => void; onSave: (task: DashboardTask) => void; onDelete: (task: DashboardTask) => void; onCreate: () => void; onExpand: () => void; expanded?: boolean }) {
  return <section className={`${styles.panel} ${styles.today}`} aria-label="Today Projects">
    <header className={styles.panelHeader}><h2>Today Projects</h2><div className={styles.headerActions}><DashboardButton className={styles.newProject} onClick={onCreate}><Plus size={14} />New Project</DashboardButton><IconButton label={expanded ? 'Show Dashboard' : 'Expand Today Projects'} onClick={onExpand}><ArrowsOutSimple size={16} /></IconButton></div></header>
    <div className={styles.taskGrid}>{tasks.length ? tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpen} onSave={onSave} onDelete={onDelete} />) : <div className={styles.empty}><p>No projects found</p><DashboardButton tone="neutral" onClick={onCreate}>New Project</DashboardButton></div>}</div>
  </section>;
}

export function TeamPanel({ onInvite, expanded = false }: { onInvite: () => void; expanded?: boolean }) {
  const ids = expanded ? ['jerome', 'brooklyn', 'cameron', 'robert', 'kiara', 'joe', 'tania'] as const : ['jerome', 'brooklyn', 'cameron', 'robert'] as const;
  return <section className={`${styles.panel} ${styles.team}`} data-expanded={expanded} aria-label="Team"><header className={styles.panelHeader}><h2>Team</h2><DropdownMenu><DropdownMenuTrigger asChild><IconButton label="Team options"><DotsThree weight="bold" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onInvite}><Plus />Add collaborator</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header><div>{ids.map(id => <button type="button" className={`fouc-action ${styles.teamMember}`} key={id} onClick={onInvite}><Avatar id={id} size={32} /><span><strong>{dashboardPeople[id].name}</strong><small>{dashboardPeople[id].role}</small></span></button>)}</div></section>;
}

export function MeetingsPanel({ onOpen }: { onOpen: (title: string) => void }) {
  return <section className={`${styles.panel} ${styles.meetings}`} aria-label="Upcoming Meeting"><header className={styles.panelHeader}><h2>Upcoming Meeting</h2><DropdownMenu><DropdownMenuTrigger asChild><IconButton label="Meeting options"><DotsThree weight="bold" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onOpen('New Meeting')}><Plus />Schedule meeting</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header><div className={styles.meetingList}>
    {[{ title: 'Dev Sync Meeting', date: 'Monday, Feb 8, 2027-10:00 AM', ids: ['jerome', 'tania', 'brooklyn'] as const, comments: 6 }, { title: 'ABC Project Meeting', date: 'Tuesday, Feb 9, 2027-09:00 AM', ids: ['tania', 'kiara', 'brooklyn'] as const, comments: 2 }].map(meeting => <article key={meeting.title} className={styles.meetingCard}><button type="button" className={styles.meetingTitle} onClick={() => onOpen(meeting.title)}>{meeting.title}</button><p>{meeting.date}</p><div className={styles.taskFooter}><AvatarGroup ids={meeting.ids} size={27} /><div><button type="button" className="fouc-action" aria-label={`${meeting.title} comments`} onClick={() => onOpen(meeting.title)}><ChatCenteredDots size={19} />{meeting.comments}</button><button type="button" className="fouc-action" aria-label={`${meeting.title} link`} onClick={() => onOpen(meeting.title)}><LinkSimple size={18} />1</button></div></div></article>)}
    </div></section>;
}

export function ActivityPanel({ activities, onOpen, onExport }: { activities: DashboardActivity[]; onOpen: (subject: string) => void; onExport: () => void }) {
  return <section className={`${styles.panel} ${styles.activity}`} aria-label="Activity"><header className={styles.panelHeader}><h2>Activity</h2><DropdownMenu><DropdownMenuTrigger asChild><IconButton label="Activity options"><DotsThree weight="bold" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onExport}><Export />Export activity</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header><div className={styles.activityList}>{activities.map(activity => <div key={activity.id}><p><span className={activity.actor.includes('@') ? styles.email : undefined}>{activity.actor}</span> {activity.text} <button type="button" onClick={() => onOpen(activity.subject)}>{activity.subject}</button>{activity.text === 'marked' ? ' as complete.' : ''}</p><time>{activity.time}</time></div>)}</div></section>;
}
