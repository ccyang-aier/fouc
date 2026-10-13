'use client';

import { useState } from 'react';
import {
  ArrowsOutSimple,
  Check,
  ChatCenteredDots,
  DotsThree,
  Export,
  LinkSimple,
  Plus,
  Star,
  Trash,
} from '@phosphor-icons/react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarGroup, DashboardButton, IconButton, ReferenceIcon } from './dashboard-ui';
import {
  dashboardPeople,
  type DashboardActivity,
  type DashboardMeeting,
  type DashboardPersonId,
  type DashboardProject,
  type DashboardProjectSummary,
} from './dashboard-model';
import {
  DashboardMenu as DropdownMenu,
  DashboardMenuContent as DropdownMenuContent,
} from './dashboard-menu';
import styles from './dashboard.module.css';
import panelStyles from './dashboard-panels.module.css';

interface ProjectCardProps {
  summary: DashboardProjectSummary;
  onOpen: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
  onComplete: (projectId: string) => void;
  onDelete: (project: DashboardProject) => void;
}

export function ProjectCard({
  summary,
  onOpen,
  onToggleFavorite,
  onComplete,
  onDelete,
}: ProjectCardProps) {
  const { project, progress, status, people, comments, links } = summary;

  return (
    <article className={styles.taskCard}>
      <div className={styles.taskCardTop}>
        <button
          type="button"
          className={`fouc-action ${styles.projectIcon}`}
          aria-label={`Open ${project.name}`}
          onClick={() => onOpen(project.id)}
        >
          <ReferenceIcon name="project" size={36} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`fouc-action ${styles.flatIcon}`}
              aria-label={`${project.name} options`}
            >
              <DotsThree size={18} weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(project.id)}>Open project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleFavorite(project.id)}>
              <Star weight={project.starred ? 'fill' : 'regular'} />
              {project.starred ? 'Remove from favourites' : 'Add to favourites'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={summary.tasks.length === 0 || status === 'Completed'}
              onSelect={() => onComplete(project.id)}
            >
              <Check />
              {status === 'Completed' ? 'Project completed' : 'Mark all tasks complete'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(project)}>
              <Trash />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={styles.taskTitle}>
        <button type="button" onClick={() => onOpen(project.id)}>
          {project.name}
        </button>
        <span className={panelStyles.projectBadges}>
          <span className={styles.priority} data-priority={project.priority}>
            {project.priority}
          </span>
          {project.starred ? <Star size={13} weight="fill" aria-label="Favourite" /> : null}
        </span>
      </div>
      <p className={styles.taskDescription} title={project.description}>
        {project.description || 'No description yet'}
      </p>
      <div className={styles.progressRow}>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label={`${project.name} progress`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span data-color={project.color} style={{ width: `${progress}%` }} />
        </div>
        <span>Progress :{progress}%</span>
      </div>
      <div className={styles.taskFooter}>
        <AvatarGroup ids={people.slice(0, 3)} size={28} extra={Math.max(0, people.length - 3)} />
        <div>
          <button
            type="button"
            className="fouc-action"
            aria-label={`${project.name} comments`}
            onClick={() => onOpen(project.id)}
          >
            <ChatCenteredDots size={20} />
            <span>{comments}</span>
          </button>
          <button
            type="button"
            className="fouc-action"
            aria-label={`${project.name} links`}
            onClick={() => onOpen(project.id)}
          >
            <LinkSimple size={19} />
            <span>{links}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

interface TodayProjectsProps extends Omit<ProjectCardProps, 'summary'> {
  projects: DashboardProjectSummary[];
  onCreate: () => void;
  onExpand: () => void;
  expanded?: boolean;
}

export function TodayProjects({
  projects,
  onOpen,
  onToggleFavorite,
  onComplete,
  onDelete,
  onCreate,
  onExpand,
  expanded = false,
}: TodayProjectsProps) {
  return (
    <section className={`${styles.panel} ${styles.today}`} aria-label="Today Projects">
      <header className={styles.panelHeader}>
        <h2>{expanded ? 'Projects' : 'Today Projects'}</h2>
        <div className={styles.headerActions}>
          <DashboardButton className={styles.newProject} onClick={onCreate}>
            <Plus size={14} />
            New Project
          </DashboardButton>
          <IconButton
            label={expanded ? 'Show Dashboard' : 'Expand Today Projects'}
            onClick={onExpand}
          >
            <ArrowsOutSimple size={16} />
          </IconButton>
        </div>
      </header>
      <div className={styles.taskGrid}>
        {projects.length ? (
          projects.map((summary) => (
            <ProjectCard
              key={summary.project.id}
              summary={summary}
              onOpen={onOpen}
              onToggleFavorite={onToggleFavorite}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className={styles.empty}>
            <p>No projects found</p>
            <DashboardButton tone="neutral" onClick={onCreate}>
              New Project
            </DashboardButton>
          </div>
        )}
      </div>
    </section>
  );
}

export function TeamPanel({
  memberIds,
  onInvite,
  expanded = false,
}: {
  memberIds: DashboardPersonId[];
  onInvite: () => void;
  expanded?: boolean;
}) {
  const visibleIds = expanded ? memberIds : memberIds.slice(0, 4);

  return (
    <section
      className={`${styles.panel} ${styles.team}`}
      data-expanded={expanded}
      aria-label="Team"
    >
      <header className={styles.panelHeader}>
        <h2>Team</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Team options">
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onInvite}>
              <Plus />
              Manage collaborators
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div>
        {visibleIds.map((id) => (
          <button
            type="button"
            className={`fouc-action ${styles.teamMember}`}
            key={id}
            onClick={onInvite}
          >
            <Avatar id={id} size={32} />
            <span>
              <strong>{dashboardPeople[id].name}</strong>
              <small>{dashboardPeople[id].role}</small>
            </span>
          </button>
        ))}
        {!visibleIds.length ? (
          <div className={panelStyles.emptyCompact}>
            <p>No collaborators yet</p>
            <DashboardButton tone="neutral" onClick={onInvite}>
              Add collaborator
            </DashboardButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function meetingDate(startsAt: string) {
  const date = new Date(startsAt);
  const day = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${day}-${time}`;
}

export function MeetingsPanel({
  meetings,
  onOpen,
  onCreate,
}: {
  meetings: DashboardMeeting[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sortedMeetings = [...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const visibleMeetings = expanded ? sortedMeetings : sortedMeetings.slice(0, 2);

  return (
    <section className={`${styles.panel} ${styles.meetings}`} aria-label="Upcoming Meeting">
      <header className={styles.panelHeader}>
        <h2>Upcoming Meeting</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Meeting options">
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreate}>
              <Plus />
              Schedule meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className={styles.meetingList}>
        {visibleMeetings.map((meeting) => (
          <article key={meeting.id} className={styles.meetingCard}>
            <button
              type="button"
              className={styles.meetingTitle}
              onClick={() => onOpen(meeting.id)}
            >
              {meeting.title}
            </button>
            <p>{meetingDate(meeting.startsAt)}</p>
            <div className={styles.taskFooter}>
              <AvatarGroup
                ids={meeting.attendees.slice(0, 3)}
                size={27}
                extra={Math.max(0, meeting.attendees.length - 3)}
              />
              <div>
                <button
                  type="button"
                  className="fouc-action"
                  aria-label={`${meeting.title} comments`}
                  onClick={() => onOpen(meeting.id)}
                >
                  <ChatCenteredDots size={19} />
                  {meeting.comments.length}
                </button>
                <button
                  type="button"
                  className="fouc-action"
                  aria-label={`${meeting.title} link`}
                  onClick={() => onOpen(meeting.id)}
                >
                  <LinkSimple size={18} />
                  {meeting.link ? 1 : 0}
                </button>
              </div>
            </div>
          </article>
        ))}
        {!visibleMeetings.length ? (
          <div className={panelStyles.emptyCompact}>
            <p>No meetings scheduled</p>
            <DashboardButton tone="neutral" onClick={onCreate}>
              Schedule meeting
            </DashboardButton>
          </div>
        ) : null}
      </div>
      {sortedMeetings.length > 2 ? (
        <button
          type="button"
          className={`fouc-action ${panelStyles.moreButton}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : `View all ${sortedMeetings.length} meetings`}
        </button>
      ) : null}
    </section>
  );
}

export function ActivityPanel({
  activities,
  onOpen,
  onExport,
  onReadAll,
  inbox = false,
}: {
  activities: DashboardActivity[];
  onOpen: (activity: DashboardActivity) => void;
  onExport: () => void;
  onReadAll?: () => void;
  inbox?: boolean;
}) {
  const unreadCount = activities.filter((activity) => !activity.read).length;

  return (
    <section
      className={`${styles.panel} ${styles.activity} ${inbox ? panelStyles.inbox : ''}`}
      aria-label={inbox ? 'Inbox' : 'Activity'}
    >
      <header className={styles.panelHeader}>
        <h2>{inbox ? 'Inbox' : 'Activity'}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={inbox ? 'Inbox options' : 'Activity options'}>
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onReadAll ? (
              <DropdownMenuItem disabled={unreadCount === 0} onSelect={onReadAll}>
                <Check />
                Mark all as read
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={!activities.length} onSelect={onExport}>
              <Export />
              Export activity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {inbox ? (
        <div className={panelStyles.inboxStatus} role="status">
          {unreadCount ? `${unreadCount} unread updates` : 'All updates read'}
          {onReadAll && unreadCount ? (
            <button type="button" className="fouc-action" onClick={onReadAll}>
              Mark all as read
            </button>
          ) : null}
        </div>
      ) : null}
      <div className={styles.activityList}>
        {activities.map((activity) => (
          <div
            className={inbox ? panelStyles.inboxItem : undefined}
            data-unread={inbox && !activity.read}
            key={activity.id}
          >
            {inbox && !activity.read ? (
              <span className={panelStyles.unreadDot} aria-label="Unread" />
            ) : null}
            <p>
              <span className={activity.actor.includes('@') ? styles.email : undefined}>
                {activity.actor}
              </span>{' '}
              {activity.text}{' '}
              <button type="button" onClick={() => onOpen(activity)}>
                {activity.subject}
              </button>
              {activity.text === 'marked' ? ' as complete.' : ''}
            </p>
            <time>{activity.time}</time>
          </div>
        ))}
        {!activities.length ? (
          <div className={panelStyles.emptyCompact}>
            <p>{inbox ? 'No updates yet' : 'No activity yet'}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
