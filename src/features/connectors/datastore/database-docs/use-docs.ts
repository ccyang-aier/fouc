import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './use-docs.messages';
import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend';
import {
  editDatabaseDocsAnnotations,
  type DatabaseDocsAnnotationState,
  type DatabaseDocsEdit,
  type DatabaseDocsSnapshot,
} from '@fouc/shared/database-docs';
const connectorUiMessages = createUiMessages(connectorMessages);
interface Loaded {
  key: string;
  raw: DatabaseDocsSnapshot | null;
  notes: DatabaseDocsAnnotationState | null;
  error: UiMessage;
}
export function useDatabaseDocs(base: string, schemas: string[], revision: number) {
  const { locale } = useTranslation(connectorMessages);
  const body = JSON.stringify({ schemas }),
    key = `${base}:${body}:${revision}`;
  const [state, setState] = useState<Loaded | null>(null),
    [saving, setSaving] = useState(false),
    [saveErrorStored, setSaveError] = useState<UiMessage>(''),
    [savedAt, setSavedAt] = useState<number | null>(null);
  const saveError = uiText(saveErrorStored, locale);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      backendFetch<DatabaseDocsSnapshot>(`${base}/database-docs/snapshot`, {
        method: 'POST',
        body,
        signal: controller.signal,
      }),
      backendFetch<DatabaseDocsAnnotationState>(`${base}/database-docs/annotations`, {
        signal: controller.signal,
      }),
    ])
      .then(([raw, notes]) => {
        if (!controller.signal.aborted) setState({ key, raw, notes, error: '' });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            raw: null,
            notes: null,
            error: uiFailure(error),
          });
      });
    return () => controller.abort();
  }, [base, body, key]);
  const loaded = state?.key === key ? state : null;
  async function save(edit: DatabaseDocsEdit) {
    if (!loaded?.notes || saving)
      throw connectorUiMessages.error('documentationNotesAreNotReadyOrAreBeingSaved');
    setSaving(true);
    setSaveError('');
    try {
      const annotations = editDatabaseDocsAnnotations(loaded.notes.annotations, edit);
      const notes = await backendFetch<DatabaseDocsAnnotationState>(
        `${base}/database-docs/annotations`,
        { method: 'PUT', body: JSON.stringify({ version: loaded.notes.version, annotations }) },
      );
      setState((current) => (current?.key === key ? { ...current, notes } : current));
      setSavedAt(notes.updatedAt);
    } catch (error) {
      setSaveError(uiFailure(error));
      throw error;
    } finally {
      setSaving(false);
    }
  }
  async function reloadNotes() {
    if (saving) return;
    try {
      const notes = await backendFetch<DatabaseDocsAnnotationState>(
        `${base}/database-docs/annotations`,
      );
      setState((current) => (current?.key === key ? { ...current, notes } : current));
      setSaveError('');
    } catch (error) {
      setSaveError(error instanceof Error ? uiFailure(error) : String(error));
    }
  }
  return {
    raw: loaded?.raw ?? null,
    notes: loaded?.notes ?? null,
    loading: loaded === null,
    error: uiText(loaded?.error ?? '', locale),
    saving,
    saveError,
    savedAt,
    save,
    reloadNotes,
  };
}
