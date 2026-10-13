'use client';

import type { DashboardProject, DashboardTask } from './dashboard-model';
import styles from './dashboard-task-dialog.module.css';

export function dashboardStartTime(startHour: number) {
  const minutes = Math.round(startHour * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function taskSettingError(task: DashboardTask, projects: DashboardProject[]) {
  if (!task.title.trim()) return 'Enter a task title.';
  if (!projects.some((project) => project.id === task.projectId))
    return 'Choose a project for this task.';
  if (!task.scheduledDate) return 'Choose a scheduled date.';
  if (!Number.isFinite(task.startHour) || task.startHour < 0 || task.startHour >= 24)
    return 'Choose a start time.';
  if (!Number.isFinite(task.durationHours) || task.durationHours <= 0)
    return 'Duration must be greater than zero.';
  if (task.startHour + task.durationHours > 24) return 'The task must end on the scheduled day.';
  if (!task.dueDate) return 'Choose a due date.';
  return '';
}

export function DashboardTaskSettings({
  task,
  projects,
  onChange,
  onOpenProject,
}: {
  task: DashboardTask;
  projects: DashboardProject[];
  onChange: (task: DashboardTask) => void;
  onOpenProject: (projectId: string) => void;
}) {
  return (
    <div className={styles.detailContent}>
      <label className={styles.settingField}>
        Task title
        <input
          value={task.title}
          maxLength={120}
          onChange={(event) =>
            onChange({
              ...task,
              title: event.currentTarget.value,
              detailTitle: event.currentTarget.value,
            })
          }
        />
      </label>
      <div className={styles.projectSetting}>
        <label className={styles.settingField}>
          Project
          <select
            value={task.projectId}
            onChange={(event) => onChange({ ...task, projectId: event.currentTarget.value })}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`fouc-action ${styles.openProject}`}
          onClick={() => onOpenProject(task.projectId)}
        >
          Open project details
        </button>
      </div>
      <label className={styles.settingField}>
        Progress <span>{task.progress}%</span>
        <input
          type="range"
          min="0"
          max="100"
          value={task.progress}
          onChange={(event) => {
            const progress = Number(event.currentTarget.value);
            onChange({
              ...task,
              progress,
              status: progress === 100 ? 'Completed' : progress > 0 ? 'On Progress' : 'To Do',
            });
          }}
        />
      </label>
      <div className={styles.scheduleFields}>
        <label className={styles.settingField}>
          Scheduled date
          <input
            type="date"
            value={task.scheduledDate}
            onInput={(event) => onChange({ ...task, scheduledDate: event.currentTarget.value })}
          />
        </label>
        <label className={styles.settingField}>
          Start time
          <input
            type="time"
            value={Number.isFinite(task.startHour) ? dashboardStartTime(task.startHour) : ''}
            onInput={(event) => {
              const [hour, minute] = event.currentTarget.value.split(':').map(Number);
              onChange({ ...task, startHour: hour + minute / 60 });
            }}
          />
        </label>
        <label className={styles.settingField}>
          Duration (hours)
          <input
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={Number.isFinite(task.durationHours) ? task.durationHours : ''}
            onChange={(event) =>
              onChange({
                ...task,
                durationHours: event.currentTarget.value
                  ? Number(event.currentTarget.value)
                  : Number.NaN,
              })
            }
          />
        </label>
      </div>
      <label className={styles.settingField}>
        Activity map row
        <select
          value={task.timelineCategory}
          onChange={(event) =>
            onChange({
              ...task,
              timelineCategory: event.currentTarget.value as DashboardTask['timelineCategory'],
            })
          }
        >
          {(['Dashboard Design', 'Mobile App', 'Landing Page'] as const).map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
