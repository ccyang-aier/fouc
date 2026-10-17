'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation, type Locale } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-panels';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowsOutSimple,
  ChatCenteredDots,
  Check,
  DotsThree,
  Export,
  LinkSimple,
  Plus,
  Star,
  Trash,
} from '@phosphor-icons/react';
import { useState } from 'react';
import {
  DashboardMenu as DropdownMenu,
  DashboardMenuContent as DropdownMenuContent,
} from './dashboard-menu';
import {
  dashboardPeople,
  type DashboardActivity,
  type DashboardMeeting,
  type DashboardPersonId,
  type DashboardProject,
  type DashboardProjectSummary,
} from './dashboard-model';
import panelStyles from './dashboard-panels.module.css';
import { Avatar, AvatarGroup, DashboardButton, IconButton, ReferenceIcon } from './dashboard-ui';
import styles from './dashboard.module.css';

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
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const { project, progress, status, people, comments, links } = summary;

  return (
    <article className={styles.taskCard}>
      <div className={styles.taskCardTop}>
        <button
          type="button"
          className={`fouc-action ${styles.projectIcon}`}
          aria-label={t('Open {v0}', { v0: fixtureField(project, 'name', locale) })}
          onClick={() => onOpen(project.id)}
        >
          <ReferenceIcon name="project" size={36} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`fouc-action ${styles.flatIcon}`}
              aria-label={t('{v0} options', { v0: fixtureField(project, 'name', locale) })}
            >
              <DotsThree size={18} weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(project.id)}>
              {t('Open project')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleFavorite(project.id)}>
              <Star weight={project.starred ? 'fill' : 'regular'} />
              {project.starred ? t('Remove from favourites') : t('Add to favourites')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={summary.tasks.length === 0 || status === 'Completed'}
              onSelect={() => onComplete(project.id)}
            >
              <Check />
              {status === 'Completed' ? t('Project completed') : t('Mark all tasks complete')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(project)}>
              <Trash />
              {t('Delete project')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={styles.taskTitle}>
        <button type="button" onClick={() => onOpen(project.id)}>
          {fixtureField(project, 'name', locale)}
        </button>
        <span className={panelStyles.projectBadges}>
          <span className={styles.priority} data-priority={project.priority}>
            {uiLabel(project.priority)}
          </span>
          {project.starred ? <Star size={13} weight="fill" aria-label={t('Favourite')} /> : null}
        </span>
      </div>
      <p className={styles.taskDescription} title={fixtureField(project, 'description', locale)}>
        {fixtureField(project, 'description', locale) ||
          translateFixed('No description yet', locale)}
      </p>
      <div className={styles.progressRow}>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label={t('{v0} progress', { v0: fixtureField(project, 'name', locale) })}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span data-color={project.color} style={{ width: `${progress}%` }} />
        </div>
        <span>
          {t('Progress :')}
          {progress}%
        </span>
      </div>
      <div className={styles.taskFooter}>
        <AvatarGroup ids={people.slice(0, 3)} size={28} extra={Math.max(0, people.length - 3)} />
        <div>
          <button
            type="button"
            className="fouc-action"
            aria-label={t('{v0} comments', { v0: fixtureField(project, 'name', locale) })}
            onClick={() => onOpen(project.id)}
          >
            <ChatCenteredDots size={20} />
            <span>{comments}</span>
          </button>
          <button
            type="button"
            className="fouc-action"
            aria-label={t('{v0} links', { v0: fixtureField(project, 'name', locale) })}
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
}

export function TodayProjects({
  projects,
  onOpen,
  onToggleFavorite,
  onComplete,
  onDelete,
  onCreate,
  onExpand,
}: TodayProjectsProps) {
  const { t } = useTranslation(messages);

  return (
    <section className={`${styles.panel} ${styles.today}`} aria-label={t('Today Projects')}>
      <header className={styles.panelHeader}>
        <h2>{t('Today Projects')}</h2>
        <div className={styles.headerActions}>
          <DashboardButton className={styles.newProject} onClick={onCreate}>
            <Plus size={14} />
            {t('New Project')}
          </DashboardButton>
          <IconButton
            label={t('View all tasks')}
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
            <p>{t('No projects found')}</p>
            <DashboardButton tone="neutral" onClick={onCreate}>
              {t('New Project')}
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
  onViewAll,
}: {
  memberIds: DashboardPersonId[];
  onInvite: () => void;
  onViewAll: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const visibleIds = memberIds.slice(0, 4);

  return (
    <section
      className={`${styles.panel} ${styles.team}`}
      aria-label={t('Team')}
    >
      <header className={styles.panelHeader}>
        <h2>{t('Team')}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t('Team options')}>
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onViewAll}>
              <ArrowsOutSimple />
              {t('View all members')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onInvite}>
              <Plus />
              {t('Manage collaborators')}
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
              <strong>{fixtureField(dashboardPeople[id], 'name', locale)}</strong>
              <small>{uiLabel(dashboardPeople[id].role)}</small>
            </span>
          </button>
        ))}
        {!visibleIds.length ? (
          <div className={panelStyles.emptyCompact}>
            <p>{t('No collaborators yet')}</p>
            <DashboardButton tone="neutral" onClick={onInvite}>
              {t('Add collaborator')}
            </DashboardButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function meetingDate(startsAt: string, locale: Locale) {
  const date = new Date(startsAt);
  const day = date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(locale, {
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
  const { t, locale } = useTranslation(messages);

  const [expanded, setExpanded] = useState(false);
  const sortedMeetings = [...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const visibleMeetings = expanded ? sortedMeetings : sortedMeetings.slice(0, 2);

  return (
    <section className={`${styles.panel} ${styles.meetings}`} aria-label={t('Upcoming Meeting')}>
      <header className={styles.panelHeader}>
        <h2>{t('Upcoming Meeting')}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t('Meeting options')}>
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreate}>
              <Plus />
              {t('Schedule meeting')}
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
              {fixtureField(meeting, 'title', locale)}
            </button>
            <p>{meetingDate(meeting.startsAt, locale)}</p>
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
                  aria-label={t('{v0} comments', { v0: fixtureField(meeting, 'title', locale) })}
                  onClick={() => onOpen(meeting.id)}
                >
                  <ChatCenteredDots size={19} />
                  {meeting.comments.length}
                </button>
                <button
                  type="button"
                  className="fouc-action"
                  aria-label={t('{v0} link', { v0: fixtureField(meeting, 'title', locale) })}
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
            <p>{t('No meetings scheduled')}</p>
            <DashboardButton tone="neutral" onClick={onCreate}>
              {t('Schedule meeting')}
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
          {expanded ? t('Show less') : t('View all {v0} meetings', { v0: sortedMeetings.length })}
        </button>
      ) : null}
    </section>
  );
}

export function ActivityPanel({
  activities,
  onOpen,
  onExport,
}: {
  activities: DashboardActivity[];
  onOpen: (activity: DashboardActivity) => void;
  onExport: () => void;
}) {
  const { t, locale } = useTranslation(messages);

  return (
    <section
      className={`${styles.panel} ${styles.activity}`}
      aria-label={t('Activity')}
    >
      <header className={styles.panelHeader}>
        <h2>{t('Activity')}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t('Activity options')}>
              <DotsThree weight="bold" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!activities.length} onSelect={onExport}>
              <Export />
              {t('Export activity')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className={styles.activityList}>
        {activities.map((activity) => (
          <div key={activity.id}>
            <p>
              <span className={activity.actor.includes('@') ? styles.email : undefined}>
                {activity.actor}
              </span>{' '}
              {fixtureField(activity, 'text', locale)}{' '}
              <button type="button" onClick={() => onOpen(activity)}>
                {fixtureField(activity, 'subject', locale)}
              </button>
              {activity.text === 'marked' ? t(' as complete.') : ''}
            </p>
            <time>{fixtureField(activity, 'time', locale)}</time>
          </div>
        ))}
        {!activities.length ? (
          <div className={panelStyles.emptyCompact}>
            <p>{t('No activity yet')}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
