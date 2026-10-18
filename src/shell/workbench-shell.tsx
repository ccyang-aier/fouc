'use client';

import { useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { chatConversationTitle, useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useProjectResources } from '@/features/project/project-resources';
import { SettingsDialog } from '@/features/settings/settings-dialog';
import { closeSettings, setSettingsSection, useSettingsSection } from '@/lib/settings-navigation';
import { useMenuMotion } from '@/lib/use-menu-motion';
import { applyAppearancePrefs, readAppearancePrefs } from '@/lib/appearance';
import { setOverlayRoot } from '@/lib/overlay-root';
import { manageWindowFrame } from '@/lib/window-frame';
import { useWorkbenchView, type WorkbenchView } from './workbench-view';
import { NavigationSidebar } from './navigation-sidebar';
import { SystemBar } from './system-bar';
import { WorkbenchTabBar } from './workbench-tab-bar';
import { WorkbenchPanels } from './workbench-panels';
import { useWorkbenchTabs } from './use-workbench-tabs';
import styles from './workbench-shell.module.css';

export function WorkbenchShell() {
  useMenuMotion();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const settingsSection = useSettingsSection();
  const { scopeKey } = useProjectResources();
  const [view, setView, settingsOpen, navigation, search] = useWorkbenchView(scopeKey);
  const history = useChatHistory();
  const tabs = useWorkbenchTabs(scopeKey, view, search, history.map(entry => entry.id));
  const titles = new Map(history.map(entry => [entry.id, chatConversationTitle(entry)]));
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => { applyAppearancePrefs(readAppearancePrefs()); }, []);
  useEffect(() => {
    setOverlayRoot(frameRef.current);
    let disposeFrame: (() => void) | undefined;
    void manageWindowFrame().then(dispose => { disposeFrame = dispose; });
    return () => { disposeFrame?.(); setOverlayRoot(null); };
  }, []);
  function changeView(next: WorkbenchView) {
    if (next === 'settings') setView(next);
    else tabs.open(next);
  }
  function openChat(entry: ChatHistoryEntry) {
    if (!scopeKey) return;
    tabs.open('home', entry.id);
  }
  return <TooltipProvider>
    <div className="h-dvh w-full p-[var(--win-frame-inset)]">
      <div ref={frameRef} className={`${styles.frame} flex h-full w-full min-w-[660px] min-h-[540px] flex-col overflow-hidden text-[var(--ink)] shadow-[var(--win-shadow)]`}>
        <div className="flex min-h-0 flex-1">
          <div className={`${styles.navigation} flex shrink-0`}><NavigationSidebar open={!sidebarCollapsed} onCollapse={() => setSidebarCollapsed(true)} onExpand={() => setSidebarCollapsed(false)} view={view} onViewChange={changeView} onProjectChange={() => setView('workbench')} onOpenChat={openChat} /></div>
          <div className={styles.workspace}>
            <div className={styles.systemBar}><SystemBar onNavigate={changeView} navigation={navigation}>{tabs.ready ? <WorkbenchTabBar key={scopeKey ?? 'no-project'} tabs={tabs.tabs} active={tabs.active} titles={titles} onActivate={tabs.activate} onClose={tabs.close} onReorder={tabs.reorder} /> : <div className="flex-1" />}</SystemBar></div>
            <main className={styles.content}>
              <WorkbenchPanels tabs={tabs.tabs} active={tabs.active} history={history} onNavigate={changeView} onOpenChat={openChat} onConversationStarted={tabs.promote} />
            </main>
          </div>
        </div>
        <SettingsDialog open={settingsOpen} section={settingsSection} onSectionChange={setSettingsSection} onClose={closeSettings} />
      </div>
    </div>
  </TooltipProvider>;
}
