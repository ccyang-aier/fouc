'use client';
import { uiText, uiFailure, createUiMessages, type UiMessage } from '../../i18n/ui-message';

import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './connection-options-fields.messages';
import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { FileArrowUp, ShieldCheck, Timer, Trash, WarningCircle } from '@phosphor-icons/react';
import {
  defaultConnectionOptions,
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
  type NativeNetworkProvider,
} from '@fouc/shared/connection-options';
import { ConnectionDurationField } from './duration-field';
import { readConnectionPem, type ConnectionPemKind } from './pem-file';
import styles from './connection-options.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export type ConnectionOptionsFieldsProps = {
  provider: NativeNetworkProvider;
  value: DatabaseConnectionOptionsInput;
  onChange: (value: DatabaseConnectionOptionsInput) => void;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
};
type FileStatus = {
  name: string;
  pending: boolean;
  error: UiMessage;
};
const fileLabels = (locale?: Locale): Record<ConnectionPemKind, string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    caPem: tConnector('caCertificate'),
    certificatePem: tConnector('clientCertificate'),
    privateKeyPem: tConnector('clientPrivateKey'),
  };
};
const emptyFiles: Record<ConnectionPemKind, FileStatus> = {
  caPem: { name: '', pending: false, error: '' },
  certificatePem: { name: '', pending: false, error: '' },
  privateKeyPem: { name: '', pending: false, error: '' },
};
export function ConnectionOptionsFields({
  provider,
  value,
  onChange,
  disabled = false,
  onValidityChange,
}: ConnectionOptionsFieldsProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const id = useId(),
    defaults = defaultConnectionOptions(provider),
    tls = { ...defaults.tls, ...value.tls };
  const latest = useRef({ provider, value, onChange, disabled });
  useLayoutEffect(() => {
    latest.current = { provider, value, onChange, disabled };
  }, [provider, value, onChange, disabled]);
  const epochs = useRef({ caPem: 0, certificatePem: 0, privateKeyPem: 0 });
  const [files, setFiles] = useState(emptyFiles);
  const [invalidDurations, setInvalidDurations] = useState<Record<string, boolean>>({});
  const [showPassphrase, setShowPassphrase] = useState(false);
  let validation = '';
  try {
    resolveConnectionOptions(provider, value, false, false);
  } catch (error) {
    validation =
      error instanceof Error ? uiText(error, locale) : tConnector('invalidConnectionParameters');
  }
  const valid =
    !validation &&
    !Object.values(invalidDurations).some(Boolean) &&
    !Object.values(files).some((file) => file.pending || file.error);
  const notifyValidity = useEffectEvent((next: boolean) => onValidityChange?.(next));
  useEffect(() => {
    notifyValidity(valid);
  }, [valid]);
  useEffect(() => {
    const counters = epochs.current;
    return () => {
      for (const kind of Object.keys(counters) as ConnectionPemKind[]) counters[kind]++;
    };
  }, []);
  function updateTls(patch: NonNullable<DatabaseConnectionOptionsInput['tls']>) {
    onChange({ ...value, tls: { ...tls, ...patch } });
  }
  async function upload(kind: ConnectionPemKind, file: File) {
    const epoch = ++epochs.current[kind],
      sourceProvider = provider;
    setFiles((current) => ({
      ...current,
      [kind]: { name: file.name, pending: true, error: '' },
    }));
    try {
      const pem = await readConnectionPem(file, kind, locale);
      const current = latest.current;
      if (epoch !== epochs.current[kind]) return;
      if (current.provider !== sourceProvider || current.disabled || !current.value.tls?.enabled) {
        setFiles((previous) => ({ ...previous, [kind]: emptyFiles[kind] }));
        return;
      }
      current.onChange({
        ...current.value,
        tls: { ...current.value.tls, [kind]: pem },
      });
      setFiles((previous) => ({
        ...previous,
        [kind]: { name: file.name, pending: false, error: '' },
      }));
    } catch (error) {
      if (epoch !== epochs.current[kind]) return;
      setFiles((previous) => ({
        ...previous,
        [kind]: {
          name: file.name,
          pending: false,
          error:
            error instanceof Error
              ? uiFailure(error)
              : connectorUiMessages.message('couldNotReadTheFile'),
        },
      }));
    }
  }
  function clearFile(kind: ConnectionPemKind) {
    epochs.current[kind]++;
    updateTls({
      [kind]: undefined,
      ...(kind === 'privateKeyPem' ? { privateKeyPassphrase: undefined } : {}),
    });
    setFiles((current) => ({ ...current, [kind]: emptyFiles[kind] }));
  }
  return (
    <section className={styles.options} aria-label={tConnector('advancedConnectionParameters')}>
      <div className={styles.sectionTitle}>
        <Timer size={16} />
        <strong>{tConnector('timeoutsAndConnectionPooling')}</strong>
        <span>{tConnector('boundedWaits')}</span>
      </div>
      <div className={styles.durationGrid}>
        {(
          [
            ['connectTimeoutMs', tConnector('connect'), 300000],
            [
              'queryTimeoutMs',
              provider === 'redis' ? tConnector('commandDeadline') : tConnector('queryDeadline'),
              3600000,
            ],
            ...(provider === 'redis'
              ? []
              : [['idleTimeoutMs', tConnector('idleConnectionExpiry'), 3600000]]),
          ] as [
            keyof Pick<
              DatabaseConnectionOptionsInput,
              'connectTimeoutMs' | 'queryTimeoutMs' | 'idleTimeoutMs'
            >,
            string,
            number,
          ][]
        ).map(([key, label, maximum]) => (
          <ConnectionDurationField
            key={`${provider}:${key}`}
            label={label}
            milliseconds={(value[key] ?? defaults[key])!}
            maximum={maximum}
            disabled={disabled}
            onChange={(milliseconds) => onChange({ ...value, [key]: milliseconds })}
            onValidityChange={(isValid) =>
              setInvalidDurations((current) => ({
                ...current,
                [key]: !isValid,
              }))
            }
          />
        ))}
      </div>
      {provider === 'mongodb' && (
        <p className={styles.hint}>
          {tConnector('theQueryDeadlineAppliesToBothServerMaxtimemsAndSocket')}
        </p>
      )}

      <div className={styles.tlsSection}>
        <div className={styles.sectionTitle}>
          <ShieldCheck size={16} />
          <strong>{tConnector('transportSecurity')}</strong>
          <span>TLS</span>
        </div>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={tls.enabled}
            disabled={disabled}
            onChange={(event) => {
              const enabled = event.target.checked;
              if (!enabled) {
                for (const kind of Object.keys(epochs.current) as ConnectionPemKind[])
                  epochs.current[kind]++;
                setFiles(emptyFiles);
                onChange({
                  ...value,
                  tls: {
                    ...defaults.tls,
                    enabled: false,
                    minVersion: tls.minVersion,
                  },
                });
              } else updateTls({ enabled: true });
            }}
          />
          <span>{tConnector('enableTlsAndVerifyTheServerCertificateAndHostname')}</span>
        </label>
        {tls.enabled && (
          <>
            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>{tConnector('minimumTlsVersion')}</span>
                <select
                  value={tls.minVersion}
                  disabled={disabled}
                  onChange={(event) =>
                    updateTls({
                      minVersion: event.target.value as 'TLSv1.2' | 'TLSv1.3',
                    })
                  }
                >
                  <option value="TLSv1.2">TLS 1.2</option>
                  <option value="TLSv1.3">TLS 1.3</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>
                  {tConnector('serverName')}
                  <small>{tConnector('optional')}</small>
                </span>
                <input
                  value={tls.serverName}
                  maxLength={253}
                  disabled={disabled}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={tConnector('defaultsToTheConnectionHostname')}
                  onChange={(event) => updateTls({ serverName: event.target.value })}
                />
              </label>
            </div>
            {provider === 'postgres' && (
              <p className={styles.hint}>
                {tConnector('postgresqlCustomServerNamesSupportIpAndTunnelAddressesDns')}
              </p>
            )}
            <div className={styles.requirements}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={tls.caRequired}
                  disabled={disabled}
                  onChange={(event) => updateTls({ caRequired: event.target.checked })}
                />
                {tConnector('requireACustomCa')}
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={tls.clientCertificateRequired}
                  disabled={disabled}
                  onChange={(event) =>
                    updateTls({
                      clientCertificateRequired: event.target.checked,
                    })
                  }
                />
                {tConnector('requireAClientCertificate')}
              </label>
            </div>
            <div className={styles.files}>
              {(Object.keys(fileLabels(locale)) as ConnectionPemKind[]).map((kind) => {
                const required = kind === 'caPem' ? tls.caRequired : tls.clientCertificateRequired;
                const status = files[kind],
                  material = value.tls?.[kind];
                return (
                  <div className={styles.file} key={kind}>
                    <div>
                      <strong>{fileLabels(locale)[kind]}</strong>
                      <span>
                        {status.pending
                          ? tConnector('reading')
                          : material
                            ? status.name || tConnector('pemLoaded')
                            : required
                              ? tConnector('uploadAgainBeforeConnecting')
                              : kind === 'caPem'
                                ? tConnector('defaultsToSystemTrustRoots')
                                : tConnector('notProvided')}
                      </span>
                    </div>
                    <label className={styles.fileButton} aria-disabled={disabled}>
                      <FileArrowUp size={14} />
                      <span>{material ? tConnector('replace') : tConnector('chooseFile')}</span>
                      <input
                        aria-label={tConnector('chooseFile587', {
                          p0: String(fileLabels(locale)[kind]),
                        })}
                        type="file"
                        accept=".pem,.crt,.cer,.key,text/plain,application/x-pem-file"
                        disabled={disabled}
                        onChange={(event) => {
                          const selected = event.target.files?.[0];
                          event.target.value = '';
                          if (selected) void upload(kind, selected);
                        }}
                      />
                    </label>
                    {(material || status.error || status.pending) && (
                      <button
                        type="button"
                        className={styles.iconButton}
                        disabled={disabled}
                        aria-label={tConnector('clear', { p0: String(fileLabels(locale)[kind]) })}
                        onClick={() => clearFile(kind)}
                      >
                        <Trash size={14} />
                      </button>
                    )}
                    {status.error && (
                      <p className={styles.fileError} role="alert">
                        {uiText(status.error, locale)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <label className={styles.field} htmlFor={`${id}-passphrase`}>
              <span>
                {tConnector('privateKeyPassphrase')}
                <small>{tConnector('onlyRequiredForEncryptedPrivateKeys')}</small>
              </span>
              <div className={styles.secretInput}>
                <input
                  id={`${id}-passphrase`}
                  type={showPassphrase ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={disabled}
                  maxLength={4096}
                  value={value.tls?.privateKeyPassphrase ?? ''}
                  onChange={(event) => updateTls({ privateKeyPassphrase: event.target.value })}
                />
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={showPassphrase}
                  onClick={() => setShowPassphrase((current) => !current)}
                >
                  {showPassphrase ? tConnector('hide') : tConnector('showing')}
                </button>
              </div>
            </label>
            <p className={styles.secureNote}>
              <ShieldCheck size={14} />
              <span>{tConnector('fileContentsAndThePrivateKeyPassphraseAreSentOnly')}</span>
            </p>
          </>
        )}
      </div>
      {validation && (
        <p className={styles.error} role="alert">
          <WarningCircle size={14} />
          {validation}
        </p>
      )}
    </section>
  );
}
