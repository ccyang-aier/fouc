import { uiText, type UiMessage, uiFailure } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './note-editor.messages';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import type { DatabaseDocsNote } from '@fouc/shared/database-docs';
import styles from './database-docs.module.css';
function safeMarkdownUrl(value: string): string {
  const url = value.trim();
  if (/^[/\\]{2}/.test(url)) return '';
  return /^(?:https?:|mailto:|#|\/(?!\/)|\.\.?\/)/i.test(url) ? url : '';
}
export function DocsMarkdown({ children }: { children: string }) {
  return (
    <div className={styles.markdown}>
      <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeMarkdownUrl}>
        {children}
      </Markdown>
    </div>
  );
}
export function DocsNoteEditor({
  label,
  note,
  editable,
  saving,
  onSave,
}: {
  label: string;
  note: DatabaseDocsNote;
  editable: boolean;
  saving: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(''),
    [errorStored, setError] = useState<UiMessage>(''),
    [preview, setPreview] = useState(false);
  const error = uiText(errorStored, locale);
  async function submit() {
    try {
      setError('');
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      setError(error instanceof Error ? uiFailure(error) : String(error));
    }
  }
  return (
    <div className={styles.noteEditor}>
      <div className={styles.sectionHeader}>
        <span>{label}</span>
        {editable && !editing && (
          <button
            disabled={saving}
            className={styles.textButton}
            onClick={() => {
              setDraft(note.local ?? '');
              setEditing(true);
              setError('');
            }}
          >
            <PencilSimple size={12} />
            {note.local === null ? tConnector('addLocalNote') : tConnector('editLocalNote')}
          </button>
        )}
      </div>
      {note.database !== null && (
        <div className={styles.nativeNote}>
          <span className={styles.sourceLabel}>{tConnector('nativeDatabaseComment')}</span>
          <DocsMarkdown>{note.database}</DocsMarkdown>
        </div>
      )}
      {editing ? (
        <div className={styles.editorForm}>
          <div className={styles.editorTabs}>
            <button data-active={!preview} onClick={() => setPreview(false)}>
              Markdown
            </button>
            <button data-active={preview} onClick={() => setPreview(true)}>
              {tConnector('preview')}
            </button>
            <small>
              {new TextEncoder().encode(draft).length.toLocaleString(locale)}
              {tConnector('bytes')}
            </small>
          </div>
          {preview ? (
            <div className={styles.notePreview}>
              <DocsMarkdown>{draft || tConnector('noNoteEnteredYet')}</DocsMarkdown>
            </div>
          ) : (
            <textarea
              aria-label={`${label} Markdown`}
              rows={5}
              maxLength={65536}
              value={draft}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={tConnector('localMarkdownNoteClearToUseTheNativeDatabaseComment')}
            />
          )}
          <p className={styles.helper}>
            {tConnector('savedOnlyToThisDeviceSConnectionAndDatabaseNative')}
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.editorActions}>
            <button
              className={styles.secondary}
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              {tConnector('cancel')}
            </button>
            <button
              className={styles.primary}
              disabled={saving || new TextEncoder().encode(draft).length > 65536}
              onClick={() => void submit()}
            >
              <Check size={13} />
              {saving ? tConnector('saving') : tConnector('saveNote')}
            </button>
          </div>
        </div>
      ) : note.local !== null ? (
        <div className={styles.localNote}>
          <span className={styles.sourceLabel}>{tConnector('deviceLocalMarkdownNote')}</span>
          <DocsMarkdown>{note.local}</DocsMarkdown>
        </div>
      ) : (
        note.database === null && (
          <p className={styles.emptyNote}>
            {tConnector('noDescription')}
            {editable
              ? tConnector('addALocalMarkdownNote')
              : tConnector('theCurrentConnectionIsNotSaved')}
          </p>
        )
      )}
    </div>
  );
}
