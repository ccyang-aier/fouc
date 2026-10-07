"use client"
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { SavedSqlDocument, SqlDraftSnapshot, SqlDraftState } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlDraftController } from './sql-draft-controller'

// A failed save survives an internal route unmount until the user can recover it.
const controllers = new Map<string, SqlDraftController>()
export function forgetSqlDrafts(base: string): void { controllers.delete(`${base}/sql-library`) }
function persistentController(base: string, initial: () => SqlDraftSnapshot): SqlDraftController {
  const existing = controllers.get(base); if (existing) return existing
  const controller = new SqlDraftController({
    read: async () => {
      const remote = await backendFetch<SqlDraftState>(`${base}/drafts`)
      const files = new Map<string, SavedSqlDocument | null>()
      const ids = [...new Set(remote.tabs.flatMap((tab) => tab.savedFile ? [tab.savedFile.id] : []))]
      const library = ids.length ? await backendFetch<{ files: { id: string }[] }>(base) : null
      await Promise.all(ids.map(async (id) => {
        // Metadata distinguishes deletion from network/permission errors: only an absent file is detached.
        if (!library?.files.some((file) => file.id === id)) { files.set(id, null); return }
        files.set(id, await backendFetch<SavedSqlDocument>(`${base}/files/${id}`))
      }))
      return { ...remote, tabs: remote.tabs.map((tab) => {
        if (!tab.savedFile) return tab
        const file = files.get(tab.savedFile.id)
        if (!file) return { ...tab, savedFile: null, originalSql: '' }
        if (tab.sql !== tab.originalSql) return tab
        return { ...tab, sql: file.sql, originalSql: file.sql, database: file.database, schema: file.schema, title: tab.customTitle ? tab.title : file.name,
          savedFile: { id: file.id, name: file.name, version: file.version, folderId: file.folderId } }
      }) }
    },
    write: (snapshot, version, keepalive) => {
      const body = JSON.stringify({ ...snapshot, version })
      return backendFetch<SqlDraftState>(`${base}/drafts`, { method: 'PUT', body, keepalive: keepalive && new TextEncoder().encode(body).length < 60 * 1024 })
    },
  }, initial)
  controllers.set(base, controller); return controller
}
export function useSqlDrafts(base: string | null, initial: () => SqlDraftSnapshot) {
  const [controller] = useState(() => base ? persistentController(base, initial) : new SqlDraftController(null, initial))
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => {
    void controller.load()
    const beforeUnload = (event: BeforeUnloadEvent) => { if (controller.getSnapshot().pending) { event.preventDefault(); event.returnValue = ''; } }
    const pageHide = () => { void controller.flush(true).catch(() => undefined) }
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide)
      void controller.flush().then(() => {
        // Successful scopes reload canonical device/file state on reconnect; only failures stay cached.
        if (base && !controller.hasSubscribers() && controllers.get(base) === controller) controllers.delete(base)
      }).catch(() => undefined)
    }
  }, [base, controller])
  return { state, controller }
}
