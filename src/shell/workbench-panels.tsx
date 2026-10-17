'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HomeCanvas } from '@/features/home/home-canvas';
import type { ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { CommunityCanvas } from '@/features/community/community-canvas';
import { ConnectorsCanvas } from '@/features/connectors/connectors-canvas';
import { KnowledgePage } from '@/features/knowledge/knowledge-page';
import { ProjectDashboard } from '@/features/project/dashboard/project-dashboard';
import { ProjectChatsPage, ProjectEmptyPage, ProjectSelectionEmpty } from '@/features/project/project-workspace-pages';
import { useProjectResources } from '@/features/project/project-resources';
import { AgentSettings } from '@/features/settings/agent-settings';
import { PageVisibility } from '@/lib/page-visibility';
import { useTranslation } from '@/lib/i18n';
import type { WorkbenchView } from './workbench-view';
import { workbenchPanelId, workbenchTabId, type WorkbenchTab } from './workbench-tabs';
import { messages } from './i18n/navigation-sidebar.messages';
import styles from './workbench-shell.module.css';

export function WorkbenchPanels({ tabs, active, history, onNavigate, onOpenChat, onConversationStarted }: {
  tabs: WorkbenchTab[]; active: string; history: ChatHistoryEntry[];
  onNavigate: (view: WorkbenchView) => void; onOpenChat: (entry: ChatHistoryEntry) => void;
  onConversationStarted: (instance: number, id: string) => void;
}) {
  const { t } = useTranslation(messages);
  const { projects, selectedProject, selectProject, scopeKey } = useProjectResources();
  return tabs.map(tab => {
    const visible = tab.key === active;
    const projectPage = !['community', 'connectors', 'knowledge'].includes(tab.view);
    // Keep actual DOM/editors mounted: hiding must not destroy collaboration or undo.
    return <WorkbenchPanel key={`${scopeKey}:${tab.instance}`} tab={tab} visible={visible}>
        {projectPage && (!selectedProject || !scopeKey) ? <ProjectSelectionEmpty />
          : tab.view === 'home' ? <HomeCanvas conversation={history.find(entry => entry.id === tab.conversationId)} onOpenConnectors={() => onNavigate('connectors')} onOpenConversation={onOpenChat} onNewConversation={() => onNavigate('home')} onConversationStarted={id => onConversationStarted(tab.instance, id)} />
          : tab.view === 'workbench' && selectedProject && scopeKey ? <ProjectDashboard projectName={selectedProject.name} scopeKey={scopeKey} onNavigate={onNavigate} />
          : tab.view === 'tasks' || tab.view === 'members' || tab.view === 'assets' ? <ProjectEmptyPage page={tab.view} />
          : tab.view === 'chats' ? <ProjectChatsPage onNew={() => onNavigate('home')} onOpen={onOpenChat} />
          : tab.view === 'agents' ? <section className="h-full overflow-auto" aria-label={t('智能体')}><AgentSettings /></section>
          : tab.view === 'community' ? <CommunityCanvas />
          : tab.view === 'connectors' ? <ConnectorsCanvas onOpenProject={id => { if (projects.some(project => project.id === id)) selectProject(id); onNavigate('workbench'); }} />
          : tab.view === 'knowledge' ? <KnowledgePage onOpenSettings={() => onNavigate('settings')} />
          : null}
    </WorkbenchPanel>;
  });
}

function WorkbenchPanel({ tab, visible, children }: { tab: WorkbenchTab; visible: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // Native modal dialogs otherwise leave the whole window inert after browser Back.
    if (!visible) ref.current?.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog => dialog.close());
  }, [visible]);
  return <section ref={ref} role="tabpanel" id={workbenchPanelId(tab.instance)} aria-labelledby={workbenchTabId(tab.instance)} hidden={!visible} inert={!visible} className={styles.page}>
    <PageVisibility value={visible}>{children}</PageVisibility>
  </section>;
}
