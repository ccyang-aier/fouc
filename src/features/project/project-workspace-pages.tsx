'use client';

import { Archive, ChatCircleDots, FolderSimple, ListChecks, Plus, UsersThree } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { chatConversationTitle, useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useTranslation } from '@/lib/i18n';
import { formatRelativeTime } from '@/lib/relative-time';
import { useProjectResources } from './project-resources';
import { messages } from './i18n/project-workspace-pages';
import styles from './project-workspace-pages.module.css';

export function ProjectEmptyPage({ page }: { page: 'tasks' | 'members' | 'assets' }) {
  const { t } = useTranslation(messages);
  const Icon = { tasks: ListChecks, members: UsersThree, assets: Archive }[page];
  return <section className={styles.page} aria-label={t(page)}><header className={styles.header}><h1>{t(page)}</h1></header><div className={styles.empty}><Icon size={36} weight="duotone" aria-hidden /><h2>{t(`${page}Empty`)}</h2><p>{t(`${page}Description`)}</p></div></section>;
}

export function ProjectSelectionEmpty() {
  const { t } = useTranslation(messages);
  const { status } = useProjectResources();
  return <section className={styles.page}><div className={styles.empty}><FolderSimple size={36} weight="duotone" aria-hidden /><h2>{t(status === 'loading' ? 'loading' : 'selectProject')}</h2>{status !== 'loading' && <p>{t('selectDescription')}</p>}</div></section>;
}

export function ProjectChatsPage({ onNew, onOpen }: { onNew: () => void; onOpen: (entry: ChatHistoryEntry) => void }) {
  const { t, locale } = useTranslation(messages);
  const history = useChatHistory();
  return <section className={styles.page} aria-label={t('chats')}>
    <header className={styles.header}><h1>{t('chats')}</h1><Button size="sm" variant="outline" onClick={onNew}><Plus size={15} />{t('newChat')}</Button></header>
    {history.length ? <ul className={styles.list}>{history.map(entry => <li key={entry.id}><button type="button" className={`fouc-action ${styles.row}`} onClick={() => onOpen(entry)}><ChatCircleDots size={22} weight="duotone" /><span><strong>{chatConversationTitle(entry)}</strong><small>{t('messages', { count: entry.submissions.length })}</small></span><time dateTime={entry.updatedAt.toISOString()}>{formatRelativeTime(entry.updatedAt.getTime(), locale)}</time></button></li>)}</ul> : <div className={styles.empty}><ChatCircleDots size={36} weight="duotone" aria-hidden /><h2>{t('noChats')}</h2><p>{t('chatDescription')}</p><Button size="sm" onClick={onNew}><Plus size={15} />{t('newChat')}</Button></div>}
  </section>;
}
