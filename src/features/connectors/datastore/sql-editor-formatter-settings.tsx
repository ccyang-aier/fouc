'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './sql-editor-formatter-settings.messages';
import { useEffect, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  Code,
  SlidersHorizontal,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  DEFAULT_SQL_FORMATTER_SETTINGS,
  parseSqlFormatterConfig,
  serializeSqlFormatterConfig,
  type RelationalProvider,
  type SqlFormatterSettings,
} from '@fouc/shared';
import { formatSqlText } from './sql-format/formatter';
import { SqlEditor } from './sql-editor';
import styles from './sql-editor-preferences.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
const caseChoices = (locale?: Locale) => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    ['preserve', tConnector('keepOriginal')],
    ['upper', tConnector('uppercase')],
    ['lower', tConnector('lowercase')],
  ] as const;
};
const INITIAL_PREVIEW =
  "select u.id, u.name, count(o.id) as order_count from users u left join orders o on o.user_id=u.id where u.active=true and o.created_at >= '2026-01-01' group by u.id,u.name order by order_count desc limit 100;";
type Props = {
  value: SqlFormatterSettings;
  provider: RelationalProvider;
  disabled: boolean;
  onChange: (value: SqlFormatterSettings) => void;
  onIssueChange: (value: string) => void;
};
export function SqlEditorFormatterSettings({
  value,
  provider,
  disabled,
  onChange,
  onIssueChange,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [source, setSource] = useState(INITIAL_PREVIEW),
    [preview, setPreview] = useState(''),
    [previewErrorStored, setPreviewError] = useState<UiMessage>(''),
    [pending, setPending] = useState(true);
  const previewError = uiText(previewErrorStored, locale);
  const [showSource, setShowSource] = useState(false),
    [configStatus, setConfigStatus] = useState(''),
    [configErrorStored, setConfigError] = useState<UiMessage>('');
  const configError = uiText(configErrorStored, locale);
  const [paramsText, setParamsText] = useState(() => JSON.stringify(value.paramTypes, null, 2));
  const upload = useRef<HTMLInputElement>(null),
    previewEditor = useRef<EditorView | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setPending(true);
      void formatSqlText(source, provider, value)
        .then(
          (result) => {
            if (active) {
              setPreview(result);
              setPreviewError('');
            }
          },
          (reason: unknown) => {
            if (active)
              setPreviewError(reason instanceof Error ? uiFailure(reason) : String(reason));
          },
        )
        .finally(() => {
          if (active) setPending(false);
        });
    }, 160);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source, provider, value]);
  function update<K extends keyof SqlFormatterSettings>(key: K, next: SqlFormatterSettings[K]) {
    onChange({ ...value, [key]: next });
    setConfigStatus('');
  }
  function restore() {
    onChange({ ...DEFAULT_SQL_FORMATTER_SETTINGS });
    setParamsText('null');
    setConfigError('');
    setConfigStatus(tConnector('defaultsRestoredChangesTakeEffectAfterSaving'));
    onIssueChange('');
  }
  async function importConfig(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024)
        throw connectorUiMessages.error('configurationFilesMustNotExceedKb');
      const result = parseSqlFormatterConfig(await file.text());
      if (!result.ok) throw new Error(result.message);
      onChange(result.settings);
      setParamsText(JSON.stringify(result.settings.paramTypes, null, 2));
      setConfigError('');
      setConfigStatus(tConnector('configurationImportedChangesTakeEffectAfterSaving'));
      onIssueChange('');
    } catch (reason) {
      setConfigError(reason instanceof Error ? uiFailure(reason) : String(reason));
      setConfigStatus('');
    } finally {
      if (upload.current) upload.current.value = '';
    }
  }
  function exportConfig() {
    const url = URL.createObjectURL(
      new Blob([serializeSqlFormatterConfig(value)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sql-formatter.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setConfigStatus(tConnector('currentFormattingConfigurationExported'));
  }
  function updateParams(text: string) {
    setParamsText(text);
    const result = parseSqlFormatterConfig(
      JSON.stringify({
        version: 1,
        formatter: 'sql-formatter',
        options: {
          ...value,
          paramTypes: (() => {
            try {
              return JSON.parse(text) as unknown;
            } catch {
              return text;
            }
          })(),
        },
      }),
    );
    if (result.ok) {
      update('paramTypes', result.settings.paramTypes);
      setConfigError('');
      onIssueChange('');
    } else {
      const message = tConnector(
        'invalidParameterSyntaxConfigurationCheckTheJsonAndRegularExpressions',
      );
      setConfigError(
        connectorUiMessages.message(
          'invalidParameterSyntaxConfigurationCheckTheJsonAndRegularExpressions',
        ),
      );
      onIssueChange(message);
    }
  }
  return (
    <div className={styles.formatLayout}>
      <div className={styles.options}>
        <div className={styles.sectionHeading}>
          <SlidersHorizontal size={16} />
          <h3>{tConnector('formattingRules')}</h3>
          <button type="button" className={styles.textButton} disabled={disabled} onClick={restore}>
            <ArrowCounterClockwise size={13} />
            {tConnector('restoreDefaults')}
          </button>
        </div>
        <fieldset className={styles.fieldset} disabled={disabled}>
          <legend>{tConnector('letterCase')}</legend>
          <div className={styles.fieldGrid}>
            {(
              [
                { key: 'keywordCase', label: tConnector('sqlKeywords') },
                { key: 'dataTypeCase', label: tConnector('dataType') },
                { key: 'functionCase', label: tConnector('functionNames') },
                { key: 'identifierCase', label: tConnector('identifiers') },
              ] as const
            ).map(({ key, label }) => (
              <label key={key}>
                {label}
                <select
                  value={value[key]}
                  aria-label={label + tConnector('letterCase')}
                  onChange={(event) =>
                    update(key, event.target.value as SqlFormatterSettings[typeof key])
                  }
                >
                  {caseChoices(locale).map(([option, title]) => (
                    <option key={option} value={option}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {value.identifierCase !== 'preserve' && (
            <p className={styles.warning}>
              <WarningCircle size={13} />
              {tConnector('identifierCaseMayAffectQuotedNamesCheckThePreview')}
            </p>
          )}
        </fieldset>
        <fieldset className={styles.fieldset} disabled={disabled}>
          <legend>{tConnector('indentationAndLineBreaks')}</legend>
          <div className={styles.fieldGrid}>
            <label>
              {tConnector('formattingStyle')}
              <select
                aria-label={tConnector('sqlFormattingStyle')}
                value={value.indentStyle}
                onChange={(event) =>
                  update('indentStyle', event.target.value as SqlFormatterSettings['indentStyle'])
                }
              >
                <option value="standard">{tConnector('dbxStandardFormatting')}</option>
                <option value="tabularLeft">{tConnector('tabularLeftAligned')}</option>
                <option value="tabularRight">{tConnector('tabularRightAligned')}</option>
              </select>
            </label>
            <label>
              {tConnector('indentWidth')}
              <select
                aria-label={tConnector('sqlIndentWidth')}
                value={value.tabWidth}
                onChange={(event) => update('tabWidth', Number(event.target.value) as 2 | 4)}
              >
                <option value="2">{tConnector('spaces')}</option>
                <option value="4">{tConnector('spaces2697')}</option>
              </select>
            </label>
            <label>
              {tConnector('expressionLineWidth')}
              <select
                aria-label={tConnector('sqlExpressionLineWidth')}
                value={value.expressionWidth}
                onChange={(event) =>
                  update('expressionWidth', Number(event.target.value) as 50 | 80 | 120)
                }
              >
                {[50, 80, 120].map((width) => (
                  <option key={width} value={width}>
                    {width}
                    {tConnector('columns')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tConnector('blankLinesBetweenStatements')}
              <select
                aria-label={tConnector('sqlBlankLinesBetweenStatements')}
                value={value.linesBetweenQueries}
                onChange={(event) =>
                  update('linesBetweenQueries', Number(event.target.value) as 0 | 1 | 2)
                }
              >
                {[0, 1, 2].map((lines) => (
                  <option key={lines} value={lines}>
                    {lines}
                    {tConnector('row')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tConnector('logicalOperators')}
              <select
                aria-label={tConnector('logicalOperatorLineBreaks')}
                value={value.logicalOperatorNewline}
                onChange={(event) =>
                  update(
                    'logicalOperatorNewline',
                    event.target.value as SqlFormatterSettings['logicalOperatorNewline'],
                  )
                }
              >
                <option value="before">{tConnector('lineBreakBeforeAndOr')}</option>
                <option value="after">{tConnector('lineBreakAfterAndOr')}</option>
                <option value="none">{tConnector('keepOnTheSameLine')}</option>
              </select>
            </label>
            <label>
              {tConnector('fromLayout')}
              <select
                aria-label={tConnector('fromClauseLayout')}
                value={value.fromClauseLayout}
                onChange={(event) =>
                  update(
                    'fromClauseLayout',
                    event.target.value as SqlFormatterSettings['fromClauseLayout'],
                  )
                }
              >
                <option value="sameLine">{tConnector('sameLineAsTheFirstTable')}</option>
                <option value="newLine">{tConnector('tableNamesOnANewLine')}</option>
              </select>
            </label>
          </div>
          <div className={styles.toggles}>
            {(
              [
                { key: 'useTabs', label: tConnector('indentWithTabs') },
                { key: 'preserveEmptyLines', label: tConnector('preserveOriginalBlankLines') },
                { key: 'denseOperators', label: tConnector('compactOperators') },
                { key: 'newlineBeforeSemicolon', label: tConnector('semicolonOnANewLine') },
              ] as const
            ).map(({ key, label }) => (
              <label key={key} className={styles.check}>
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={(event) => update(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <details className={styles.advanced}>
          <summary>{tConnector('parameterSyntaxAndConfigurationFiles')}</summary>
          <p>{tConnector('recognizesNameNameAndTemplateParametersByDefaultEnterCustom')}</p>
          <label>
            {tConnector('parameterSyntaxConfiguration')}
            <textarea
              className={styles.configEditor}
              aria-label={tConnector('sqlFormattingParameterSyntaxConfiguration')}
              value={paramsText}
              spellCheck={false}
              disabled={disabled}
              onChange={(event) => updateParams(event.target.value)}
            />
          </label>
          <div className={styles.configActions}>
            <input
              ref={upload}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importConfig(event.target.files?.[0])}
            />
            <button
              type="button"
              className={styles.textButton}
              disabled={disabled}
              onClick={() => upload.current?.click()}
            >
              <ArrowUp size={13} />
              {tConnector('importConfiguration')}
            </button>
            <button type="button" className={styles.textButton} onClick={exportConfig}>
              <ArrowDown size={13} />
              {tConnector('exportConfiguration')}
            </button>
          </div>
          {configError && (
            <p className={styles.error} role="alert">
              {configError}
            </p>
          )}
          {configStatus && (
            <p className={styles.help} role="status">
              {configStatus}
            </p>
          )}
        </details>
      </div>
      <section
        className={styles.previewSection}
        aria-label={tConnector('liveSqlFormattingPreview')}
      >
        <div className={styles.previewHeading}>
          <Code size={16} />
          <strong>{tConnector('livePreview')}</strong>
          <span className={styles.badge}>
            {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}
          </span>
        </div>
        <div
          className={styles.previewTabs}
          role="tablist"
          aria-label={tConnector('formattingPreviewContent')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={!showSource}
            onClick={() => setShowSource(false)}
          >
            {tConnector('formattedResult')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showSource}
            onClick={() => setShowSource(true)}
          >
            {tConnector('editExampleSql')}
          </button>
          <small role="status">
            {pending
              ? tConnector('updating')
              : previewError
                ? tConnector('invalidFormat')
                : tConnector('rows', { p0: String(preview.split('\n').length) })}
          </small>
        </div>
        <div className={styles.previewCode} aria-busy={pending}>
          {showSource ? (
            <SqlEditor
              key="source"
              value={source}
              onChange={setSource}
              onRun={() => {}}
              provider={provider}
              editorRef={previewEditor}
              label={tConnector('formatExampleSql')}
              snippets={[]}
            />
          ) : previewError ? (
            <p className={styles.previewError} role="alert">
              <WarningCircle size={16} />
              {previewError}
            </p>
          ) : (
            <SqlEditor
              key="result"
              value={preview}
              onChange={() => {}}
              onRun={() => {}}
              provider={provider}
              editorRef={previewEditor}
              readOnly
              label={tConnector('sqlFormattingResultPreview')}
            />
          )}
        </div>
        <p className={styles.previewNote}>
          {tConnector('rulesApplyDirectlyToThisConnectionSSqlEditorThe')}
        </p>
      </section>
    </div>
  );
}
