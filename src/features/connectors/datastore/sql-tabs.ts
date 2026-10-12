import type { SqlDraftSnapshot, SqlDraftTab } from '@fouc/shared';

/** DBX tabNavigationHistory: closed entries are skipped, a new visit drops the forward branch. */
export interface SqlTabVisits { entries: string[]; index: number }
export function visitSqlTab(visits: SqlTabVisits, id: string): SqlTabVisits {
  if (visits.entries[visits.index] === id) return visits;
  const entries = [...visits.entries.slice(0, visits.index + 1), id].slice(-100);
  return { entries, index: entries.length - 1 };
}
export function navigateSqlTabs(visits: SqlTabVisits, direction: -1 | 1, snapshot: SqlDraftSnapshot): { visits: SqlTabVisits; id: string } | null {
  const open = new Set(snapshot.tabs.map((tab) => tab.id));
  for (let index = visits.index + direction; index >= 0 && index < visits.entries.length; index += direction) {
    const id = visits.entries[index];
    if (id !== snapshot.activeTabId && open.has(id)) return { visits: { ...visits, index }, id };
  }
  return null;
}
export function newSqlTab(database: string, schema: string | null, title = '未命名查询', id: string = crypto.randomUUID()): SqlDraftTab {
  const sql = 'SELECT 1 AS result;';
  return { id, title, customTitle: false, pinned: false, database, schema, sql, originalSql: sql,
    savedFile: null, editorPosition: { anchor: 0, head: 0, scrollTop: 0, scrollLeft: 0 }, resultView: 'table' };
}
export function nextSqlQueryTitle(tabs: readonly SqlDraftTab[]): string {
  let number = tabs.length + 1
  while (tabs.some(tab => tab.title === `查询 ${number}`)) number++
  return `查询 ${number}`
}
export function sqlTabDirty(tab: SqlDraftTab): boolean { return tab.sql !== tab.originalSql; }
export function sqlTabSaveable(tab: SqlDraftTab): boolean { return Boolean(tab.savedFile) || Boolean(tab.sql.trim()); }
export function closeSqlTabs(snapshot: SqlDraftSnapshot, ids: readonly string[]): SqlDraftSnapshot {
  const closing = new Set(ids), tabs = snapshot.tabs.filter((tab) => !closing.has(tab.id));
  if (snapshot.activeTabId && !closing.has(snapshot.activeTabId)) return { tabs, activeTabId: snapshot.activeTabId };
  const current = snapshot.tabs.findIndex((tab) => tab.id === snapshot.activeTabId);
  // DBX chooses the next surviving neighbour, then the previous one.
  const next = snapshot.tabs.slice(current + 1).find((tab) => !closing.has(tab.id));
  const previous = snapshot.tabs.slice(0, current).findLast((tab) => !closing.has(tab.id));
  return { tabs, activeTabId: next?.id ?? previous?.id ?? tabs[0]?.id ?? null };
}
export function reorderSqlTab(snapshot: SqlDraftSnapshot, id: string, beforeId: string): SqlDraftSnapshot {
  const source = snapshot.tabs.find((tab) => tab.id === id), target = snapshot.tabs.find((tab) => tab.id === beforeId);
  if (!source || !target || id === beforeId || source.pinned !== target.pinned) return snapshot;
  const tabs = snapshot.tabs.filter((tab) => tab.id !== id);
  tabs.splice(tabs.findIndex((tab) => tab.id === beforeId), 0, source);
  return { ...snapshot, tabs };
}
export function pinSqlTab(snapshot: SqlDraftSnapshot, id: string): SqlDraftSnapshot {
  const tabs = snapshot.tabs.map((tab) => tab.id === id ? { ...tab, pinned: !tab.pinned } : tab);
  return { ...snapshot, tabs: [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)] };
}
/** Retain both documents on a concurrent-window conflict; identical tabs are deduplicated. */
export function mergeSqlDrafts(remote: SqlDraftSnapshot, local: SqlDraftSnapshot): SqlDraftSnapshot {
  const tabs = [...remote.tabs]; let activeTabId = local.activeTabId;
  for (const tab of local.tabs) {
    const existing = tabs.find((candidate) => candidate.id === tab.id);
    if (!existing) { tabs.push(tab); continue; }
    if (JSON.stringify(existing) === JSON.stringify(tab)) continue;
    const copy = { ...tab, id: crypto.randomUUID(), title: `${tab.title.slice(0, 190)} · 本地草稿`, customTitle: true, pinned: false, savedFile: null, originalSql: '' };
    tabs.push(copy); if (activeTabId === tab.id) activeTabId = copy.id;
  }
  return { tabs: [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)], activeTabId: activeTabId ?? remote.activeTabId };
}
