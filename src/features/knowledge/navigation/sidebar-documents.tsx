'use client';

import type { ReactNode } from 'react';
import { FileText } from '@phosphor-icons/react';
import type { Page } from '@fouc/shared/knowledge/contracts';
import { pageDisplayTitle, type NavigationSection } from './tree-model';

/** Use the same reachable tree as navigation: a recycled ancestor hides its descendants. */
export function sidebarDocuments(sections: readonly NavigationSection[], pages: readonly Page[]): Page[] {
  const ids = new Set<string>();
  function visit(nodes: NavigationSection['pages']) {
    for (const node of nodes) {
      ids.add(node.id);
      visit(node.children);
    }
  }
  for (const section of sections) visit(section.pages);
  return pages.filter((page) => ids.has(page.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function SidebarDocuments({ pages, selectedPageId, onSelect, indented = false, renderAction }: {
  pages: readonly Page[];
  selectedPageId: string | null;
  onSelect: (page: Page) => void;
  indented?: boolean;
  renderAction?: (page: Page) => ReactNode;
}) {
  if (!pages.length) return <p className="px-2 py-3 text-[12px] text-[var(--muted)]">还没有文档</p>;
  return <div className="space-y-px">{pages.map((page) => (
    <div key={page.id} className="group/document flex items-center">
    <button type="button" data-active={selectedPageId === page.id} aria-current={selectedPageId === page.id ? 'page' : undefined} onClick={() => onSelect(page)} className="sidebar-nav-row flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-md pr-1.5 text-left text-[12px] text-[var(--ink-soft)]" style={{ paddingLeft: indented ? 20 : 6 }}>
      <FileText aria-hidden size={15} /><span className="truncate">{pageDisplayTitle(page)}</span>
    </button>
    {renderAction?.(page)}
    </div>
  ))}</div>;
}
