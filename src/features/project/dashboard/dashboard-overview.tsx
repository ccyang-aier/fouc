'use client';

import { DotsThree } from '@phosphor-icons/react';
import { DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DashboardMenu, DashboardMenuContent } from './dashboard-menu';
import { ReferenceIcon } from './dashboard-ui';
import { selectStats } from './dashboard-selectors';
import type { DashboardDocumentKind, DashboardState } from './dashboard-model';
import type { DashboardSection } from './dashboard-sidebar';
import styles from './dashboard.module.css';

const shortcuts: { label: string; kind: DashboardDocumentKind }[] = [
  { label: 'Send a invoice', kind: 'invoice' },
  { label: 'Draft a Proposal', kind: 'proposal' },
  { label: 'Create a contract', kind: 'contract' },
  { label: 'Add a form', kind: 'form' },
];

export function DashboardOverview({
  state,
  onCreateDocument,
  onViewStat,
}: {
  state: DashboardState;
  onCreateDocument: (kind: DashboardDocumentKind) => void;
  onViewStat: (section: DashboardSection, status?: 'On Progress' | 'Completed') => void;
}) {
  const totals = selectStats(state);
  const stats = [
    {
      label: 'Total Projects',
      value: totals.projects,
      detail: 'Active Projects',
      section: 'Portfolio',
    },
    { label: 'Total Task', value: totals.tasks, detail: 'Tasks Created', section: 'My Task' },
    {
      label: 'In Progress',
      value: totals.inProgress,
      detail: 'Task',
      section: 'My Task',
      status: 'On Progress',
    },
    {
      label: 'Completed',
      value: totals.completed,
      detail: 'Task',
      section: 'My Task',
      status: 'Completed',
    },
  ] as const;

  return (
    <>
      <div className={styles.shortcuts}>
        {shortcuts.map(({ label, kind }) => (
          <button
            type="button"
            className={`fouc-action ${styles.shortcut}`}
            key={kind}
            onClick={() => onCreateDocument(kind)}
          >
            <span>
              <ReferenceIcon name={kind} size={40} />
            </span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <article className={styles.statCard} key={stat.label}>
            <div>
              <span>{stat.label}</span>
              <DashboardMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`fouc-action ${styles.flatIcon}`}
                    aria-label={`${stat.label} options`}
                  >
                    <DotsThree size={17} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DashboardMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      onViewStat(stat.section, 'status' in stat ? stat.status : undefined)
                    }
                  >
                    View {stat.label.toLowerCase()}
                  </DropdownMenuItem>
                </DashboardMenuContent>
              </DashboardMenu>
            </div>
            <p>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
