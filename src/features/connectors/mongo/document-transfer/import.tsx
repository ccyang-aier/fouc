'use client';

import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import {
  MONGO_DOCUMENT_TRANSFER_LIMITS as LIMITS,
  type MongoDocumentImportInput,
  type MongoDocumentImportPreview,
  type MongoDocumentImportStatus,
  type MongoImportFieldMapping,
} from '@fouc/shared/mongo-document-transfer';
import {
  MONGO_TABULAR_LIMITS,
  mongoTabularDefaultPath,
  parseMongoTabular,
  validateMongoTabularFields,
  type MongoTabularField,
  type MongoTabularOptions,
} from '@fouc/shared/mongo-tabular';
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/document-transfer-import';
import { MongoImportResult, MongoImportReview } from './import-review';
import { MongoTabularConfiguration, MongoTabularMappingReview } from './tabular-config';
import styles from './transfer.module.css';
const { message: uiMessage, error: uiError } = createUiMessages(unitMessages);

const FIELD_TYPES = [
  'string',
  'objectId',
  'int32',
  'int64',
  'decimal128',
  'double',
  'date',
  'boolean',
];
export function parseMongoImportMappings(text: string): MongoImportFieldMapping[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const separator = line.lastIndexOf(':');
      const path = line.slice(0, separator).trim(),
        type = line.slice(separator + 1).trim();
      if (separator < 0 || !path.startsWith('/') || !FIELD_TYPES.includes(type))
        throw uiError('字段转换须为 /字段/路径:类型，每行一项，例如 /amount:decimal128');
      return { path, type: type as MongoImportFieldMapping['type'] };
    });
}

export function MongoDocumentImportView({
  base,
  database,
  collection,
  writable,
  onUnlock,
  onApplied,
  onBusyChange,
}: {
  base: string;
  database: string;
  collection: string;
  writable: boolean;
  onUnlock: () => Promise<void>;
  onApplied: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [source, setSource] = useState<{ name: string; text: string; bytes: number } | null>(null);
  const [format, setFormat] = useState<MongoDocumentImportInput['format']>('ndjson'),
    [idPolicy, setIdPolicy] = useState<'preserve' | 'generate'>('preserve');
  const [tabularOptions, setTabularOptions] = useState<MongoTabularOptions>({
    delimiter: ',',
    header: true,
    trimValues: false,
    emptyAsNull: false,
    nullToken: '',
    recognizeObjectIdHex: false,
  });
  const [tabularFields, setTabularFields] = useState<MongoTabularField[] | null>(null);
  const [mappingText, setMappingText] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<MongoDocumentImportPreview | null>(null),
    [status, setStatus] = useState<MongoDocumentImportStatus | null>(null);
  const [busy, setBusy] = useState<'file' | 'preview' | 'unlock' | 'commit' | null>(null),
    [error, setError] = useState<UiMessage>('');
  const token = useRef<string | null>(null),
    request = useRef<AbortController | null>(null);
  const isTabular = format === 'csv' || format === 'tsv';
  const parsedTable = useMemo(
    () =>
      source && (format === 'csv' || format === 'tsv')
        ? parseMongoTabular(source.text, format, tabularOptions)
        : null,
    [source, format, tabularOptions],
  );
  const fields = (
    tabularFields ??
    parsedTable?.columns.map((column, sourceIndex) => ({
      sourceIndex,
      target: mongoTabularDefaultPath(column),
      type: 'string' as const,
    })) ??
    []
  ).map((field) =>
    idPolicy === 'generate' && (field.target === '/_id' || field.target?.startsWith('/_id/'))
      ? { ...field, target: null }
      : field,
  );
  useEffect(
    () => () => {
      request.current?.abort();
      if (token.current)
        void backendFetch(`${base}/documents/import/plans/${encodeURIComponent(token.current)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
    },
    [base],
  );
  function invalidate() {
    const current = token.current;
    token.current = null;
    if (current)
      void backendFetch(`${base}/documents/import/plans/${encodeURIComponent(current)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    setPreview(null);
    setStatus(null);
    setConfirmed(false);
    setError('');
  }
  function activity(value: typeof busy) {
    setBusy(value);
    onBusyChange(value !== null);
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    invalidate();
    setSource(null);
    activity('file');
    try {
      const detected: typeof format = /\.csv$/i.test(file.name)
        ? 'csv'
        : /\.tsv$/i.test(file.name)
          ? 'tsv'
          : /\.json$/i.test(file.name)
            ? 'json'
            : 'ndjson';
      const limit =
        detected === 'csv' || detected === 'tsv'
          ? MONGO_TABULAR_LIMITS.inputBytes
          : LIMITS.inputBytes;
      if (!file.size || file.size > limit)
        throw uiError('选择非空 UTF-8 文件；{v0} 最大 {v1} MiB', {
          v0: detected.toUpperCase(),
          v1: limit / 1024 / 1024,
        });
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      setSource({ name: file.name, bytes: file.size, text });
      setFormat(detected);
      setTabularOptions((current) => ({ ...current, delimiter: detected === 'tsv' ? '\t' : ',' }));
      setTabularFields(null);
    } catch (reason) {
      setError(
        reason instanceof TypeError
          ? uiMessage('文件不是有效 UTF-8，未截断或替换无效字节')
          : uiFailure(reason),
      );
    } finally {
      activity(null);
    }
  }
  async function prepare() {
    if (!source) return;
    invalidate();
    activity('preview');
    const controller = new AbortController();
    request.current = controller;
    try {
      if (isTabular) {
        if (!parsedTable || parsedTable.errors.length)
          throw uiError('先修正 CSV/TSV 解析错误，再生成完整预览');
        validateMongoTabularFields(fields, parsedTable.columns.length);
      }
      const result = await backendFetch<MongoDocumentImportPreview>(
        `${base}/documents/import/plans`,
        {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            database,
            collection,
            text: source.text,
            format,
            idPolicy,
            ...(isTabular
              ? { tabular: { ...tabularOptions, fields } }
              : { fields: parseMongoImportMappings(mappingText) }),
          }),
        },
      );
      token.current = result.planId;
      setPreview(result);
    } catch (reason) {
      setError(controller.signal.aborted ? uiMessage('预览已取消，未执行写入') : uiFailure(reason));
    } finally {
      request.current = null;
      activity(null);
    }
  }
  async function unlock() {
    invalidate();
    activity('unlock');
    try {
      await onUnlock();
    } catch (reason) {
      setError(uiFailure(reason));
    } finally {
      activity(null);
    }
  }
  async function commit() {
    const planId = token.current;
    if (!planId || !confirmed || !writable) return;
    activity('commit');
    setError('');
    const controller = new AbortController();
    request.current = controller;
    let polling = false,
      active = true;
    const poll = setInterval(() => {
      if (polling) return;
      polling = true;
      void backendFetch<MongoDocumentImportStatus>(
        `${base}/documents/import/plans/${encodeURIComponent(planId)}`,
      )
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch(() => undefined)
        .finally(() => {
          polling = false;
        });
    }, 600);
    try {
      const result = await backendFetch<MongoDocumentImportStatus>(
        `${base}/documents/import/plans/${encodeURIComponent(planId)}/commit`,
        { method: 'POST', body: JSON.stringify({ confirm: true }), signal: controller.signal },
      );
      active = false;
      setStatus(result);
      if (result.inserted || result.uncertainDocuments) onApplied();
    } catch (reason) {
      // A lost HTTP acknowledgement is not permission to retry. Recover the consumed plan's status once.
      try {
        const recovered = await backendFetch<MongoDocumentImportStatus>(
          `${base}/documents/import/plans/${encodeURIComponent(planId)}`,
        );
        active = false;
        setStatus(recovered);
        if (recovered.inserted || recovered.uncertainDocuments) onApplied();
        if (recovered.state === 'running')
          setError(
            uiMessage(
              '请求连接中断，服务器仍在等待本批确认。请停止后续批次并核对目标集合，不要重复提交。',
            ),
          );
      } catch {
        setError(
          uiMessage('无法确认导入结果，请核对目标集合，不要重复提交。{v0}', {
            v0: uiFailure(reason),
          }),
        );
      }
    } finally {
      active = false;
      clearInterval(poll);
      request.current = null;
      activity(null);
      setConfirmed(false);
    }
  }
  async function cancel() {
    const current = token.current;
    if ((busy === 'commit' || status?.state === 'running') && current) {
      try {
        setStatus(
          await backendFetch<MongoDocumentImportStatus>(
            `${base}/documents/import/plans/${encodeURIComponent(current)}/cancel`,
            { method: 'POST' },
          ),
        );
      } catch (reason) {
        setError(uiFailure(reason));
      }
    } else request.current?.abort();
  }
  return (
    <div className={styles.importWorkflow}>
      <div className={styles.importContent}>
        <div className={styles.intro}>
          <UploadSimple size={28} weight="duotone" />
          <div>
            <strong>{tu('验证文件，然后审查追加')}</strong>
            <p>
              {tu('目标')} {database}.{collection} {tu('· UTF-8 CSV / TSV、JSON 和 NDJSON。')}
            </p>
          </div>
        </div>
        {preview ? (
          <div className={styles.sourceSummary}>
            <div>
              <strong>{source?.name}</strong>
              <small>
                {format.toUpperCase()} ·{' '}
                {idPolicy === 'generate' ? tu('生成新 ObjectId') : tu('保留原生 _id')}
                {mappingText.trim() ? tu(' · 显式字段转换') : ''}
              </small>
            </div>
            <button disabled={!!busy} onClick={invalidate}>
              {tu('修改配置')}
            </button>
          </div>
        ) : (
          <fieldset disabled={busy !== null} className={styles.source}>
            <label className={styles.file}>
              <span>{source ? source.name : tu('选择文档文件')}</span>
              <small>
                {source
                  ? tu('{v0} KiB · 已完整读取', { v0: String((source.bytes / 1024).toFixed(1)) })
                  : tu('CSV / TSV 最大 5 MiB · JSON / NDJSON 最大 32 MiB')}
              </small>
              <input
                type="file"
                accept=".csv,.tsv,.json,.ndjson,.jsonl,application/json,text/csv,text/tab-separated-values"
                aria-label={tu('选择 MongoDB 文档导入文件')}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void readFile(file);
                }}
              />
            </label>
            <div className={styles.options}>
              <label>
                <span>{tu('文件格式')}</span>
                <select
                  aria-label={tu('文档导入格式')}
                  value={format}
                  onChange={(event) => {
                    invalidate();
                    const next = event.target.value as typeof format;
                    setFormat(next);
                    setTabularFields(null);
                    setTabularOptions((current) => ({
                      ...current,
                      delimiter: next === 'tsv' ? '\t' : ',',
                    }));
                  }}
                >
                  <option value="csv">{tu('CSV · 可配置分隔符')}</option>
                  <option value="tsv">{tu('TSV · 制表符')}</option>
                  <option value="ndjson">{tu('NDJSON · 每行一个文档')}</option>
                  <option value="json">{tu('JSON · 对象或对象数组')}</option>
                </select>
              </label>
              <label>
                <span>{tu('_id 处理')}</span>
                <select
                  aria-label={tu('导入文档 ID 策略')}
                  value={idPolicy}
                  onChange={(event) => {
                    invalidate();
                    setIdPolicy(event.target.value as typeof idPolicy);
                  }}
                >
                  <option value="preserve">{tu('保留原生 _id；缺少时生成')}</option>
                  <option value="generate">{tu('忽略原 _id，生成新 ObjectId')}</option>
                </select>
              </label>
            </div>
            {isTabular ? (
              <MongoTabularConfiguration
                options={tabularOptions}
                parsed={parsedTable}
                fields={fields}
                idPolicy={idPolicy}
                disabled={!!busy}
                onOptions={(next) => {
                  invalidate();
                  if (
                    next.header !== tabularOptions.header ||
                    next.delimiter !== tabularOptions.delimiter
                  )
                    setTabularFields(null);
                  setTabularOptions(next);
                }}
                onFields={(next) => {
                  invalidate();
                  setTabularFields(next);
                }}
              />
            ) : (
              <label className={styles.mapping}>
                <span>
                  {tu('显式字段类型转换')} <small>{tu('可选 · 每行一个 JSON Pointer')}</small>
                </span>
                <textarea
                  aria-label={tu('导入字段类型转换')}
                  rows={3}
                  value={mappingText}
                  spellCheck={false}
                  placeholder={'/amount:decimal128\n/items/0/count:int64\n/_id:objectId'}
                  onChange={(event) => {
                    invalidate();
                    setMappingText(event.target.value);
                  }}
                />
                <small>
                  {tu('数组使用 /items/0；~1 转义 /，~0 转义 ~。支持')} {FIELD_TYPES.join('、')}
                  {tu('。缺少字段保持缺少，null 保持 null。')}
                </small>
              </label>
            )}
          </fieldset>
        )}
        {!preview && (
          <p className={styles.notice}>
            {isTabular
              ? tu(
                  'CSV/TSV 最多 5 MiB、5000 行、256 列和 100000 个单元格。采样只给出建议，全部类型须明确选择；Int64 / Decimal128 保留数字原文，EJSON 单元格可携带嵌套对象与 BSON 类型。',
                )
              : tu(
                  '每次最多 5000 个文档、32 MiB；Canonical EJSON 保留 BSON 类型。普通 JSON 大整数须使用 $numberLong 或数字字符串再指定转换。',
                )}{' '}
            {tu('单文档最多 256 KiB。生成新 _id 时原 _id 列明确跳过；不支持 ZIP 或 dump。')}
          </p>
        )}
        {preview && !status && (
          <>
            {isTabular && parsedTable && (
              <MongoTabularMappingReview fields={fields} parsed={parsedTable} />
            )}
            <MongoImportReview preview={preview} sourceLines={parsedTable?.sourceLines} />
          </>
        )}
        {status && <MongoImportResult status={status} sourceLines={parsedTable?.sourceLines} />}
        {status?.state === 'running' && !busy && (
          <div className={styles.footer}>
            <button onClick={() => void cancel()}>{tu('停止后续批次')}</button>
            <button
              onClick={() => {
                if (token.current)
                  void backendFetch<MongoDocumentImportStatus>(
                    `${base}/documents/import/plans/${encodeURIComponent(token.current)}`,
                  )
                    .then(setStatus)
                    .catch((reason) => setError(uiFailure(reason)));
              }}
            >
              {tu('刷新写入结果')}
            </button>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {uiText(error, locale)}
          </p>
        )}
        {preview && !status && writable && (
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!!busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {tu('向')} {collection} {tu('追加全部')} {preview.documents}{' '}
              {tu('个文档；保留已成功写入，不覆盖已有文档。')}
            </span>
          </label>
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {busy === 'file'
            ? tu('完整读取文件…')
            : busy === 'preview'
              ? tu('验证全部文档并读取服务器…')
              : busy === 'commit'
                ? tu('每批最多 100 个，等待服务器确认')
                : preview
                  ? tu('一次性计划 · 5 分钟内有效')
                  : tu('预览不写入数据库')}
        </span>
        {busy === 'preview' || busy === 'commit' ? (
          <button onClick={() => void cancel()}>
            {busy === 'commit' ? tu('停止后续批次') : tu('取消预览')}
          </button>
        ) : (
          <>
            {!writable && (
              <button disabled={!!busy} onClick={() => void unlock()}>
                {tu('解锁写入')}
              </button>
            )}
            <button disabled={!source || !!busy} onClick={() => void prepare()}>
              {preview || status ? tu('重新预览') : tu('完整验证与预览')}
            </button>
            {preview && !status && (
              <button
                className={styles.primary}
                disabled={!writable || !confirmed || !!busy}
                onClick={() => void commit()}
              >
                {tu('确认追加')} {preview.documents} {tu('个文档')}
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}
