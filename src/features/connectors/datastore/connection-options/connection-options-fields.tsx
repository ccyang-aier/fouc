'use client';

import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  FileArrowUp,
  ShieldCheck,
  Timer,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  defaultConnectionOptions,
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
  type NativeNetworkProvider,
} from '@fouc/shared/connection-options';
import { ConnectionDurationField } from './duration-field';
import { readConnectionPem, type ConnectionPemKind } from './pem-file';
import styles from './connection-options.module.css';

export type ConnectionOptionsFieldsProps = {
  provider: NativeNetworkProvider;
  value: DatabaseConnectionOptionsInput;
  onChange: (value: DatabaseConnectionOptionsInput) => void;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
};
type FileStatus = { name: string; pending: boolean; error: string };
const fileLabels: Record<ConnectionPemKind, string> = {
  caPem: 'CA 证书',
  certificatePem: '客户端证书',
  privateKeyPem: '客户端私钥',
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
  const id = useId(),
    defaults = defaultConnectionOptions(provider),
    tls = { ...defaults.tls, ...value.tls };
  const latest = useRef({ provider, value, onChange, disabled });
  useLayoutEffect(() => {
    latest.current = { provider, value, onChange, disabled };
  }, [provider, value, onChange, disabled]);
  const epochs = useRef({ caPem: 0, certificatePem: 0, privateKeyPem: 0 });
  const [files, setFiles] = useState(emptyFiles);
  const [invalidDurations, setInvalidDurations] = useState<
    Record<string, boolean>
  >({});
  const [showPassphrase, setShowPassphrase] = useState(false);
  let validation = '';
  try {
    resolveConnectionOptions(provider, value, false, false);
  } catch (error) {
    validation = error instanceof Error ? error.message : '连接参数无效';
  }
  const valid =
    !validation &&
    !Object.values(invalidDurations).some(Boolean) &&
    !Object.values(files).some((file) => file.pending || file.error);
  const notifyValidity = useEffectEvent((next: boolean) =>
    onValidityChange?.(next),
  );
  useEffect(() => {
    notifyValidity(valid);
  }, [valid]);
  useEffect(() => {
    const counters = epochs.current;
    return () => {
      for (const kind of Object.keys(counters) as ConnectionPemKind[])
        counters[kind]++;
    };
  }, []);

  function updateTls(
    patch: NonNullable<DatabaseConnectionOptionsInput['tls']>,
  ) {
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
      const pem = await readConnectionPem(file, kind);
      const current = latest.current;
      if (epoch !== epochs.current[kind]) return;
      if (
        current.provider !== sourceProvider ||
        current.disabled ||
        !current.value.tls?.enabled
      ) {
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
          error: error instanceof Error ? error.message : '文件读取失败',
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
    <section className={styles.options} aria-label="高级连接参数">
      <div className={styles.sectionTitle}>
        <Timer size={16} />
        <strong>超时与连接池</strong>
        <span>有界等待</span>
      </div>
      <div className={styles.durationGrid}>
        {(
          [
            ['connectTimeoutMs', '建立连接', 300_000],
            [
              'queryTimeoutMs',
              provider === 'redis' ? '命令截止时间' : '查询截止时间',
              3_600_000,
            ],
            ...(provider === 'redis'
              ? []
              : [['idleTimeoutMs', '空闲连接回收', 3_600_000]]),
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
            onChange={(milliseconds) =>
              onChange({ ...value, [key]: milliseconds })
            }
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
          查询截止时间同时用于服务器 maxTimeMS 与套接字等待；SRV DNS
          发现使用建立连接超时。
        </p>
      )}

      <div className={styles.tlsSection}>
        <div className={styles.sectionTitle}>
          <ShieldCheck size={16} />
          <strong>传输安全</strong>
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
                for (const kind of Object.keys(
                  epochs.current,
                ) as ConnectionPemKind[])
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
          <span>启用 TLS 并验证服务器证书与主机名</span>
        </label>
        {tls.enabled && (
          <>
            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>最低 TLS 版本</span>
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
                  服务器名称 <small>可选</small>
                </span>
                <input
                  value={tls.serverName}
                  maxLength={253}
                  disabled={disabled}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="默认使用连接主机名"
                  onChange={(event) =>
                    updateTls({ serverName: event.target.value })
                  }
                />
              </label>
            </div>
            {provider === 'postgres' && (
              <p className={styles.hint}>
                PostgreSQL 自定义服务器名称适用于 IP / 隧道地址；DNS
                连接须与主机名一致。
              </p>
            )}
            <div className={styles.requirements}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={tls.caRequired}
                  disabled={disabled}
                  onChange={(event) =>
                    updateTls({ caRequired: event.target.checked })
                  }
                />
                要求自定义 CA
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
                要求客户端证书
              </label>
            </div>
            <div className={styles.files}>
              {(Object.keys(fileLabels) as ConnectionPemKind[]).map((kind) => {
                const required =
                  kind === 'caPem'
                    ? tls.caRequired
                    : tls.clientCertificateRequired;
                const status = files[kind],
                  material = value.tls?.[kind];
                return (
                  <div className={styles.file} key={kind}>
                    <div>
                      <strong>{fileLabels[kind]}</strong>
                      <span>
                        {status.pending
                          ? '读取中…'
                          : material
                            ? status.name || '已加载 PEM'
                            : required
                              ? '连接前需重新上传'
                              : kind === 'caPem'
                                ? '默认使用系统信任根'
                                : '未提供'}
                      </span>
                    </div>
                    <label
                      className={styles.fileButton}
                      aria-disabled={disabled}
                    >
                      <FileArrowUp size={14} />
                      <span>{material ? '更换' : '选择文件'}</span>
                      <input
                        aria-label={`选择${fileLabels[kind]}文件`}
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
                        aria-label={`清除${fileLabels[kind]}`}
                        onClick={() => clearFile(kind)}
                      >
                        <Trash size={14} />
                      </button>
                    )}
                    {status.error && (
                      <p className={styles.fileError} role="alert">
                        {status.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <label className={styles.field} htmlFor={`${id}-passphrase`}>
              <span>
                私钥口令 <small>仅加密私钥需要</small>
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
                  onChange={(event) =>
                    updateTls({ privateKeyPassphrase: event.target.value })
                  }
                />
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={showPassphrase}
                  onClick={() => setShowPassphrase((current) => !current)}
                >
                  {showPassphrase ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
            <p className={styles.secureNote}>
              <ShieldCheck size={14} />
              <span>
                文件内容和私钥口令只随本次请求发送，不保存到连接配置。保存的证书需求会提示下次重新上传。
              </span>
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
