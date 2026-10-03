import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend';
import { editDatabaseDocsAnnotations, type DatabaseDocsAnnotationState, type DatabaseDocsEdit, type DatabaseDocsSnapshot } from '@fouc/shared/database-docs';

interface Loaded { key: string; raw: DatabaseDocsSnapshot | null; notes: DatabaseDocsAnnotationState | null; error: string }
export function useDatabaseDocs(base: string, schemas: string[], revision: number) {
  const body = JSON.stringify({ schemas }), key = `${base}:${body}:${revision}`;
  const [state, setState] = useState<Loaded | null>(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      backendFetch<DatabaseDocsSnapshot>(`${base}/database-docs/snapshot`, { method: 'POST', body, signal: controller.signal }),
      backendFetch<DatabaseDocsAnnotationState>(`${base}/database-docs/annotations`, { signal: controller.signal }),
    ]).then(([raw, notes]) => { if (!controller.signal.aborted) setState({ key, raw, notes, error: '' }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, raw: null, notes: null, error: error instanceof Error ? error.message : String(error) }); });
    return () => controller.abort();
  }, [base, body, key]);
  const loaded = state?.key === key ? state : null;
  async function save(edit: DatabaseDocsEdit) {
    if (!loaded?.notes || saving) throw new Error('文档笔记尚未就绪或正在保存');
    setSaving(true); setSaveError('');
    try {
      const annotations = editDatabaseDocsAnnotations(loaded.notes.annotations, edit);
      const notes = await backendFetch<DatabaseDocsAnnotationState>(`${base}/database-docs/annotations`, { method: 'PUT', body: JSON.stringify({ version: loaded.notes.version, annotations }) });
      setState(current => current?.key === key ? { ...current, notes } : current); setSavedAt(notes.updatedAt);
    } catch (error) { const message = error instanceof Error ? error.message : String(error); setSaveError(message); throw new Error(message); }
    finally { setSaving(false); }
  }
  async function reloadNotes() {
    if (saving) return;
    try { const notes = await backendFetch<DatabaseDocsAnnotationState>(`${base}/database-docs/annotations`); setState(current => current?.key === key ? { ...current, notes } : current); setSaveError(''); }
    catch (error) { setSaveError(error instanceof Error ? error.message : String(error)); }
  }
  return { raw: loaded?.raw ?? null, notes: loaded?.notes ?? null, loading: loaded === null, error: loaded?.error ?? '', saving, saveError, savedAt, save, reloadNotes };
}
