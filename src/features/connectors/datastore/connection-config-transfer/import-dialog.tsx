'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  FileArrowUp,
  ShieldCheck,
  Spinner,
} from '@phosphor-icons/react';
import {
  CONNECTION_CONFIG_LIMITS,
  type ConnectionConfigBundle,
} from '@fouc/shared/connection-config-transfer';
import { decodeConnectionConfigFile } from '@fouc/shared/connection-config-transfer-crypto';
import {
  defaultConnectionImportChoices,
  prepareConnectionImport,
  type ExistingTransferConnection,
  type ImportConnectionChoice,
} from '@fouc/shared/connection-config-transfer-plan';
import { SqlDialog } from '../sql-library-dialog';
import { ConnectionImportReview } from './import-review';
import {
  runConnectionImport,
  type ConnectionImportOutcome,
} from './operations';
import {
  readWorkspaceTransferConnections,
  saveTransferredConnection,
} from './transport';
import common from '../relational.module.css';
import styles from './transfer.module.css';

type Source = { name: string; text: string; encrypted: boolean };
type Review = {
  bundle: ConnectionConfigBundle;
  existing: ExistingTransferConnection[];
  choices: ImportConnectionChoice[];
};
export function ImportConnectionDialog({
  workspaceId,
  onClose,
  onImported,
}: {
  workspaceId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [source, setSource] = useState<Source | null>(null),
    [passphrase, setPassphrase] = useState('');
  const [review, setReview] = useState<Review | null>(null),
    [outcomes, setOutcomes] = useState<readonly ConnectionImportOutcome[]>([]);
  const [phase, setPhase] = useState<'idle' | 'read' | 'write'>('idle'),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const job = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      job.current?.abort();
    };
  }, []);
  const { plan, planError } = useMemo(() => {
    if (!review) return { plan: null, planError: '' };
    try {
      return {
        plan: prepareConnectionImport(
          review.bundle,
          review.existing,
          review.choices,
          workspaceId,
        ),
        planError: '',
      };
    } catch (reason) {
      return {
        plan: null,
        planError: reason instanceof Error ? reason.message : '导入计划无效',
      };
    }
  }, [review, workspaceId]);
  async function readFile(file: File) {
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setPhase('read');
    setSource(null);
    setReview(null);
    setOutcomes([]);
    setError('');
    setFeedback('');
    setPassphrase('');
    try {
      if (file.size > CONNECTION_CONFIG_LIMITS.fileBytes)
        throw new Error('配置文件不能超过 3 MiB');
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new Error('配置文件须为 UTF-8 JSON 文本');
      }
      controller.signal.throwIfAborted();
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error('配置文件不是有效 JSON');
      }
      setSource({
        name: file.name,
        text,
        encrypted:
          !!value &&
          typeof value === 'object' &&
          'format' in value &&
          value.format === 'fouc-connection-config-encrypted',
      });
    } catch (reason) {
      if (!controller.signal.aborted && alive.current)
        setError(reason instanceof Error ? reason.message : '文件读取失败');
    } finally {
      if (!controller.signal.aborted && alive.current) setPhase('idle');
    }
  }
  async function inspect() {
    if (!source || phase !== 'idle') return;
    const controller = new AbortController();
    job.current = controller;
    setPhase('read');
    setError('');
    setFeedback('');
    try {
      const bundle = await decodeConnectionConfigFile(
        source.text,
        passphrase,
        controller.signal,
      );
      const existing = await readWorkspaceTransferConnections(
        workspaceId,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      setReview({
        bundle,
        existing,
        choices: defaultConnectionImportChoices(bundle, existing),
      });
      setPassphrase('');
      setOutcomes([]);
    } catch (reason) {
      if (!controller.signal.aborted && alive.current)
        setError(reason instanceof Error ? reason.message : '配置校验失败');
    } finally {
      if (!controller.signal.aborted && alive.current) setPhase('idle');
    }
  }
  async function perform() {
    if (!review || !plan || phase !== 'idle' || outcomes.length) return;
    const controller = new AbortController();
    job.current = controller;
    setPhase('write');
    setError('');
    setFeedback('');
    try {
      const result = await runConnectionImport({
        ...review,
        workspaceId,
        port: {
          list: () =>
            readWorkspaceTransferConnections(workspaceId, controller.signal),
          save: (entry, id) =>
            saveTransferredConnection(workspaceId, entry, id),
        },
        signal: controller.signal,
        onProgress: (next) => {
          if (alive.current) setOutcomes(next);
        },
      });
      const saved = result.filter((item) => item.status === 'saved').length,
        failed = result.filter((item) => item.status === 'failed').length,
        cancelled = result.filter((item) => item.status === 'cancelled').length,
        skipped = result.filter((item) => item.status === 'skipped').length;
      if (alive.current)
        setFeedback(
          `已保存 ${saved} · 失败 ${failed} · 跳过 ${skipped}${cancelled ? ` · 取消 ${cancelled}` : ''}`,
        );
      if (saved) onImported();
    } catch (reason) {
      if (alive.current) {
        if (controller.signal.aborted) setFeedback('已取消，尚未开始保存连接');
        else
          setError(reason instanceof Error ? reason.message : '配置导入失败');
      }
    } finally {
      if (alive.current) setPhase('idle');
    }
  }
  function cancel() {
    job.current?.abort();
    if (phase === 'write')
      setFeedback('正在停止后续导入；当前保存请求完成后会显示实际结果。');
    else {
      setPhase('idle');
      onClose();
    }
  }
  return (
    <SqlDialog
      title="导入连接配置"
      busy={phase !== 'idle'}
      className={styles.dialog}
      onClose={onClose}
    >
      <div className={styles.body}>
        <div className={styles.scope}>
          <ShieldCheck size={15} />
          <span>
            导入到当前工作空间 · 仅 Fouc 公开连接配置 · 完整校验后才会开始保存
          </span>
        </div>
        {!review ? (
          <>
            <label className={styles.upload}>
              <FileArrowUp size={25} />
              <strong>{source?.name ?? '选择连接配置文件'}</strong>
              <span>公开 JSON 或使用口令加密的 Fouc JSON · 最大 3 MiB</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={phase !== 'idle'}
                aria-label="选择连接配置文件"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void readFile(file);
                }}
              />
            </label>
            {source?.encrypted && (
              <label className={styles.field}>
                解密口令
                <input
                  type="password"
                  autoComplete="off"
                  value={passphrase}
                  disabled={phase !== 'idle'}
                  maxLength={1024}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
            )}
            <p className={styles.hint}>
              支持 PostgreSQL、MySQL、SQLite、Redis 和
              MongoDB。其他工具的格式及凭据存储不在本次导入范围内。
            </p>
          </>
        ) : (
          <>
            <div className={styles.reviewHead}>
              <div>
                <strong>{review.bundle.connections.length} 个已校验连接</strong>
                <small>{source?.name} · 各类型会导入其相应连接目录</small>
              </div>
              {!outcomes.length && (
                <button
                  type="button"
                  disabled={phase !== 'idle'}
                  onClick={() => {
                    setReview(null);
                    setError('');
                  }}
                >
                  <ArrowLeft size={13} />
                  重新选择
                </button>
              )}
            </div>
            <ConnectionImportReview
              {...review}
              disabled={phase !== 'idle' || !!outcomes.length}
              outcomes={outcomes}
              onChange={(index, choice) =>
                setReview((current) =>
                  current
                    ? {
                        ...current,
                        choices: current.choices.map((previous, candidate) =>
                          candidate === index ? choice : previous,
                        ),
                      }
                    : current,
                )
              }
            />
            {!outcomes.length && (
              <p className={styles.hint}>
                默认新建并为同名连接改名。只有明确选择“替换现有同名配置”才会更新现有连接。
              </p>
            )}
          </>
        )}
        {phase !== 'idle' && (
          <p className={styles.progress} role="status">
            <Spinner size={15} className={styles.spin} />
            {phase === 'write'
              ? `正在保存 · 已完成 ${outcomes.filter((item) => item.status !== 'pending').length} / ${outcomes.length || review?.bundle.connections.length || 0}`
              : '正在读取、解密与校验配置…'}
          </p>
        )}
        {planError && (
          <p className={styles.error} role="alert">
            {planError}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {feedback && (
          <p className={styles.success} role="status">
            <CheckCircle size={15} />
            {feedback}
          </p>
        )}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}>
        <span>
          {plan
            ? `新建 ${plan.create} · 更新 ${plan.update} · 跳过 ${plan.skip}`
            : '不读取数据库内容'}
        </span>
        <button type="button" className={common.secondary} onClick={cancel}>
          {phase === 'write'
            ? '停止后续导入'
            : outcomes.length
              ? '关闭'
              : '取消'}
        </button>
        {!review ? (
          <button
            type="button"
            className={common.primary}
            disabled={
              !source ||
              phase !== 'idle' ||
              (source.encrypted && Array.from(passphrase).length < 12)
            }
            onClick={() => void inspect()}
          >
            校验并预览
          </button>
        ) : (
          !outcomes.length && (
            <button
              type="button"
              className={common.primary}
              disabled={
                phase !== 'idle' || !plan || plan.create + plan.update === 0
              }
              onClick={() => void perform()}
            >
              确认导入 {plan ? plan.create + plan.update : 0} 个连接
            </button>
          )
        )}
      </footer>
    </SqlDialog>
  );
}
