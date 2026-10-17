'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HomeCanvas } from '@/features/home/home-canvas';
import type { ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { CommunityCanvas } from '@/features/community/community-canvas';
import { ConnectorsCanvas } from '@/features/connectors/connectors-canvas';
import { KnowledgePage } from '@/features/knowledge/knowledge-page';
import { ProjectDashboard } from '@/features/project/dashboard/project-dashboard';
import { ProjectChatsPage, ProjectEmptyPage, ProjectSelectionEmpty } from '@/features/project/project-workspace-pages';
import { useProjectResources } from '@/features/project/project-resources';
import { AgentSettings } from '@/features/settings/agent-settings';
import { SettingsDialog } from '@/features/settings/settings-dialog';
import { HelpFeedbackCanvas } from '@/features/help/help-feedback-canvas';
import { closeSettings, setSettingsSection, useSettingsSection } from '@/lib/settings-navigation';
import { useMenuMotion } from '@/lib/use-menu-motion';
import { applyAppearancePrefs, readAppearancePrefs } from '@/lib/appearance';
import { setOverlayRoot } from '@/lib/overlay-root';
import { manageWindowFrame } from '@/lib/window-frame';
import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/navigation-sidebar.messages';
import { useWorkbenchView, type WorkbenchView } from './workbench-view';
import { NavigationSidebar } from './navigation-sidebar';
import { SystemBar } from './system-bar';
import styles from './workbench-shell.module.css';

export function WorkbenchShell() {
  const { t } = useTranslation(messages);
  useMenuMotion();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversationVersion, setConversationVersion] = useState(0);
  const [conversation, setConversation] = useState<{ scopeKey: string; entry: ChatHistoryEntry } | null>(null);
  const [view, setView, settingsOpen] = useWorkbenchView();
  const settingsSection = useSettingsSection();
  const { projects, selectedProject, selectProject, scopeKey } = useProjectResources();
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => { applyAppearancePrefs(readAppearancePrefs()); }, []);
  useEffect(() => {
    setOverlayRoot(frameRef.current);
    let disposeFrame: (() => void) | undefined;
    void manageWindowFrame().then(dispose => { disposeFrame = dispose; });
    return () => { disposeFrame?.(); setOverlayRoot(null); };
  }, []);
  function changeView(next: WorkbenchView) {
    if (next === 'home') { setConversationVersion(value => value + 1); setConversation(null); }
    setView(next);
  }
  function openChat(entry: ChatHistoryEntry) {
    if (!scopeKey) return;
    setConversationVersion(value => value + 1);
    setConversation({ scopeKey, entry });
    setView('home');
  }
  const activeConversation = conversation?.scopeKey === scopeKey ? conversation.entry : undefined;
  const projectView = ['home', 'workbench', 'tasks', 'members', 'assets', 'chats', 'agents'].includes(view);
  return <TooltipProvider>
    <div className="h-dvh w-full p-[var(--win-frame-inset)]">
      <div ref={frameRef} className={`${styles.frame} flex h-full w-full min-w-[660px] min-h-[540px] flex-col overflow-hidden bg-background text-[var(--ink)] shadow-[var(--win-shadow)]`}>
        <div className="flex min-h-0 flex-1">
          <div className={`${styles.navigation} flex shrink-0`}><NavigationSidebar open={!sidebarCollapsed} onCollapse={() => setSidebarCollapsed(true)} onExpand={() => setSidebarCollapsed(false)} view={view} onViewChange={changeView} onProjectChange={() => { setConversation(null); setView('workbench'); }} onOpenChat={openChat} /></div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className={styles.systemBar}><SystemBar onNavigate={changeView} /></div>
            <main className="relative min-w-0 flex-1 overflow-hidden bg-panel">
              <div key={projectView ? scopeKey ?? 'no-project' : view} className="relative h-full min-h-0">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }} className="absolute inset-0">
                    {projectView && (!selectedProject || !scopeKey) ? <ProjectSelectionEmpty /> : view === 'home' ? <HomeCanvas key={`${scopeKey}:${activeConversation?.id ?? 'new'}:${conversationVersion}`} conversation={activeConversation} onOpenConnectors={() => changeView('connectors')} />
                      : view === 'workbench' && selectedProject && scopeKey ? <ProjectDashboard projectName={selectedProject.name} scopeKey={scopeKey} onNavigate={changeView} />
                      : view === 'tasks' || view === 'members' || view === 'assets' ? <ProjectEmptyPage page={view} />
                      : view === 'chats' ? <ProjectChatsPage onNew={() => changeView('home')} onOpen={openChat} />
                      : view === 'agents' ? <section className="h-full overflow-auto" aria-label={t('智能体')}><AgentSettings /></section>
                      : view === 'community' ? <CommunityCanvas />
                      : view === 'connectors' ? <ConnectorsCanvas onOpenProject={id => { if (projects.some(project => project.id === id)) selectProject(id); changeView('workbench'); }} />
                      : view === 'knowledge' ? <KnowledgePage onOpenSettings={() => changeView('settings')} />
                      : view === 'help' ? <HelpFeedbackCanvas onNavigate={changeView} /> : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>
        </div>
        <SettingsDialog open={settingsOpen} section={settingsSection} onSectionChange={setSettingsSection} onClose={closeSettings} />
      </div>
    </div>
  </TooltipProvider>;
}
