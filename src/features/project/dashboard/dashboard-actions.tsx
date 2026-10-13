'use client';

import { useState } from 'react';
import { Check, Bell } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DashboardButton } from './dashboard-ui';
import { DashboardMemberPicker, DashboardModal } from './dashboard-modal';
import type {
  DashboardPersonId,
  DashboardPriority,
  DashboardProject,
  DashboardState,
  DashboardTarget,
  DashboardTask,
} from './dashboard-model';
import styles from './dashboard-actions.module.css';

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
    notify('success', 'Task created');
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
            Task name
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder="Give it a name"
            />
          </label>
          <label>
            Project
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              required
            >
              <option value="" disabled>
                Choose a project
              </option>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a description"
              rows={3}
            />
          </label>
          <div className={styles.fieldGrid}>
            <label>
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as DashboardPriority)}
              >
                {['Low', 'Medium', 'High', 'Urgent'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Due date
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
              Scheduled date
              <input
                type="date"
                required
                value={scheduledDate}
                onInput={(event) => setScheduledDate(event.currentTarget.value)}
              />
            </label>
            <label>
              Start time
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
              Duration (hours)
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
              Timeline category
              <select
                value={timelineCategory}
                onChange={(event) =>
                  setTimelineCategory(event.target.value as DashboardTask['timelineCategory'])
                }
              >
                {['Dashboard Design', 'Mobile App', 'Landing Page'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className={styles.memberField}>
            <legend>Assignees</legend>
            <DashboardMemberPicker
              selected={assignees}
              onChange={setAssignees}
              ids={Array.from(new Set(['sarah' as const, ...state.memberIds]))}
            />
          </fieldset>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <footer>
        <DashboardButton type="button" tone="neutral" onClick={onClose}>
          Cancel
        </DashboardButton>
        <DashboardButton type="submit">Create task</DashboardButton>
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
        notify('success', 'Project created');
        onClose();
      }}
    >
      <div className={styles.scrollBody}>
        <div className={styles.fields}>
          <label>
            Project name
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Give it a name"
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What are you working on?"
            />
          </label>
          <div className={styles.fieldGrid}>
            <label>
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as DashboardPriority)}
              >
                {['Low', 'Medium', 'High', 'Urgent'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Color
              <select
                value={color}
                onChange={(event) => setColor(event.target.value as DashboardProject['color'])}
              >
                <option value="green">Sage</option>
                <option value="orange">Orange</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <footer>
        <DashboardButton type="button" tone="neutral" onClick={onClose}>
          Cancel
        </DashboardButton>
        <DashboardButton type="submit">Create project</DashboardButton>
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
  const [selected, setSelected] = useState(memberIds);
  const { notify } = useAppAlert();
  return (
    <>
      <div className={styles.scrollBody}>
        <div className={styles.helpContent}>
          <p>Choose collaborators for this dashboard.</p>
          <DashboardMemberPicker selected={selected} onChange={setSelected} />
        </div>
      </div>
      <footer>
        <DashboardButton type="button" tone="neutral" onClick={onClose}>
          Cancel
        </DashboardButton>
        <DashboardButton
          onClick={() => {
            onInvite(selected);
            notify('success', 'Collaborators saved');
            onClose();
          }}
        >
          Save
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
                    <strong>{activity.actor}</strong> {activity.text} <b>{activity.subject}</b>
                    <time>{activity.time}</time>
                  </span>
                </button>
                {!activity.read ? (
                  <button
                    type="button"
                    className={`${styles.readButton} fouc-action`}
                    aria-label={`Mark ${activity.subject} as read`}
                    onClick={() => onRead(activity.id)}
                  >
                    <Check size={15} />
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p className={styles.empty}>No notifications yet.</p>
          )}
        </div>
      </div>
      <footer>
        <DashboardButton
          tone="neutral"
          disabled={!unread}
          onClick={() => {
            onReadAll();
            notify('success', 'Notifications marked as read');
          }}
        >
          Mark all as read
        </DashboardButton>
        <DashboardButton onClick={onClose}>Done</DashboardButton>
      </footer>
    </>
  );
}

export function DashboardActionDialog(props: DashboardActionProps) {
  const { action, state, onClose } = props;
  return (
    <DashboardModal title={action === 'Invite' ? 'Invite collaborators' : action} onClose={onClose}>
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
              <h3>Working with your projects</h3>
              <p>
                Projects group tasks. Create a task, choose its project and schedule, then open it
                to update details or add a comment.
              </p>
              <p>
                Use the four document shortcuts for invoices, proposals, contracts and forms. Save
                drafts, download their content, or collect form responses on this device.
              </p>
              <p>
                Meetings have their own agenda, attendees and calendar export. Notifications open
                the item that changed.
              </p>
              <p>Dashboard changes are saved on this device for the selected Fouc project.</p>
            </div>
          </div>
          <footer>
            <DashboardButton onClick={onClose}>Got it</DashboardButton>
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
  return (
    <DashboardModal title={title} onClose={onClose}>
      <div className={styles.helpContent}>
        <p>{description}</p>
      </div>
      <footer>
        <DashboardButton tone="neutral" onClick={onClose}>
          Cancel
        </DashboardButton>
        <DashboardButton data-variant="destructive" className={styles.danger} onClick={onDelete}>
          Delete
        </DashboardButton>
      </footer>
    </DashboardModal>
  );
}
