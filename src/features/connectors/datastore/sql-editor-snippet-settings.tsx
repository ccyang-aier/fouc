'use client';
import { uiText } from '../i18n/ui-message';

import { useTranslation, type Locale, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-editor-snippet-settings.messages';
import { useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { ArrowDown, ArrowUp, CodeBlock, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react';
import {
  SQL_SNIPPET_MAX_COUNT,
  SQL_SNIPPET_MAX_PREFIX_LENGTH,
  validateSqlSnippets,
  type RelationalProvider,
  type SqlSnippet,
} from '@fouc/shared';
import { sqlSnippetLabel } from './sql-snippet-completion';
import { SqlEditor } from './sql-editor';
import styles from './sql-editor-preferences.module.css';
export function sqlSnippetSettingsIssue(entries: readonly SqlSnippet[], locale?: Locale): string {
  try {
    validateSqlSnippets(entries);
    return '';
  } catch (reason) {
    return reason instanceof Error ? uiText(reason, locale ?? getLocale()) : String(reason);
  }
}
export function SqlEditorSnippetSettings({
  value,
  provider,
  disabled,
  onChange,
}: {
  value: SqlSnippet[];
  provider: RelationalProvider;
  disabled: boolean;
  onChange: (value: SqlSnippet[]) => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [search, setSearch] = useState(''),
    [selectedId, setSelectedId] = useState<string | null>(value[0]?.id ?? null);
  const editor = useRef<EditorView | null>(null);
  const selected = value.find((entry) => entry.id === selectedId) ?? value[0];
  const filtered = value.filter((entry) =>
    `${entry.label}\n${entry.prefix}\n${entry.body}`.toLowerCase().includes(search.toLowerCase()),
  );
  function update(patch: Partial<SqlSnippet>) {
    if (selected)
      onChange(value.map((entry) => (entry.id === selected.id ? { ...entry, ...patch } : entry)));
  }
  function add() {
    if (value.length >= SQL_SNIPPET_MAX_COUNT) return;
    const prefixes = new Set(value.map((entry) => entry.prefix.toLowerCase()));
    let prefix = 'sql',
      index = 1;
    while (prefixes.has(prefix)) prefix = `sql${index++}`;
    const entry: SqlSnippet = {
      id: `custom-${crypto.randomUUID()}`,
      label: tConnector('newSnippet'),
      prefix,
      body: 'SELECT ${value};',
      enabled: true,
    };
    onChange([...value, entry]);
    setSelectedId(entry.id);
    setSearch('');
  }
  function remove() {
    if (!selected) return;
    const index = value.indexOf(selected),
      next = value.filter((entry) => entry.id !== selected.id);
    onChange(next);
    setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
  }
  function move(direction: -1 | 1) {
    if (!selected) return;
    const index = value.indexOf(selected),
      target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  return (
    <div className={styles.snippetsLayout}>
      <aside className={styles.snippetList}>
        <div className={styles.sectionHeading}>
          <CodeBlock size={16} />
          <h3>{tConnector('sqlSnippet')}</h3>
          <small>
            {value.filter((entry) => entry.enabled).length} / {value.length}
            {tConnector('enable')}
          </small>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={tConnector('createSqlSnippet')}
            disabled={disabled || value.length >= SQL_SNIPPET_MAX_COUNT}
            onClick={add}
          >
            <Plus size={15} />
          </button>
        </div>
        <label className={styles.search}>
          <MagnifyingGlass size={15} />
          <input
            aria-label={tConnector('searchSqlSnippets')}
            placeholder={tConnector('searchNamesOrTriggers')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className={styles.snippetRows} role="list" aria-label={tConnector('sqlSnippetList')}>
          {filtered.length ? (
            filtered.map((entry) => (
              <button
                type="button"
                role="listitem"
                key={entry.id}
                className={styles.snippetRow}
                data-selected={selected?.id === entry.id}
                disabled={disabled}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className={styles.snippetTrigger}>{entry.prefix || '—'}</span>
                <span className={styles.snippetName}>
                  <strong>{sqlSnippetLabel(entry, locale) || tConnector('untitledSnippet')}</strong>
                  <small>
                    {entry.id.startsWith('builtin-')
                      ? tConnector('builtInSnippet')
                      : tConnector('customSnippet')}
                  </small>
                </span>
                <span
                  className={styles.enabledDot}
                  data-enabled={entry.enabled}
                  aria-label={entry.enabled ? tConnector('enabled') : tConnector('disabled')}
                />
              </button>
            ))
          ) : (
            <div className={styles.empty}>
              <MagnifyingGlass size={22} />
              <strong>
                {value.length
                  ? tConnector('noMatchingSnippets')
                  : tConnector('addYourFirstSqlSnippet')}
              </strong>
              <p>
                {value.length
                  ? tConnector('tryAnotherNameOrTrigger')
                  : tConnector('saveReusableQueriesInTheCurrentConnection')}
              </p>
            </div>
          )}
        </div>
      </aside>
      <section className={styles.snippetDetail} aria-label={tConnector('sqlSnippetEditor')}>
        {selected ? (
          <>
            <div className={styles.sectionHeading}>
              <h3>{tConnector('editSnippet')}</h3>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={selected.enabled}
                  disabled={disabled}
                  onChange={(event) => update({ enabled: event.target.checked })}
                />
                {tConnector('enable')}
              </label>
              <button
                type="button"
                className={styles.iconButton}
                title={tConnector('moveSnippetUp')}
                aria-label={tConnector('moveSqlSnippetUp')}
                disabled={disabled || value.indexOf(selected) === 0}
                onClick={() => move(-1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                title={tConnector('moveSnippetDown')}
                aria-label={tConnector('moveSqlSnippetDown')}
                disabled={disabled || value.indexOf(selected) === value.length - 1}
                onClick={() => move(1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.danger}`}
                aria-label={tConnector('deleteSqlSnippet')}
                title={tConnector('deleteSnippetTakesEffectAfterSaving')}
                disabled={disabled}
                onClick={remove}
              >
                <Trash size={15} />
              </button>
            </div>
            <fieldset disabled={disabled} className={styles.snippetFields}>
              <label>
                {tConnector('snippetName')}
                <input
                  aria-label={tConnector('sqlSnippetName')}
                  maxLength={200}
                  value={sqlSnippetLabel(selected, locale)}
                  onChange={(event) => update({ label: event.target.value })}
                />
              </label>
              <label>
                {tConnector('trigger')}
                <input
                  aria-label={tConnector('sqlSnippetTrigger')}
                  maxLength={SQL_SNIPPET_MAX_PREFIX_LENGTH}
                  spellCheck={false}
                  value={selected.prefix}
                  onChange={(event) => update({ prefix: event.target.value })}
                />
              </label>
            </fieldset>
            <div className={styles.snippetCodeHeading}>
              <span>{tConnector('sqlContent')}</span>
              <small>{tConnector('enterATriggerThenSelectASnippetToInsert')}</small>
            </div>
            <div className={styles.snippetCode}>
              <SqlEditor
                key={selected.id}
                documentId={selected.id}
                value={selected.body}
                onChange={(body) => update({ body })}
                onRun={() => {}}
                editorRef={editor}
                provider={provider}
                readOnly={disabled}
                label={tConnector('sqlSnippetContent')}
                snippets={[]}
              />
            </div>
            <p className={styles.previewNote}>
              {tConnector('use')}
              <code>{tConnector('message')}</code>
              {tConnector('toDefineReplaceableContentAfterInsertingPressTabShiftTab')}
            </p>
          </>
        ) : (
          <div className={styles.empty}>
            <CodeBlock size={28} />
            <strong>{tConnector('insertReusableSqlInAMoment')}</strong>
            <p>{tConnector('afterCreatingASnippetSetItsTriggerAndReplaceableFields')}</p>
            <button type="button" disabled={disabled} className={styles.textButton} onClick={add}>
              <Plus size={14} />
              {tConnector('createSnippet')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
