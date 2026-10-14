'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  DatabaseColumnInfo,
  DatabaseObjectInfo,
  RelationalSession,
  RelationalTableStructure,
} from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { SqlMetadataCompletion } from './sql-metadata-completion';
import { SqlJoinCompletion } from './sql-assistance/join/completion';
import { useLocale } from '@/lib/i18n';
import { uiText } from '../i18n/ui-message';

export function useSqlMetadata(session: RelationalSession, revision: number) {
  const locale = useLocale();
  const { metadata, join } = useMemo(() => {
    const base = `/api/database/relational/sessions/${session.id}/schemas`;
    const tables = (schema: string, signal: AbortSignal) =>
      backendFetch<DatabaseObjectInfo[]>(`${base}/${encodeURIComponent(schema)}/tables`, {
        signal,
      });
    const metadata = new SqlMetadataCompletion(session.provider, {
      tables,
      columns: (schema, table, signal) =>
        backendFetch<DatabaseColumnInfo[]>(
          `${base}/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/columns`,
          { signal },
        ),
    });
    const join = new SqlJoinCompletion(session.provider, {
      tables,
      structure: (schema, table, signal) =>
        backendFetch<RelationalTableStructure>(
          `${base}/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/structure`,
          { signal },
        ),
    });
    return { metadata, join };
  }, [session.id, session.provider]);
  const state = useSyncExternalStore(
    metadata.subscribe,
    metadata.getSnapshot,
    metadata.getSnapshot,
  );
  const joinState = useSyncExternalStore(join.subscribe, join.getSnapshot, join.getSnapshot);
  useEffect(() => {
    metadata.clear();
    join.clear();
    return () => {
      metadata.clear();
      join.clear();
    };
  }, [metadata, join, revision]);
  return {
    metadata,
    join,
    state: {
      pending: state.pending + joinState.pending,
      error: uiText(state.error || joinState.error, locale),
    },
  };
}
