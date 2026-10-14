'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connection-source-assistant.messages';
import { useId, useState } from 'react';
import { ArrowDown, Check, Copy, Link, WarningCircle } from '@phosphor-icons/react';
import type { NativeNetworkProvider } from '@fouc/shared/connection-options';
import {
  buildConnectionSource,
  parseConnectionSource,
  type ConnectionUrlFields,
  type ParsedConnectionSource,
} from '@fouc/shared/connection-options-url';
import styles from './connection-options.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export type ConnectionSourceAssistantProps = {
  provider: NativeNetworkProvider;
  fields: ConnectionUrlFields;
  onApply: (parsed: ParsedConnectionSource) => void;
  disabled?: boolean;
  onNotice?: (message: string) => void;
};
export function ConnectionSourceAssistant({
  provider,
  fields,
  onApply,
  disabled = false,
  onNotice,
}: ConnectionSourceAssistantProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId();
  const [source, setSource] = useState(''),
    [visible, setVisible] = useState(false);
  const [parsed, setParsed] = useState<{
    source: string;
    result: ParsedConnectionSource;
  } | null>(null);
  const [errorStored, setError] = useState<UiMessage>(''),
    [feedbackStored, setFeedback] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const feedback = uiText(feedbackStored, locale);
  const [format, setFormat] = useState<'url' | 'dsn'>('url');
  const [includePassword, setIncludePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview =
    parsed?.source === source && parsed.result.fields.provider === provider ? parsed.result : null;
  let built: ReturnType<typeof buildConnectionSource> | null = null,
    buildError = '';
  try {
    built = buildConnectionSource(
      fields,
      provider === 'postgres' ? format : 'url',
      includePassword,
    );
  } catch (reason) {
    buildError =
      reason instanceof Error
        ? uiText(reason, locale)
        : tConnector('couldNotGenerateTheConnectionUrl');
  }
  function inspect() {
    setError('');
    setFeedback('');
    try {
      setParsed({ source, result: parseConnectionSource(source, provider) });
    } catch (reason) {
      setParsed(null);
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('couldNotParseTheConnectionUrlDsn'),
      );
    }
  }
  async function copy() {
    if (!built || busy) return;
    const text = built.text;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      if (!navigator.clipboard?.writeText)
        throw connectorUiMessages.error(
          'clipboardPermissionIsUnavailableSelectTheGeneratedTextToCopy',
        );
      await navigator.clipboard.writeText(text);
      const message =
        includePassword && fields.password
          ? tConnector('copiedConnectionTextIncludingThePassword')
          : tConnector('copiedConnectionTextWithoutThePassword');
      setFeedback(
        includePassword && fields.password
          ? connectorUiMessages.message('copiedConnectionTextIncludingThePassword')
          : connectorUiMessages.message('copiedConnectionTextWithoutThePassword'),
      );
      onNotice?.(message);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? uiFailure(reason)
          : connectorUiMessages.message('couldNotWriteToTheClipboard'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className={styles.assistant}>
      <summary>
        <Link size={15} />
        <strong>{tConnector('connectionUrlDsn')}</strong>
        <span>{tConnector('parseAndCopy')}</span>
      </summary>
      <div className={styles.assistantBody}>
        <label className={styles.field} htmlFor={`${id}-source`}>
          <span>{tConnector('pasteConnectionText')}</span>
          <div className={styles.secretInput}>
            <input
              id={`${id}-source`}
              type={visible ? 'text' : 'password'}
              value={source}
              disabled={disabled}
              maxLength={8192}
              autoComplete="off"
              spellCheck={false}
              placeholder={
                provider === 'postgres' ? tConnector('postgresqlOrHostDbname') : `${provider}://…`
              }
              onChange={(event) => {
                setSource(event.target.value);
                setError('');
                setFeedback('');
              }}
            />
            <button
              type="button"
              disabled={disabled}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? tConnector('hide') : tConnector('showing')}
            </button>
          </div>
        </label>
        <div className={styles.sourceActions}>
          <small>{tConnector('theTextMayContainAPasswordAndIsRetainedOnly')}</small>
          <button type="button" disabled={disabled || !source.trim()} onClick={inspect}>
            {tConnector('parseConnectionText')}
          </button>
        </div>
        {preview && (
          <div className={styles.parsed}>
            <dl>
              <div>
                <dt>{tConnector('host')}</dt>
                <dd>
                  {preview.fields.mongo?.hosts
                    .map(
                      (host) => `${host.host}${preview.fields.mongo?.srv ? '' : `:${host.port}`}`,
                    )
                    .join(', ') || `${preview.fields.host}:${preview.fields.port}`}
                </dd>
              </div>
              <div>
                <dt>{tConnector('database')}</dt>
                <dd>{preview.fields.database || tConnector('notSpecified')}</dd>
              </div>
              <div>
                <dt>{tConnector('username')}</dt>
                <dd>{preview.fields.username || tConnector('notSpecified')}</dd>
              </div>
              <div>
                <dt>TLS</dt>
                <dd>
                  {preview.fields.connectionOptions.tls?.enabled
                    ? tConnector('enabledFullCertificateVerification')
                    : tConnector('close')}
                </dd>
              </div>
            </dl>
            {preview.containsPassword && (
              <p className={styles.hint}>
                {tConnector('passwordParsedAfterApplyingItIsUsedOnlyForThis')}
              </p>
            )}
            {preview.warnings.map((warning) => (
              <p className={styles.warning} key={warning.code}>
                <WarningCircle size={13} />
                {uiText(warning, locale)}
              </p>
            ))}
            <button
              type="button"
              className={styles.applyButton}
              disabled={disabled}
              onClick={() => {
                try {
                  onApply(preview);
                  setFeedback(connectorUiMessages.message('appliedToTheConnectionForm'));
                  setSource('');
                  setParsed(null);
                  setError('');
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? uiFailure(reason)
                      : connectorUiMessages.message('couldNotApplyConnectionText'),
                  );
                }
              }}
            >
              <ArrowDown size={14} />
              {tConnector('applyToForm')}
            </button>
          </div>
        )}
        <div className={styles.generated}>
          <div className={styles.sourceActions}>
            <strong>{tConnector('generateFromTheCurrentForm')}</strong>
            {provider === 'postgres' && (
              <select
                aria-label={tConnector('connectionTextFormat')}
                disabled={disabled}
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as 'url' | 'dsn');
                  setFeedback('');
                }}
              >
                <option value="url">{tConnector('connectionUrl')}</option>
                <option value="dsn">libpq DSN</option>
              </select>
            )}
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              disabled={disabled || !fields.password}
              checked={includePassword}
              onChange={(event) => {
                setIncludePassword(event.target.checked);
                setFeedback('');
              }}
            />
            {tConnector('includePasswordInCopiedText')}
          </label>
          {includePassword && fields.password && (
            <p className={styles.warning}>
              <WarningCircle size={13} />
              {tConnector('theCopiedTextContainsAPasswordCheckWhereYouPaste')}
            </p>
          )}
          {built && (
            <textarea
              readOnly
              aria-label={tConnector('generatedConnectionText')}
              value={built.text}
              rows={3}
              spellCheck={false}
            />
          )}
          {buildError && <p className={styles.hint}>{buildError}</p>}
          {built?.warnings.map((warning) => (
            <p className={styles.hint} key={warning.code}>
              {uiText(warning, locale)}
            </p>
          ))}
          <button type="button" disabled={disabled || busy || !built} onClick={() => void copy()}>
            <Copy size={14} />
            {busy
              ? tConnector('copying')
              : tConnector('copy', {
                  p0: String(provider === 'postgres' && format === 'dsn' ? ' DSN' : ' URL'),
                })}
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            <WarningCircle size={14} />
            {error}
          </p>
        )}
        {feedback && (
          <p className={styles.success} role="status">
            <Check size={14} />
            {feedback}
          </p>
        )}
      </div>
    </details>
  );
}
