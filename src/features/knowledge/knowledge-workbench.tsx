'use client';

import type { ReactNode } from 'react';
import { SidebarSimple } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { IconButton } from './dense-sidebar/icon-button';
import styles from './knowledge-workbench.module.css';

/** One presentation for all knowledge resources; adapters own data and actions. */
export function KnowledgeWorkbench({ sidebar, children, overlays, onExpandSidebar, documentOpen = false, sidebarOpen = false, onCloseSidebar }: {
  sidebar: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
  onExpandSidebar?: () => void;
  documentOpen?: boolean;
  sidebarOpen?: boolean;
  onCloseSidebar?: () => void;
}) {
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} data-document-editor={documentOpen || undefined} className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--panel)]">
    <div className="flex h-full min-h-0">
      {documentOpen && sidebarOpen ? <button type="button" className={styles.sidebarScrim} aria-label="关闭知识库导航" onClick={onCloseSidebar} /> : null}
      <div className={documentOpen ? styles.documentSidebar : styles.standardSidebar} data-open={sidebarOpen || undefined}>{sidebar}</div>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {!documentOpen && onExpandSidebar ? <IconButton label="展开知识库侧边栏" tooltip="展开侧栏" onClick={onExpandSidebar} className="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-md text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><SidebarSimple size={18} /></IconButton> : null}
        {children}
      </div>
    </div>
    {overlays}
  </motion.div>;
}
