import { uiText, type UiMessage, uiFailure } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './groups.messages';
import { useState } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import {
  databaseDocsGroupColor,
  type DatabaseDocsEdit,
  type DatabaseDocsGroup,
} from '@fouc/shared/database-docs';
import styles from './database-docs.module.css';
const HUES = [28, 60, 95, 148, 180, 215, 250, 285, 325];
export function DocsGroups({
  groups,
  saving,
  onSave,
  onClose,
}: {
  groups: DatabaseDocsGroup[];
  saving: boolean;
  onSave: (edit: DatabaseDocsEdit) => Promise<void>;
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [draft, setDraft] = useState<DatabaseDocsGroup>({
      id: crypto.randomUUID(),
      name: '',
      hue: 215,
      note: null,
    }),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  async function save(remove = false) {
    try {
      setError('');
      await onSave(
        remove ? { kind: 'remove-group', id: draft.id } : { kind: 'upsert-group', group: draft },
      );
      setDraft({ id: crypto.randomUUID(), name: '', hue: 215, note: null });
    } catch (error) {
      setError(error instanceof Error ? uiFailure(error) : String(error));
    }
  }
  return (
    <section className={styles.groupManager} aria-label={tConnector('databaseDocumentColorGroups')}>
      <header>
        <strong>{tConnector('colorGroups')}</strong>
        <button
          className={styles.iconButton}
          disabled={saving}
          aria-label={tConnector('closeGroupManagement')}
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </header>
      <div className={styles.groupPicker}>
        {groups.map((group) => (
          <button
            key={group.id}
            data-active={draft.id === group.id}
            disabled={saving}
            onClick={() => {
              setDraft({ ...group });
              setError('');
            }}
          >
            <i style={{ background: databaseDocsGroupColor(group.hue) }} />
            {group.name}
          </button>
        ))}
        <button
          disabled={saving}
          onClick={() => setDraft({ id: crypto.randomUUID(), name: '', hue: 215, note: null })}
        >
          {tConnector('newGroup')}
        </button>
      </div>
      <label>
        {tConnector('name')}
        <input
          aria-label={tConnector('documentGroupName')}
          value={draft.name}
          maxLength={120}
          disabled={saving}
          onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
        />
      </label>
      <div className={styles.palette}>
        {HUES.map((hue) => (
          <button
            key={hue}
            data-active={draft.hue === hue}
            aria-label={tConnector('groupHue', { p0: String(hue) })}
            disabled={saving}
            style={{ background: databaseDocsGroupColor(hue) }}
            onClick={() => setDraft((value) => ({ ...value, hue }))}
          />
        ))}
        <input
          aria-label={tConnector('customGroupHue')}
          type="range"
          min={0}
          max={359}
          value={draft.hue}
          disabled={saving}
          onChange={(event) => setDraft((value) => ({ ...value, hue: Number(event.target.value) }))}
        />
        <span style={{ color: databaseDocsGroupColor(draft.hue) }}>{draft.hue}°</span>
      </div>
      <label>
        {tConnector('groupMarkdownDescription')}
        <textarea
          aria-label={tConnector('groupMarkdownDescription')}
          rows={3}
          maxLength={65536}
          value={draft.note ?? ''}
          disabled={saving}
          onChange={(event) =>
            setDraft((value) => ({ ...value, note: event.target.value || null }))
          }
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <footer>
        {groups.some((group) => group.id === draft.id) && (
          <button className={styles.danger} disabled={saving} onClick={() => void save(true)}>
            {tConnector('deleteGroupKeepNotes')}
          </button>
        )}
        <button
          className={styles.primary}
          disabled={saving || !draft.name.trim()}
          onClick={() => void save()}
        >
          {saving ? tConnector('saving') : tConnector('saveGroup')}
        </button>
      </footer>
    </section>
  );
}
