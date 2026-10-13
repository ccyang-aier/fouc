'use client';

import { useState } from 'react';
import { Star } from '@phosphor-icons/react';
import { DashboardModal } from './dashboard-modal';
import { DashboardButton } from './dashboard-ui';
import { selectFavorites } from './dashboard-selectors';
import type { DashboardMilestone, DashboardState, DashboardTarget } from './dashboard-model';
import styles from './dashboard-management.module.css';

export function DashboardFavoritesDialog({
  state,
  onClose,
  onSave,
}: {
  state: DashboardState;
  onClose: () => void;
  onSave: (targets: DashboardTarget[]) => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(selectFavorites(state).map((item) => item.id)),
  );
  const options = [
    ...state.projects.map((project) => ({
      id: `project:${project.id}`,
      title: project.name,
      type: 'Project',
      target: { kind: 'project', id: project.id } as const,
    })),
    ...state.tasks.map((task) => ({
      id: `task:${task.id}`,
      title: task.title,
      type: 'Task',
      target: { kind: 'task', id: task.id } as const,
    })),
    ...state.documents.map((document) => ({
      id: `document:${document.id}`,
      title: document.title,
      type: document.kind,
      target: { kind: 'document', id: document.id } as const,
    })),
  ];

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DashboardModal title="Manage favourites" onClose={onClose}>
      <div className={styles.favoriteList}>
        {options.map((option) => (
          <label key={option.id} className="fouc-action">
            <Star size={18} weight={selected.has(option.id) ? 'fill' : 'regular'} />
            <span>
              <strong>{option.title}</strong>
              <small>{option.type}</small>
            </span>
            <input
              type="checkbox"
              checked={selected.has(option.id)}
              onChange={() => toggle(option.id)}
            />
          </label>
        ))}
        {!options.length ? <p>No items to add yet.</p> : null}
      </div>
      <footer>
        <DashboardButton tone="neutral" onClick={onClose}>
          Cancel
        </DashboardButton>
        <DashboardButton
          onClick={() => {
            onSave(
              options.filter((option) => selected.has(option.id)).map((option) => option.target),
            );
            onClose();
          }}
        >
          Save favourites
        </DashboardButton>
      </footer>
    </DashboardModal>
  );
}

export function DashboardMilestoneDialog({
  milestones,
  onClose,
  onSave,
}: {
  milestones: DashboardMilestone[];
  onClose: () => void;
  onSave: (milestones: DashboardMilestone[]) => void;
}) {
  const [draft, setDraft] = useState(() => milestones.map((item) => ({ ...item })));
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');

  function change(index: number, field: 'target' | 'completed', value: string) {
    setDraft((current) =>
      current.map((item, position) =>
        position === index ? { ...item, [field]: Number(value) } : item,
      ),
    );
  }

  function addMonth() {
    if (!month || draft.some((item) => item.month === month)) {
      setError('Choose a month that is not already listed.');
      return;
    }
    setDraft((current) =>
      [...current, { month, target: 0, completed: 0 }].sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    );
    setError('');
    setMonth('');
  }

  return (
    <DashboardModal title="Milestone targets and history" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <div className={styles.milestoneFields}>
          <p>Completed tasks are added to recorded history for their due month.</p>
          <div className={styles.tableHeading}>
            <span>Month</span>
            <span>Target</span>
            <span>Recorded work</span>
          </div>
          {draft.map((item, index) => (
            <div className={styles.monthRow} key={item.month}>
              <time dateTime={item.month}>
                {new Date(`${item.month}-01T12:00:00`).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                required
                aria-label={`${item.month} target`}
                value={item.target}
                onChange={(event) => change(index, 'target', event.target.value)}
              />
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                required
                aria-label={`${item.month} recorded work`}
                value={item.completed}
                onChange={(event) => change(index, 'completed', event.target.value)}
              />
            </div>
          ))}
          <div className={styles.addMonth}>
            <input
              type="month"
              value={month}
              aria-label="Add milestone month"
              onInput={(event) => setMonth(event.currentTarget.value)}
            />
            <DashboardButton tone="neutral" onClick={addMonth}>
              Add month
            </DashboardButton>
          </div>
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </div>
        <footer>
          <DashboardButton tone="neutral" onClick={onClose}>
            Cancel
          </DashboardButton>
          <DashboardButton type="submit">Save milestones</DashboardButton>
        </footer>
      </form>
    </DashboardModal>
  );
}
