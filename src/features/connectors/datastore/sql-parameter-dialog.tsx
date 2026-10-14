'use client';
import { uiText, type UiMessage, createUiMessages } from '../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-parameter-dialog.messages';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { BracketsCurly, Check, Copy, Play, WarningCircle } from '@phosphor-icons/react';
import {
  compileSqlTemplate,
  sqlParameterInputIssue,
  type RelationalProvider,
  type SqlParameterDescriptor,
  type SqlParameterInput,
} from '@fouc/shared';
import { SqlDialog } from './sql-library-dialog';
import { SqlEditor } from './sql-editor';
import common from './relational.module.css';
import styles from './sql-parameter.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export type SqlParameterRecents = Map<string, SqlParameterInput[]>;
const kinds = (
  locale?: Locale,
): {
  kind: SqlParameterInput['kind'];
  label: string;
}[] => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { kind: 'string', label: tConnector('string') },
    { kind: 'number', label: tConnector('number') },
    { kind: 'boolean', label: tConnector('boolean') },
    { kind: 'null', label: 'NULL' },
    { kind: 'raw', label: tConnector('rawSql') },
  ];
};
export function rememberSqlParameters(
  history: SqlParameterRecents,
  values: Record<string, SqlParameterInput>,
): void {
  for (const [key, input] of Object.entries(values)) {
    if (input.kind !== 'null' && !input.value) continue;
    history.set(
      key,
      [
        { ...input },
        ...(history.get(key) ?? []).filter(
          (item) => item.kind !== input.kind || item.value !== input.value,
        ),
      ].slice(0, 8),
    );
  }
}
export function SqlParameterDialog({
  sql,
  declarationSql,
  provider,
  descriptors,
  history,
  targetLabel,
  onClose,
  onExecute,
  action = 'execute',
}: {
  sql: string;
  declarationSql: string;
  provider: RelationalProvider;
  descriptors: SqlParameterDescriptor[];
  history: SqlParameterRecents;
  targetLabel: string;
  onClose: () => void;
  onExecute: (values: Record<string, SqlParameterInput>) => void;
  action?: 'execute' | 'explain';
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [values, setValues] = useState<Record<string, SqlParameterInput>>(() =>
    Object.fromEntries(
      descriptors.map((item) => [
        item.key,
        { ...(history.get(item.key)?.[0] ?? { kind: 'string', value: '' }) },
      ]),
    ),
  );
  const [copied, setCopied] = useState(false),
    [copyErrorStored, setCopyError] = useState<UiMessage>('');
  const copyError = uiText(copyErrorStored, locale);
  const previewEditor = useRef<EditorView | null>(null);
  const form = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);
  const preview = useMemo(() => {
    try {
      return {
        sql: compileSqlTemplate(sql, provider, { parameters: values, declarationSql }).sql,
        error: '',
      };
    } catch (reason) {
      return { sql: '', error: reason instanceof Error ? uiText(reason, locale) : String(reason) };
    }
  }, [sql, provider, declarationSql, values, locale]);
  function update(key: string, input: SqlParameterInput) {
    setValues((previous) => ({ ...previous, [key]: input }));
    setCopied(false);
    setCopyError('');
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(preview.sql);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError(connectorUiMessages.message('copyFailedSelectTheSqlInThePreviewAndCopy'));
    }
  }
  const hasRaw = Object.values(values).some((input) => input.kind === 'raw');
  return (
    <SqlDialog title={tConnector('sqlParameters')} className={styles.dialog} onClose={onClose}>
      <form
        ref={form}
        className={styles.form}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (!preview.error) onExecute(values);
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!preview.error) onExecute(values);
        }}
      >
        <div className={styles.body}>
          <div className={styles.intro}>
            <span className={styles.icon}>
              <BracketsCurly size={21} />
            </span>
            <div>
              <strong>{tConnector('completeParametersAndPreviewTheStatement')}</strong>
              <p>
                {targetLabel} ·{' '}
                {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}{' '}
                · {descriptors.length}
                {tConnector('parameters')}
              </p>
            </div>
          </div>
          <div className={styles.sectionHead}>
            <span>{tConnector('parameterValues')}</span>
            <small>{tConnector('forThisExecutionOnly')}</small>
            <button
              type="button"
              onClick={() => {
                setValues(
                  Object.fromEntries(
                    descriptors.map((item) => [item.key, { kind: 'string', value: '' }]),
                  ),
                );
                setCopied(false);
              }}
            >
              {tConnector('clear')}
            </button>
            <button
              type="button"
              onClick={() =>
                setValues((previous) =>
                  Object.fromEntries(
                    Object.entries(previous).map(([key, input]) => [
                      key,
                      { ...input, kind: 'raw' },
                    ]),
                  ),
                )
              }
            >
              {tConnector('setAllToRawSql')}
            </button>
          </div>
          <div className={styles.table} role="group" aria-label={tConnector('sqlParameterList')}>
            <div className={styles.tableHead}>
              <span>{tConnector('nameSyntax')}</span>
              <span>{tConnector('type')}</span>
              <span>{tConnector('value')}</span>
            </div>
            {descriptors.map((item, index) => {
              const input = values[item.key],
                recent = history.get(item.key) ?? [],
                issue = sqlParameterInputIssue(item, input),
                id = `sql-parameter-${index}`;
              return (
                <div key={item.key} className={styles.row}>
                  <label htmlFor={id} className={styles.name}>
                    <strong title={item.name}>{item.name}</strong>
                    <code>
                      {item.token}
                      {item.collection ? tConnector('list') : ''}
                    </code>
                  </label>
                  <select
                    aria-label={tConnector('type3046', { p0: String(item.name) })}
                    value={input.kind}
                    onChange={(event) =>
                      update(item.key, {
                        ...input,
                        kind: event.target.value as SqlParameterInput['kind'],
                      })
                    }
                  >
                    {kinds(locale).map((kind) => (
                      <option key={kind.kind} value={kind.kind}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                  <div className={styles.value}>
                    <div className={styles.inputLine}>
                      <input
                        id={id}
                        aria-label={tConnector('parameterValue', { p0: String(item.name) })}
                        aria-invalid={Boolean(issue)}
                        aria-describedby={issue ? `${id}-error` : undefined}
                        autoFocus={index === 0}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={input.kind === 'null'}
                        value={input.kind === 'null' ? 'NULL' : input.value}
                        placeholder={
                          item.collection
                            ? tConnector('alphaBetaOrCommaSeparatedValues')
                            : input.kind === 'raw'
                              ? tConnector('sqlExpressionOrFragment')
                              : tConnector('enterAParameterValue')
                        }
                        onChange={(event) =>
                          update(item.key, { ...input, value: event.target.value })
                        }
                      />
                      {recent.length > 0 && (
                        <select
                          className={styles.recent}
                          aria-label={tConnector('recentValues', { p0: String(item.name) })}
                          title={tConnector('recentParameterValuesInThisQueryTab')}
                          value=""
                          onChange={(event) => {
                            const entry = recent[Number(event.target.value)];
                            if (entry) update(item.key, { ...entry });
                          }}
                        >
                          <option value="" disabled>
                            {tConnector('recent')}
                          </option>
                          {recent.map((entry, position) => (
                            <option key={position} value={position}>
                              {kinds(locale).find((kind) => kind.kind === entry.kind)?.label} ·{' '}
                              {entry.kind === 'null' ? 'NULL' : entry.value}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {issue && (
                      <small id={`${id}-error`} role="alert" className={styles.error}>
                        {issue}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.sectionHead}>
            <span>{tConnector('sqlPreview')}</span>
            <small>{tConnector('expandedExecutionStatement')}</small>
            <button type="button" disabled={Boolean(preview.error)} onClick={() => void copy()}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? tConnector('copied') : tConnector('copySql')}
            </button>
          </div>
          <div className={styles.preview}>
            {preview.error ? (
              <p role="alert" className={styles.error}>
                <WarningCircle size={15} />
                {preview.error}
              </p>
            ) : (
              <SqlEditor
                value={preview.sql}
                onChange={() => {}}
                onRun={() => {
                  if (!preview.error) onExecute(values);
                }}
                editorRef={previewEditor}
                provider={provider}
                readOnly
                label={tConnector('sqlParameterPreview')}
              />
            )}
          </div>
          <p className={styles.note}>
            {hasRaw ? (
              <>
                <WarningCircle size={14} />
                {tConnector('rawSqlExpandsDirectlyIntoExpressions')}
                {action === 'explain'
                  ? tConnector('theQuerySReadOnlyScopeIsStillValidatedBefore')
                  : tConnector('theReadOnlyScopeOfTheEntireStatementBatchIs')}
              </>
            ) : (
              tConnector('stringsAreEscapedAutomaticallyNumbersRetainPrecisionListsSupportJson')
            )}
          </p>
          {copyError && (
            <p role="alert" className={styles.error}>
              {copyError}
            </p>
          )}
        </div>
        <footer className={`${common.dialogFooter} ${styles.footer}`}>
          <small>
            Ctrl / ⌘ + Enter{' '}
            {action === 'explain' ? tConnector('generatePlan') : tConnector('execute')}
          </small>
          <button type="button" className={common.secondary} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <button type="submit" className={common.primary} disabled={Boolean(preview.error)}>
            <Play size={14} weight="fill" />
            {action === 'explain'
              ? tConnector('applyParametersAndGeneratePlan')
              : tConnector('applyParametersAndExecute')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
