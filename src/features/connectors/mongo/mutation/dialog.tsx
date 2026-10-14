'use client';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import {
  type MongoMutationInput,
  type MongoMutationReview,
  type MongoMutationSummary,
} from '@fouc/shared/mongo-mutation';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { useEffect, useRef, useState } from 'react';
import { uiFailure, uiText, type UiMessage } from '../../i18n/ui-message';
import { mongoMutationTitle } from '../i18n/mutation-titles';
import { messages as unitMessages } from './../i18n/mutation-dialog';
import { MongoEjsonEditor } from './editor';
import styles from './mutation.module.css';
import { MongoMutationReviewView } from './review';

export type MongoMutationDialogProps = {
  base: string;
  input: MongoMutationInput;
  onClose: () => void;
  onApplied?: (summary: MongoMutationSummary) => void;
  onPreview?: (
    input: MongoMutationInput,
    signal?: AbortSignal,
  ) => Promise<{ planId: string; review: MongoMutationReview }>;
  onCommit?: (planId: string, signal?: AbortSignal) => Promise<MongoMutationSummary>;
  onDiscard?: (planId: string) => Promise<void>;
};
export function MongoMutationDialog(props: MongoMutationDialogProps) {
  return <Workflow key={`${props.base}:${JSON.stringify(props.input)}`} {...props} />;
}
function Workflow({
  base,
  input,
  onClose,
  onApplied,
  onPreview,
  onCommit,
  onDiscard,
}: MongoMutationDialogProps) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const operation = input.operation,
    title = mongoMutationTitle(operation, locale);
  const [collection, setCollection] = useState(input.collection);
  const [document, setDocument] = useState('documentEjson' in input ? input.documentEjson : '{}');
  const [keys, setKeys] = useState('keysEjson' in input ? input.keysEjson : '{"field":1}');
  const [options, setOptions] = useState(
    'optionsEjson' in input ? (input.optionsEjson ?? '{}') : '{}',
  );
  const [review, setReview] = useState<MongoMutationReview | null>(null),
    [summary, setSummary] = useState<MongoMutationSummary | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null),
    [error, setError] = useState<UiMessage>(''),
    [confirmation, setConfirmation] = useState('');
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef<AbortController | null>(null),
    token = useRef<string | null>(null),
    discardRef = useRef(onDiscard);
  useEffect(() => {
    discardRef.current = onDiscard;
  }, [onDiscard]);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      request.current?.abort();
      const current = token.current;
      token.current = null;
      if (current)
        void (
          discardRef.current
            ? discardRef.current(current)
            : backendFetch(`${base}/mutation/plans/${encodeURIComponent(current)}`, {
                method: 'DELETE',
              })
        ).catch(() => undefined);
      element?.close();
    };
  }, [base]);
  function discard() {
    const current = token.current;
    token.current = null;
    if (current)
      void (
        onDiscard
          ? onDiscard(current)
          : backendFetch(`${base}/mutation/plans/${encodeURIComponent(current)}`, {
              method: 'DELETE',
            })
      ).catch(() => undefined);
  }
  function edit() {
    request.current?.abort();
    request.current = null;
    discard();
    setReview(null);
    setConfirmation('');
    setError('');
    setBusy(null);
  }
  function close() {
    if (busy === 'commit') return;
    request.current?.abort();
    discard();
    onClose();
  }
  function payload(): MongoMutationInput {
    switch (input.operation) {
      case 'insert-document':
        return { ...input, collection, documentEjson: document };
      case 'replace-document':
        return { ...input, collection, documentEjson: document };
      case 'create-index':
        return { ...input, collection, keysEjson: keys, optionsEjson: options };
      case 'create-collection':
        return { ...input, collection, optionsEjson: options };
      default:
        return { ...input, collection };
    }
  }
  async function preview() {
    discard();
    const controller = new AbortController();
    request.current = controller;
    setBusy('preview');
    setError('');
    try {
      const response = await (onPreview
        ? onPreview(payload(), controller.signal)
        : backendFetch<{ planId: string; review: MongoMutationReview }>(`${base}/mutation/plans`, {
            method: 'POST',
            body: JSON.stringify(payload()),
            signal: controller.signal,
          }));
      if (controller.signal.aborted || request.current !== controller) {
        void (
          onDiscard
            ? onDiscard(response.planId)
            : backendFetch(`${base}/mutation/plans/${encodeURIComponent(response.planId)}`, {
                method: 'DELETE',
              })
        ).catch(() => undefined);
        return;
      }
      token.current = response.planId;
      setReview(response.review);
      setConfirmation('');
    } catch (reason) {
      if (!controller.signal.aborted && request.current === controller) setError(uiFailure(reason));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  }
  async function commit() {
    const current = token.current;
    if (!current || !review) return;
    token.current = null;
    const controller = new AbortController();
    request.current = controller;
    setBusy('commit');
    setError('');
    try {
      const result = await (onCommit
        ? onCommit(current, controller.signal)
        : backendFetch<MongoMutationSummary>(
            `${base}/mutation/plans/${encodeURIComponent(current)}/commit`,
            { method: 'POST', body: JSON.stringify({ confirm: true }), signal: controller.signal },
          ));
      if (!controller.signal.aborted && request.current === controller) {
        setSummary(result);
        setReview(null);
        onApplied?.(result);
      }
    } catch (reason) {
      if (!controller.signal.aborted && request.current === controller) {
        setReview(null);
        setError(uiFailure(reason));
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(null);
      }
    }
  }
  const destructive =
    operation === 'delete-document' ||
    operation === 'drop-collection' ||
    operation === 'drop-index';
  const canCommit =
    !!review && !busy && (operation !== 'drop-collection' || confirmation === review.collection);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            MONGODB · {summary ? tu('已完成') : review ? tu('审核计划') : tu('编辑操作')}
          </span>
          <h2>{title}</h2>
          <code>
            {input.database} / {collection || tu('新集合')}
          </code>
        </div>
        <button
          className={styles.iconButton}
          aria-label={tu('关闭{v0}', { v0: String(title) })}
          disabled={busy === 'commit'}
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      <div className={styles.body}>
        {summary ? (
          <div className={styles.success}>
            <CheckCircle size={36} weight="duotone" />
            <h3>
              {title}
              {tu('已完成')}
            </h3>
            <p>
              {summary.database} / {summary.collection}
            </p>
            <span>
              {summary.affectedCount === null
                ? tu('原生操作已确认')
                : tu('确认影响 {v0} 项', { v0: String(summary.affectedCount) })}{' '}
              · {summary.elapsedMs.toFixed(1)} ms
            </span>
            {summary.documentId && <code>{summary.documentId}</code>}
          </div>
        ) : review ? (
          <>
            <MongoMutationReviewView review={review} />
            {operation === 'drop-collection' && (
              <label className={styles.confirmation}>
                {tu('输入集合名称确认删除')}
                <input
                  aria-label={tu('输入集合名称确认删除')}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={review.collection}
                  autoComplete="off"
                  disabled={!!busy}
                />
              </label>
            )}
          </>
        ) : (
          <div className={styles.form}>
            {operation === 'create-collection' && (
              <label className={styles.nameInput}>
                {tu('集合名称')}
                <input
                  aria-label={tu('MongoDB 新集合名称')}
                  value={collection}
                  onChange={(event) => setCollection(event.target.value)}
                  disabled={!!busy}
                  autoFocus
                />
              </label>
            )}
            {(operation === 'insert-document' || operation === 'replace-document') && (
              <MongoEjsonEditor
                label={tu('文档 · Extended JSON')}
                value={document}
                onChange={setDocument}
                disabled={!!busy}
                helper={tu(
                  '保留 BSON 类型：{"$numberLong":"9007199254740993"}、{"$numberDecimal":"12.3400"}。字符串不会被解释为脚本。',
                )}
              />
            )}
            {operation === 'replace-document' && (
              <p className={styles.note}>
                {tu('将替换整个文档。未保留的字段会删除，_id 的值与类型必须保持一致。')}
              </p>
            )}
            {operation === 'delete-document' && (
              <p className={styles.note}>
                {tu(
                  '预览会重新读取完整原始 BSON 文档。确认提交后仅删除该文档，内容变化会阻止操作。',
                )}
              </p>
            )}
            {operation === 'drop-collection' && (
              <p className={styles.dangerNote}>
                {tu(
                  '此操作会删除集合的全部文档和索引。先查看原生元数据与影响数量，再输入集合名确认。',
                )}
              </p>
            )}
            {operation === 'drop-index' && (
              <p className={styles.note}>
                {tu('将删除索引')} <code>{input.indexName}</code>
                {tu('。预览会核对完整索引定义；_id 主索引不能删除。')}
              </p>
            )}
            {operation === 'create-index' && (
              <MongoEjsonEditor
                label={tu('索引字段与方向')}
                value={keys}
                onChange={setKeys}
                disabled={!!busy}
                compact
                helper={tu(
                  '字段顺序决定复合索引顺序。方向支持 1、-1、text、hashed、2d、2dsphere。',
                )}
              />
            )}
            {(operation === 'create-index' || operation === 'create-collection') && (
              <MongoEjsonEditor
                label={operation === 'create-index' ? tu('索引选项') : tu('集合选项')}
                value={options}
                onChange={setOptions}
                disabled={!!busy}
                compact
                helper={
                  operation === 'create-index'
                    ? tu(
                        '可设置 name、unique、sparse、hidden、TTL、partialFilterExpression、collation 等选项。省略 name 时按字段自动命名。',
                      )
                    : tu(
                        '默认创建普通空集合。可设置 capped / size / max、validator、validationLevel、validationAction、collation。',
                      )
                }
              />
            )}
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {uiText(error, locale)}
          </p>
        )}
        {busy && (
          <p className={styles.progress} role="status">
            <SpinnerGap size={15} className={styles.spinner} />
            {busy === 'preview'
              ? tu('正在核对当前目标与 BSON 内容…')
              : tu('正在提交，请等待原生写入确认…')}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        {summary ? (
          <>
            <span>{tu('已完成原生确认')}</span>
            <button className={styles.primary} onClick={close}>
              {tu('完成')}
            </button>
          </>
        ) : (
          <>
            <button
              className={styles.secondary}
              disabled={busy === 'commit'}
              onClick={review ? edit : close}
            >
              {review ? tu('返回编辑') : tu('取消')}
            </button>
            <span>{review ? tu('本计划仅可提交一次') : tu('先预览，再确认提交')}</span>
            {review ? (
              <button
                className={destructive ? styles.danger : styles.primary}
                disabled={!canCommit}
                onClick={() => void commit()}
              >
                {busy === 'commit' ? tu('提交中…') : tu('确认{v0}', { v0: String(title) })}
              </button>
            ) : (
              <button
                className={styles.primary}
                disabled={!!busy || !collection}
                onClick={() => void preview()}
              >
                {tu('预览操作')}
                <ArrowRight size={14} />
              </button>
            )}
          </>
        )}
      </footer>
    </dialog>
  );
}
