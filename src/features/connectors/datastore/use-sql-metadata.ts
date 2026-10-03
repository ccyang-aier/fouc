"use client"
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { DatabaseColumnInfo, DatabaseObjectInfo, RelationalSession } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlMetadataCompletion } from './sql-metadata-completion'

export function useSqlMetadata(session: RelationalSession, revision: number) {
  const [metadata] = useState(() => {
    const base = `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/relational/sessions/${session.id}/schemas`
    return new SqlMetadataCompletion(session.provider, {
      tables: (schema, signal) => backendFetch<DatabaseObjectInfo[]>(`${base}/${encodeURIComponent(schema)}/tables`, { signal }),
      columns: (schema, table, signal) => backendFetch<DatabaseColumnInfo[]>(`${base}/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/columns`, { signal }),
    })
  })
  const state = useSyncExternalStore(metadata.subscribe, metadata.getSnapshot, metadata.getSnapshot)
  useEffect(() => { metadata.clear(); return () => metadata.clear() }, [metadata, revision])
  return { metadata, state }
}
