'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DatabaseObjectInfo } from '@fouc/shared';
import type { DatabaseExportTableTarget } from '@fouc/shared/database-export';
import { backendFetch } from '@/lib/backend';

/** Load only the selected schemas when the user asks to choose individual objects. */
export function useDatabaseExportCatalogue(base: string, schemas: string[], initial: DatabaseExportTableTarget[] | undefined, enabled: boolean) {
  const [catalogue, setCatalogue] = useState<DatabaseExportTableTarget[]>(initial ?? []);
  const [loaded, setLoaded] = useState(() => new Set(initial?.map(table => table.schema) ?? []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const schemaKey = JSON.stringify(schemas);
  const missing = useMemo(() => (JSON.parse(schemaKey) as string[]).filter(schema => !loaded.has(schema)), [loaded, schemaKey]);
  useEffect(() => {
    if (!enabled || !missing.length) return;
    const controller = new AbortController();
    let next = 0;
    const rows: DatabaseExportTableTarget[] = [];
    const requested = [...missing];
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(null); } });
    const worker = async () => {
      while (next < requested.length) {
        controller.signal.throwIfAborted();
        const schema = requested[next++];
        const objects = await backendFetch<DatabaseObjectInfo[]>(`${base}/schemas/${encodeURIComponent(schema)}/tables`, { signal: controller.signal });
        controller.signal.throwIfAborted();
        rows.push(...objects.filter(object => object.schema === schema && ['table', 'view', 'materialized_view'].includes(object.kind)).map(object => ({ schema, table: object.name })));
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, requested.length) }, worker)).then(() => {
      if (controller.signal.aborted) return;
      setCatalogue(previous => [...previous.filter(table => !requested.includes(table.schema)), ...rows]);
      setLoaded(previous => new Set([...previous, ...requested]));
    }).catch(error => {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : String(error));
        setLoading(false);
        controller.abort();
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, enabled, missing, revision]);
  return { tables: catalogue, loading: enabled && missing.length > 0 && loading, error, retry: () => setRevision(value => value + 1) };
}
