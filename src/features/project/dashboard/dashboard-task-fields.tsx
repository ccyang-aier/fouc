'use client';

import { useTranslation } from '@/lib/i18n';
import { fixtureField, registerProjectFixtures, translateFixed } from '../i18n/display';
import { messages } from './i18n/dashboard-task-fields';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarBlank,
  CaretDown,
  Check,
  CircleDashed,
  Flame,
  Plus,
  SealCheck,
  Tag,
  User,
  X,
} from '@phosphor-icons/react';
import { useId, useState, type ReactNode } from 'react';
import {
  dashboardPeople,
  type DashboardPersonId,
  type DashboardPriority,
  type DashboardStatus,
  type DashboardTask,
} from './dashboard-model';
import styles from './dashboard-task-dialog.module.css';
import { Avatar } from './dashboard-ui';

const people = Object.values(dashboardPeople);
const priorities: DashboardPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const statuses: DashboardStatus[] = ['To Do', 'On Progress', 'Completed'];

function ChoiceMenu({
  label,
  value,
  values,
  onChange,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  compact?: boolean;
}) {
  const { locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={compact ? styles.priority : styles.control}
        aria-label={`${label}: ${uiLabel(value)}`}
        data-priority={compact ? value.toLowerCase() : undefined}
      >
        {icon}
        {uiLabel(value)}
        {compact ? null : <CaretDown size={13} className={styles.caret} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" density="compact">
        {values.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => onChange(option)}>
            {uiLabel(option)}
            <span className={styles.menuCheck}>
              {option === value ? <Check size={13} /> : null}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PeopleMenu({
  label,
  selected,
  onToggle,
  children,
}: {
  label: string;
  selected: DashboardPersonId[];
  onToggle: (id: DashboardPersonId) => void;
  children?: ReactNode;
}) {
  const { locale } = useTranslation(messages);

  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={`${styles.addPerson} fouc-action`} aria-label={label}>
        {children ?? <Plus size={13} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" density="compact">
        {people.map((person) => (
          <DropdownMenuCheckboxItem
            key={person.id}
            checked={selected.includes(person.id)}
            onCheckedChange={() => onToggle(person.id)}
            onSelect={(event) => event.preventDefault()}
          >
            <Avatar id={person.id} size={22} />
            {fixtureField(person, 'name', locale)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardTaskFields({
  task,
  onChange,
}: {
  task: DashboardTask;
  onChange: (task: DashboardTask) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const dateId = useId();
  const dueDate = new Date(`${task.dueDate}T12:00:00`);
  const formattedDate = Number.isNaN(dueDate.valueOf())
    ? translateFixed('Choose a date', locale)
    : dueDate.toLocaleDateString(locale, { month: 'short', day: '2-digit', year: 'numeric' });

  function toggleAssignee(id: DashboardPersonId) {
    const assignees = task.assignees.includes(id)
      ? task.assignees.filter((person) => person !== id)
      : [...task.assignees, id];
    onChange({ ...task, assignees, cardPeople: assignees });
  }

  return (
    <div className={styles.fields}>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>
          <User size={16} />
          {t('Assignee')}
        </span>
        <div className={styles.assignees}>
          {task.assignees.map((id) => (
            <button
              type="button"
              key={id}
              className={`${styles.assigneeChip} fouc-action`}
              data-person={id}
              aria-label={t('Remove {v0} from assignees', {
                v0: fixtureField(dashboardPeople[id], 'name', locale),
              })}
              onClick={() => toggleAssignee(id)}
            >
              {fixtureField(dashboardPeople[id], 'name', locale)}
              <X size={11} />
            </button>
          ))}
          <PeopleMenu
            label={t('Add assignees')}
            selected={task.assignees}
            onToggle={toggleAssignee}
          />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>
          <Tag size={16} />
          {t('Tags')}
        </span>
        <ChoiceMenu
          label={t('Tag')}
          value={task.tag}
          values={['Mobile App', 'Website', 'Dashboard', 'Branding']}
          onChange={(tag) => onChange({ ...task, tag })}
        />
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>
          <SealCheck size={16} />
          {t('Status')}
        </span>
        <ChoiceMenu
          label={t('Status')}
          value={task.status}
          values={statuses}
          icon={task.status === 'Completed' ? <Check size={15} /> : <CircleDashed size={15} />}
          onChange={(status) =>
            onChange({
              ...task,
              status: status as DashboardStatus,
              progress:
                status === 'Completed'
                  ? 100
                  : status === 'To Do'
                    ? 0
                    : task.progress > 0 && task.progress < 100
                      ? task.progress
                      : 1,
            })
          }
        />
      </div>
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor={dateId}>
          <CalendarBlank size={16} />
          {t('Due date')}
        </label>
        <div className={styles.dateControl}>
          <span>{formattedDate}</span>
          <input
            id={dateId}
            type="date"
            value={task.dueDate}
            onClick={(event) => event.currentTarget.showPicker?.()}
            onInput={(event) => {
              const dueDate = event.currentTarget.value;
              if (dueDate) onChange({ ...task, dueDate });
            }}
            aria-label={t('Due date')}
          />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>
          <Flame size={16} />
          {t('Priority')}
        </span>
        <div>
          <ChoiceMenu
            compact
            label={t('Priority')}
            value={task.priority}
            values={priorities}
            onChange={(priority) => onChange({ ...task, priority: priority as DashboardPriority })}
          />
        </div>
      </div>
    </div>
  );
}

registerProjectFixtures([priorities, statuses]);
