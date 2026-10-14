'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-actions';

import { useAppAlert } from '@/components/app-alert-provider';
import { Bell, Check } from '@phosphor-icons/react';
import { useState } from 'react';
import styles from './dashboard-actions.module.css';
import { DashboardMemberPicker, DashboardModal } from './dashboard-modal';
import type {
  DashboardPersonId,
  DashboardPriority,
  DashboardProject,
  DashboardState,
  DashboardTarget,
  DashboardTask,
} from './dashboard-model';
import { DashboardButton } from './dashboard-ui';

export type DashboardAction =
  'Create Task' | 'New Project' | 'Invite' | 'Help Center' | 'Notifications';
interface DashboardActionProps {
  action: DashboardAction;
  state: DashboardState;
  initialProjectId?: string;
  onClose: () => void;
  onCreateTask: (task: DashboardTask) => void;
  onCreateProject: (project: DashboardProject) => void;
  onInvite: (ids: DashboardPersonId[]) => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onOpenTarget: (target: DashboardTarget) => void;
}

function CreateTaskForm({
  state,
  initialProjectId,
  onCreate,
  onClose,
}: {
  state: DashboardState;
  initialProjectId?: string;
  onCreate: (task: DashboardTask) => void;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const { notify } = useAppAlert();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<DashboardPriority>('Medium');
  const [projectId, setProjectId] = useState(
    state.projects.some((project) => project.id === initialProjectId)
      ? initialProjectId!
      : (state.projects[0]?.id ?? ''),
  );
  const [dueDate, setDueDate] = useState('2027-02-09');
  const [scheduledDate, setScheduledDate] = useState('2027-02-08');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(1.5);
  const [timelineCategory, setTimelineCategory] =
    useState<DashboardTask['timelineCategory']>('Mobile App');
  const [assignees, setAssignees] = useState<DashboardPersonId[]>(['sarah']);
  const [error, setError] = useState('');
  function create() {
    if (!title.trim()) {
      setError('Enter a task name.');
      return;
    }
    if (!state.projects.some((project) => project.id === projectId)) {
      setError('Choose a project before creating this task.');
      return;
    }
    const [hour, minute] = startTime.split(':').map(Number);
    const startHour = hour + minute / 60;
    if (
      !scheduledDate ||
      !dueDate ||
      !Number.isFinite(startHour) ||
      duration <= 0 ||
      startHour + duration > 24
    ) {
      setError('Choose a valid schedule that ends before midnight.');
      return;
    }
    onCreate({
      id: crypto.randomUUID(),
      projectId,
      title: title.trim(),
      detailTitle: title.trim(),
      description: description.trim(),
      priority,
      status: 'To Do',
      tag: 'Mobile App',
      dueDate,
      progress: 0,
      assignees,
      cardPeople: assignees,
      collaborators: assignees,
      comments: [],
      commentCount: 0,
      links: 0,
      color: 'green',
      starred: false,
      scheduledDate,
      startHour,
      durationHours: duration,
      timelineCategory,
    });
    notify('success', t('Task created'));
    onClose();
  }
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        create();
      }}
    >
      <div className={styles.scrollBody}>
        <div className={styles.fields}>
          <label>
            {t('Task name')}
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder={t('Give it a name')}
            />
          </label>
          <label>
            {t('Project')}
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              required
            >
              <option value="" disabled>
                {t('Choose a project')}
              </option>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {fixtureField(project, 'name', locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Description')}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('Add a description')}
              rows={3}
            />
          </label>
          <div className={styles.fieldGrid}>
            <label>
              {t('Priority')}
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as DashboardPriority)}
              >
                {['Low', 'Medium', 'High', 'Urgent'].map((value) => (
                  <option value={value} key={value}>
                    {uiLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Due date')}
              <input
                type="date"
                required
                value={dueDate}
                onInput={(event) => setDueDate(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className={styles.fieldGrid}>
            <label>
              {t('Scheduled date')}
              <input
                type="date"
                required
                value={scheduledDate}
                onInput={(event) => setScheduledDate(event.currentTarget.value)}
              />
            </label>
            <label>
              {t('Start time')}
              <input
                type="time"
                required
                value={startTime}
                onInput={(event) => setStartTime(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className={styles.fieldGrid}>
            <label>
              {t('Duration (hours)')}
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                required
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </label>
            <label>
              {t('Timeline category')}
              <select
                value={timelineCategory}
                onChange={(event) =>
                  setTimelineCategory(event.target.value as DashboardTask['timelineCategory'])
                }
              >
                {['Dashboard Design', 'Mobile App', 'Landing Page'].map((value) => (
                  <option value={value} key={value}>
                    {uiLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className={styles.memberField}>
            <legend>{t('Assignees')}</legend>
            <DashboardMemberPicker
              selected={assignees}
              onChange={setAssignees}
              ids={Array.from(new Set(['sarah' as const, ...state.memberIds]))}
            />
          </fieldset>
          {error ? (
            <p role="alert" className={styles.error}>
              {translateFixed(error, locale)}
            </p>
          ) : null}
        </div>
      </div>
      <footer>
        <DashboardButton type="button" tone="neutral" onClick={onClose}>
          {t('Cancel')}
        </DashboardButton>
        <DashboardButton type="submit">{t('Create task')}</DashboardButton>
      </footer>
    </form>
  );
}

function NewProjectForm({
  onCreate,
  onClose,
}: {
  onCreate: (project: DashboardProject) => void;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<DashboardPriority>('Medium');
  const [color, setColor] = useState<DashboardProject['color']>('green');
  const { notify } = useAppAlert();
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onCreate({
          id: crypto.randomUUID(),
          name: name.trim(),
          description: description.trim(),
          priority,
          color,
          featured: true,
          starred: false,
          favoriteLabel: name.trim(),
        });
        notify('success', t('Project created'));
        onClose();
      }}
    >
      <div className={styles.scrollBody}>
        <div className={styles.fields}>
          <label>
            {t('Project name')}
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('Give it a name')}
            />
          </label>
          <label>
            {t('Description')}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder={t('What are you working on?')}
            />
          </label>
          <div className={styles.fieldGrid}>
            <label>
              {t('Priority')}
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as DashboardPriority)}
              >
                {['Low', 'Medium', 'High', 'Urgent'].map((value) => (
                  <option value={value} key={value}>
                    {uiLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('Color')}
              <select
                value={color}
                onChange={(event) => setColor(event.target.value as DashboardProject['color'])}
              >
                <option value="green">{t('Sage')}</option>
                <option value="orange">{t('Orange')}</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <footer>
        <DashboardButton type="button" tone="neutral" onClick={onClose}>
          {t('Cancel')}
        </DashboardButton>
        <DashboardButton type="submit">{t('Create project')}</DashboardButton>
      </footer>
    </form>
  );
}

function InviteForm({
  memberIds,
  onInvite,
  onClose,
}: {
  memberIds: DashboardPersonId[];
  onInvite: (ids: DashboardPersonId[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(messages);

  const [selected, setSelected] = useState(memberIds);
  const { notify } = useAppAlert();
  return (
    <>
      <div className={styles.scrollBody}>
        <div className={styles.helpContent}>
          <p>{t('Choose collaborators for this dashboard.')}</p>
          <DashboardMemberPicker selected={selected} onChange={setSelected} />
        </div>
      </div>
      <footer>
        <DashboardButton type="button" tone="neutral" onClick={onClose}>
          {t('Cancel')}
        </DashboardButton>
        <DashboardButton
          onClick={() => {
            onInvite(selected);
            notify('success', t('Collaborators saved'));
            onClose();
          }}
        >
          {t('Save')}
        </DashboardButton>
      </footer>
    </>
  );
}

function Notifications({
  state,
  onRead,
  onReadAll,
  onOpenTarget,
  onClose,
}: Pick<DashboardActionProps, 'state' | 'onRead' | 'onReadAll' | 'onOpenTarget' | 'onClose'>) {
  const { t, locale } = useTranslation(messages);

  const { notify } = useAppAlert();
  const unread = state.activities.filter((activity) => !activity.read).length;
  return (
    <>
      <div className={styles.scrollBody}>
        <div className={styles.notificationList}>
          {state.activities.length ? (
            state.activities.map((activity) => (
              <article
                key={activity.id}
                className={styles.notification}
                data-unread={!activity.read || undefined}
              >
                <button
                  type="button"
                  className={`${styles.notificationTarget} fouc-action`}
                  onClick={() => {
                    onRead(activity.id);
                    onClose();
                    onOpenTarget(activity.target);
                  }}
                >
                  <Bell size={18} />
                  <span>
                    <strong>{activity.actor}</strong> {fixtureField(activity, 'text', locale)}{' '}
                    <b>{fixtureField(activity, 'subject', locale)}</b>
                    <time>{fixtureField(activity, 'time', locale)}</time>
                  </span>
                </button>
                {!activity.read ? (
                  <button
                    type="button"
                    className={`${styles.readButton} fouc-action`}
                    aria-label={t('Mark {v0} as read', {
                      v0: fixtureField(activity, 'subject', locale),
                    })}
                    onClick={() => onRead(activity.id)}
                  >
                    <Check size={15} />
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p className={styles.empty}>{t('No notifications yet.')}</p>
          )}
        </div>
      </div>
      <footer>
        <DashboardButton
          tone="neutral"
          disabled={!unread}
          onClick={() => {
            onReadAll();
            notify('success', t('Notifications marked as read'));
          }}
        >
          {t('Mark all as read')}
        </DashboardButton>
        <DashboardButton onClick={onClose}>{t('Done')}</DashboardButton>
      </footer>
    </>
  );
}

export function DashboardActionDialog(props: DashboardActionProps) {
  const { t } = useTranslation(messages);

  const { action, state, onClose } = props;
  return (
    <DashboardModal
      title={action === 'Invite' ? t('Invite collaborators') : action}
      onClose={onClose}
    >
      {action === 'Create Task' ? (
        <CreateTaskForm
          state={state}
          initialProjectId={props.initialProjectId}
          onCreate={props.onCreateTask}
          onClose={onClose}
        />
      ) : null}
      {action === 'New Project' ? (
        <NewProjectForm onCreate={props.onCreateProject} onClose={onClose} />
      ) : null}
      {action === 'Invite' ? (
        <InviteForm memberIds={state.memberIds} onInvite={props.onInvite} onClose={onClose} />
      ) : null}
      {action === 'Notifications' ? <Notifications {...props} /> : null}
      {action === 'Help Center' ? (
        <>
          <div className={styles.scrollBody}>
            <div className={styles.helpContent}>
              <h3>{t('Working with your projects')}</h3>
              <p>
                {t(
                  'Projects group tasks. Create a task, choose its project and schedule, then open it to update details or add a comment.',
                )}
              </p>
              <p>
                {t(
                  'Use the four document shortcuts for invoices, proposals, contracts and forms. Save drafts, download their content, or collect form responses on this device.',
                )}
              </p>
              <p>
                {t(
                  'Meetings have their own agenda, attendees and calendar export. Notifications open the item that changed.',
                )}
              </p>
              <p>
                {t('Dashboard changes are saved on this device for the selected Fouc project.')}
              </p>
            </div>
          </div>
          <footer>
            <DashboardButton onClick={onClose}>{t('Got it')}</DashboardButton>
          </footer>
        </>
      ) : null}
    </DashboardModal>
  );
}

export function DashboardDeleteDialog({
  title,
  description,
  onClose,
  onDelete,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(messages);

  return (
    <DashboardModal title={title} onClose={onClose}>
      <div className={styles.helpContent}>
        <p>{description}</p>
      </div>
      <footer>
        <DashboardButton tone="neutral" onClick={onClose}>
          {t('Cancel')}
        </DashboardButton>
        <DashboardButton data-variant="destructive" className={styles.danger} onClick={onDelete}>
          {t('Delete')}
        </DashboardButton>
      </footer>
    </DashboardModal>
  );
}
