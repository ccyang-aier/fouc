"use client"

import { useEffect, useRef } from 'react'
import type { RelationalProvider } from '@fouc/shared'
import type { SqlDraftController, SqlDraftWorkspace } from './sql-draft-controller'
import { newSqlTab, nextSqlQueryTitle } from './sql-tabs'

export type SqlOpenRequest = { id: string; sql: string; schema: string }

/** A ready query view consumes an open command once, including effect replay and remounts. */
export function useSqlOpenRequest({ controller, state, active, request, provider, database, schema, onConsumed }: {
  controller: SqlDraftController; state: SqlDraftWorkspace; request?: SqlOpenRequest | null;
  active: boolean;
  provider: RelationalProvider; database: string; schema: string; onConsumed: (id: string) => void;
}) {
  const initialized = useRef(false)
  const consumedRequest = useRef<string | null>(null)
  useEffect(() => {
    if (!state.ready || !active) return
    const firstReady = !initialized.current
    initialized.current = true
    const snapshot = controller.getSnapshot()
    if (request && consumedRequest.current !== request.id) {
      consumedRequest.current = request.id
      if (!snapshot.tabs.some(tab => tab.id === request.id)) {
        const tab = { ...newSqlTab(provider === 'mysql' ? request.schema : database, request.schema, request.sql ? '外键关联查询' : nextSqlQueryTitle(snapshot.tabs), request.id),
          sql: request.sql, originalSql: '', customTitle: Boolean(request.sql) }
        controller.update(current => ({ tabs: [...current.tabs, tab], activeTabId: tab.id }))
      }
      onConsumed(request.id)
    } else if (!request && firstReady && snapshot.version === null && !snapshot.pending && snapshot.status === 'ready' && !snapshot.tabs.length) {
      const tab = newSqlTab(provider === 'mysql' ? schema || database : database, schema || null, nextSqlQueryTitle(snapshot.tabs))
      controller.update(current => ({ tabs: [...current.tabs, tab], activeTabId: tab.id }))
    }
  }, [state.ready, active, controller, request, provider, database, schema, onConsumed])
}
