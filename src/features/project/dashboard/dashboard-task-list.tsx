'use client';

import { Check, DotsThree, Plus, Star, Trash } from '@phosphor-icons/react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DashboardMenu as DropdownMenu,
  DashboardMenuContent as DropdownMenuContent,
} from './dashboard-menu';
import { AvatarGroup, DashboardButton, IconButton } from './dashboard-ui';
import type { DashboardProject, DashboardTask } from './dashboard-model';
import styles from './dashboard-task-list.module.css';

interface DashboardTaskListProps {
  tasks: DashboardTask[];
  projects: DashboardProject[];
  onOpen: (taskId: string) => void;
  onCreate: () => void;
  onSave: (task: DashboardTask) => void;
  onDelete: (task: DashboardTask) => void;
}

function dueDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DashboardTaskList({
  tasks,
  projects,
  onOpen,
  onCreate,
  onSave,
  onDelete,
}: DashboardTaskListProps) {
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <section className={styles.panel} aria-label="Tasks">
      <header className={styles.header}>
        <h2>
          Tasks <span>{tasks.length}</span>
        </h2>
        <DashboardButton onClick={onCreate}>
          <Plus size={14} />
          Create Task
        </DashboardButton>
      </header>
      {tasks.length ? (
        <div className={styles.rows}>
          <div className={styles.columnHeaders} aria-hidden="true">
            <span>Task</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Due date</span>
            <span>Assignees</span>
            <span />
          </div>
          {tasks.map((task) => (
            <article key={task.id} className={styles.row}>
              <div className={styles.taskInfo}>
                <button type="button" onClick={() => onOpen(task.id)}>
                  <span>{task.title}</span>
                  {task.starred ? <Star size={12} weight="fill" aria-label="Favourite" /> : null}
                </button>
                <span className={styles.taskMeta}>
                  <span title={projectNames.get(task.projectId)}>
                    {projectNames.get(task.projectId) || 'Unassigned project'}
                  </span>
                  <small data-priority={task.priority}>{task.priority}</small>
                </span>
              </div>
              <span className={styles.status} data-status={task.status}>
                <span />
                {task.status}
              </span>
              <div className={styles.progress}>
                <div
                  role="progressbar"
                  aria-label={`${task.title} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={task.progress}
                >
                  <span style={{ width: `${task.progress}%` }} />
                </div>
                <span>{task.progress}%</span>
              </div>
              <time className={styles.dueDate} dateTime={task.dueDate}>
                {dueDate(task.dueDate)}
              </time>
              <AvatarGroup
                ids={task.assignees.slice(0, 3)}
                size={24}
                extra={Math.max(0, task.assignees.length - 3)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label={`${task.title} options`}>
                    <DotsThree size={18} weight="bold" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onOpen(task.id)}>Open task</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onSave({ ...task, starred: !task.starred })}>
                    <Star weight={task.starred ? 'fill' : 'regular'} />
                    {task.starred ? 'Remove from favourites' : 'Add to favourites'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      onSave({
                        ...task,
                        status: task.status === 'Completed' ? 'To Do' : 'Completed',
                        progress: task.status === 'Completed' ? 0 : 100,
                      })
                    }
                  >
                    <Check />
                    {task.status === 'Completed' ? 'Reopen task' : 'Mark as complete'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
                    <Trash />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>No tasks found</p>
          <DashboardButton tone="neutral" onClick={onCreate}>
            Create Task
          </DashboardButton>
        </div>
      )}
    </section>
  );
}
