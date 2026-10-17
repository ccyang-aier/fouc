'use client';

import { useTranslation } from '@/lib/i18n';
import { fixtureField, registerProjectFixtures, translateFixed } from '../i18n/display';
import { messages } from './i18n/dashboard-overview';

import { DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DotsThree } from '@phosphor-icons/react';
import { DashboardMenu, DashboardMenuContent } from './dashboard-menu';
import type { DashboardDocumentKind, DashboardState } from './dashboard-model';
import { selectStats } from './dashboard-selectors';
import type { ProjectDashboardDestination } from './project-dashboard';
import { ReferenceIcon } from './dashboard-ui';
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
  onNavigate,
}: {
  state: DashboardState;
  onCreateDocument: (kind: DashboardDocumentKind) => void;
  onNavigate: (view: ProjectDashboardDestination) => void;
}) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const totals = selectStats(state);
  const stats = [
    {
      label: t('Total assets'),
      value: state.documents.length,
      detail: t('Project assets'),
      view: 'assets',
    },
    {
      label: uiLabel('Total Task'),
      value: totals.tasks,
      detail: uiLabel('Tasks Created'),
      view: 'tasks',
    },
    {
      label: uiLabel('In Progress'),
      value: totals.inProgress,
      detail: uiLabel('Task'),
      view: 'tasks',
    },
    {
      label: uiLabel('Completed'),
      value: totals.completed,
      detail: uiLabel('Task'),
      view: 'tasks',
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
            <strong>{uiLabel(label)}</strong>
          </button>
        ))}
      </div>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <article className={styles.statCard} key={stat.label}>
            <div>
              <span>{fixtureField(stat, 'label', locale)}</span>
              <DashboardMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`fouc-action ${styles.flatIcon}`}
                    aria-label={t('{v0} options', { v0: fixtureField(stat, 'label', locale) })}
                  >
                    <DotsThree size={17} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DashboardMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => onNavigate(stat.view)}
                  >
                    {t('View')}{' '}
                    {fixtureField(stat, 'label', locale).toLowerCase()}
                  </DropdownMenuItem>
                </DashboardMenuContent>
              </DashboardMenu>
            </div>
            <p>
              <strong>{fixtureField(stat, 'value', locale)}</strong>
              <small>{uiLabel(stat.detail)}</small>
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

registerProjectFixtures([shortcuts]);
