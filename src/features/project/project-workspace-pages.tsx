'use client';

import { Archive, FolderSimple, ListChecks, UsersThree } from '@/components/icons';
import { useTranslation } from '@/lib/i18n';
import { useProjectResources } from './project-resources';
import { messages } from './i18n/project-workspace-pages';
import styles from './project-workspace-pages.module.css';

export function ProjectEmptyPage({ page }: { page: 'tasks' | 'members' | 'assets' }) {
  const { t } = useTranslation(messages);
  const Icon = { tasks: ListChecks, members: UsersThree, assets: Archive }[page];
  return <section className={styles.page} aria-label={t(page)}><header className={styles.header}><h1>{t(page)}</h1></header><div className={styles.empty}><Icon size={36} aria-hidden /><h2>{t(`${page}Empty`)}</h2><p>{t(`${page}Description`)}</p></div></section>;
}

export function ProjectSelectionEmpty() {
  const { t } = useTranslation(messages);
  const { status } = useProjectResources();
  return <section className={styles.page}><div className={styles.empty}><FolderSimple size={36} aria-hidden /><h2>{t(status === 'loading' ? 'loading' : 'selectProject')}</h2>{status !== 'loading' && <p>{t('selectDescription')}</p>}</div></section>;
}
