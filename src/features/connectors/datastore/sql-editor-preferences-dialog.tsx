'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-editor-preferences-dialog.messages';
import { useState } from 'react';
import {
  ArrowClockwise,
  Check,
  CodeBlock,
  FloppyDisk,
  SlidersHorizontal,
  WarningCircle,
} from '@phosphor-icons/react';
import type { RelationalProvider, SqlEditorPreferences } from '@fouc/shared';
import { backendFetch } from '@/lib/backend';
import { SqlDialog } from './sql-library-dialog';
import { SqlEditorFormatterSettings } from './sql-editor-formatter-settings';
import { SqlEditorSnippetSettings, sqlSnippetSettingsIssue } from './sql-editor-snippet-settings';
import common from './relational.module.css';
import styles from './sql-editor-preferences.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Props = {
  base: string;
  initial: SqlEditorPreferences;
  provider: RelationalProvider;
  onSaved: (value: SqlEditorPreferences) => void;
  onClose: () => void;
};
function content(value: SqlEditorPreferences): string {
  return JSON.stringify([value.formatter, value.formatOnSave, value.snippets]);
}
/** One connection owns the draft; failed writes never replace the user's local edits. */
export function SqlEditorPreferencesDialog({ base, initial, provider, onSaved, onClose }: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [draft, setDraft] = useState<SqlEditorPreferences>(() => structuredClone(initial)),
    [tab, setTab] = useState<'format' | 'snippets'>('format');
  const [busy, setBusy] = useState<'save' | 'read' | null>(null),
    [errorStored, setError] = useState<UiMessage>(''),
    [noticeStored, setNotice] = useState<UiMessage>(''),
    [formatterIssue, setFormatterIssue] = useState('');
  const error = uiText(errorStored, locale);
  const notice = uiText(noticeStored, locale);
  const [remote, setRemote] = useState<SqlEditorPreferences | null>(null),
    [discard, setDiscard] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState(0);
  const dirty = content(draft) !== content(initial),
    issue = formatterIssue || sqlSnippetSettingsIssue(draft.snippets, locale);
  function close() {
    if (busy) return;
    if (dirty || formatterIssue) setDiscard(true);
    else onClose();
  }
  async function save() {
    if (busy || issue) return;
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const saved = await backendFetch<SqlEditorPreferences>(`${base}/preferences`, {
        method: 'PUT',
        body: JSON.stringify({
          version: draft.version,
          formatter: draft.formatter,
          formatOnSave: draft.formatOnSave,
          snippets: draft.snippets,
        }),
      });
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(null);
    }
  }
  async function readRemote() {
    if (busy) return;
    setBusy('read');
    setNotice('');
    try {
      setRemote(await backendFetch<SqlEditorPreferences>(`${base}/preferences`));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setBusy(null);
    }
  }
  function applyDeviceVersion() {
    if (!remote) return;
    setDraft(structuredClone(remote));
    setRemote(null);
    setLoadedRevision((current) => current + 1);
    setFormatterIssue('');
    setNotice(connectorUiMessages.message('deviceVersionLoadedSaveToApplyItToTheEditor'));
  }
  function retainDraft() {
    if (!remote) return;
    setDraft((current) => ({ ...current, version: remote.version, updatedAt: remote.updatedAt }));
    setRemote(null);
    setNotice(connectorUiMessages.message('yourEditsWereKeptSavingWillReplaceTheDeviceVersion'));
  }
  return (
    <SqlDialog
      title={tConnector('sqlEditorSettings')}
      busy={Boolean(busy)}
      className={styles.dialog}
      onClose={close}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={styles.intro}>
          <div>
            <strong>{tConnector('keepEveryQueryTidy')}</strong>
            <p>{tConnector('formattingRulesAndReusableSnippetsThisConnectionOnly')}</p>
          </div>
          <span className={styles.scopeBadge}>
            {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}
          </span>
        </div>
        <nav
          className={styles.tabs}
          role="tablist"
          aria-label={tConnector('sqlEditorSettingsCategories')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'format'}
            aria-controls="sql-preferences-format"
            id="sql-preferences-format-tab"
            onClick={() => setTab('format')}
          >
            <SlidersHorizontal size={15} />
            {tConnector('formatting')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'snippets'}
            aria-controls="sql-preferences-snippets"
            id="sql-preferences-snippets-tab"
            onClick={() => setTab('snippets')}
          >
            <CodeBlock size={15} />
            {tConnector('snippets')}
            <span>{draft.snippets.length}</span>
          </button>
          <label className={styles.saveToggle}>
            <input
              type="checkbox"
              disabled={Boolean(busy)}
              checked={draft.formatOnSave}
              onChange={(event) =>
                setDraft((current) => ({ ...current, formatOnSave: event.target.checked }))
              }
            />
            {tConnector('formatAutomaticallyWhenSavingFiles')}
          </label>
        </nav>
        <div className={styles.body}>
          <div
            id="sql-preferences-format"
            role="tabpanel"
            aria-labelledby="sql-preferences-format-tab"
            hidden={tab !== 'format'}
            key={`format-${loadedRevision}`}
          >
            <SqlEditorFormatterSettings
              value={draft.formatter}
              provider={provider}
              disabled={Boolean(busy)}
              onChange={(formatter) => setDraft((current) => ({ ...current, formatter }))}
              onIssueChange={setFormatterIssue}
            />
          </div>
          <div
            id="sql-preferences-snippets"
            role="tabpanel"
            aria-labelledby="sql-preferences-snippets-tab"
            hidden={tab !== 'snippets'}
          >
            <SqlEditorSnippetSettings
              value={draft.snippets}
              provider={provider}
              disabled={Boolean(busy)}
              onChange={(snippets) => setDraft((current) => ({ ...current, snippets }))}
            />
          </div>
        </div>
        <div className={styles.feedback}>
          {issue && (
            <p className={styles.error} role="alert">
              <WarningCircle size={14} />
              {issue}
            </p>
          )}
          {error && (
            <div className={styles.errorBox} role="alert">
              <WarningCircle size={16} />
              <div>
                <strong>{tConnector('settingsNotSavedYourEditsWereKept')}</strong>
                <p>{error}</p>
              </div>
              <button
                type="button"
                className={styles.textButton}
                disabled={Boolean(busy)}
                onClick={() => void readRemote()}
              >
                <ArrowClockwise size={13} />
                {busy === 'read' ? tConnector('reading') : tConnector('viewDeviceVersion')}
              </button>
            </div>
          )}
          {remote && (
            <div className={styles.conflictBox}>
              <div>
                <strong>{tConnector('settingsReadFromTheDevice')}</strong>
                <p>
                  {tConnector('chooseHowToHandleYourCurrentEdits')}
                  {remote.updatedAt
                    ? tConnector('deviceVersionUpdatedAt', {
                        p0: String(new Date(remote.updatedAt).toLocaleString(locale)),
                      })
                    : tConnector('theDeviceHasNotSavedCustomSettingsYet')}
                </p>
              </div>
              <div className={styles.conflictActions}>
                <button type="button" className={common.secondary} onClick={applyDeviceVersion}>
                  {tConnector('useDeviceVersion')}
                </button>
                <button type="button" className={common.secondary} onClick={retainDraft}>
                  {tConnector('keepCurrentEditsBasedOnTheDeviceVersion')}
                </button>
              </div>
            </div>
          )}
          {notice && (
            <p className={styles.notice} role="status">
              <Check size={14} />
              {notice}
            </p>
          )}
          {discard && (
            <div className={styles.discardBox} role="alert">
              <strong>{tConnector('discardUnsavedChanges')}</strong>
              <button type="button" className={styles.textButton} onClick={() => setDiscard(false)}>
                {tConnector('keepEditing')}
              </button>
              <button
                type="button"
                className={`${styles.textButton} ${styles.danger}`}
                onClick={onClose}
              >
                {tConnector('discardChanges')}
              </button>
            </div>
          )}
        </div>
        <footer className={`${common.dialogFooter} ${styles.footer}`}>
          <small>
            {busy === 'save'
              ? tConnector('savingToTheCurrentConnection')
              : dirty
                ? tConnector('unsavedChanges')
                : tConnector('formatShortcutCtrlShiftF')}
          </small>
          <button
            type="button"
            className={common.secondary}
            disabled={Boolean(busy)}
            onClick={close}
          >
            {tConnector('cancel')}
          </button>
          <button
            type="submit"
            className={common.primary}
            disabled={Boolean(busy) || Boolean(issue) || Boolean(remote)}
          >
            <FloppyDisk size={14} />
            {busy === 'save' ? tConnector('saving') : tConnector('saveSettings')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
