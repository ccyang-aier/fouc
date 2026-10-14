'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './tag-dialog.messages';
import { useState, type FormEvent } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { SqlDialog } from '../sql-library-dialog';
import { appendConnectionTags } from './batch';
import common from '../relational.module.css';
import styles from './tag-dialog.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export function ConnectionTagsDialog({
  initialTags,
  title: titleProvided,
  additive = false,
  onSave,
  onClose,
}: {
  initialTags: string[];
  title?: string;
  additive?: boolean;
  onSave: (tags: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const title = titleProvided === undefined ? tConnector('manageTags') : titleProvided;
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  function withDraft() {
    return appendConnectionTags(tags, draft.split(/[,，]/));
  }
  function addTags() {
    try {
      setTags(withDraft());
      setDraft('');
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error ? uiFailure(cause) : connectorUiMessages.message('invalidTags'),
      );
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    try {
      const next = withDraft();
      setBusy(true);
      await onSave(next);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? uiFailure(cause) : connectorUiMessages.message('couldNotSave'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SqlDialog title={title} busy={busy} onClose={onClose} className={styles.dialog}>
      <form onSubmit={(event) => void submit(event)}>
        <div className={styles.body}>
          <fieldset
            disabled={busy}
            className={styles.fieldset}
            aria-label={tConnector('connectionTags')}
          >
            <div className={styles.tags}>
              {tags.map((tag) => (
                <span key={tag}>
                  {tag}
                  <button
                    type="button"
                    aria-label={tConnector('removeTag', { p0: String(tag) })}
                    onClick={() => setTags((previous) => previous.filter((value) => value !== tag))}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className={styles.add}>
              <input
                aria-label={tConnector('addConnectionTags')}
                placeholder={tConnector('enterATagThenPressEnter')}
                value={draft}
                maxLength={400}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addTags();
                  }
                }}
              />
              <button
                type="button"
                aria-label={tConnector('addTag')}
                disabled={!draft.trim()}
                onClick={addTags}
              >
                <Plus size={15} />
              </button>
            </div>
          </fieldset>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className={`${common.dialogFooter} ${styles.footer}`}>
          <button type="button" className={common.secondary} disabled={busy} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <button
            type="submit"
            className={common.primary}
            disabled={busy || (additive && !tags.length && !draft.trim())}
          >
            {busy ? tConnector('saving') : additive ? tConnector('addTag') : tConnector('save')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
