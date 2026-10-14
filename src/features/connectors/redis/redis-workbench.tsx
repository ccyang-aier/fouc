'use client';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import type {
  RedisBlob,
  RedisKeyInfo,
  RedisMutation,
  RedisMutationResult,
  RedisScanPage,
  RedisSession,
  RedisValuePage,
} from '@fouc/shared';
import type { RedisBulkResult } from '@fouc/shared/redis-bulk';
import {
  ArrowLeft,
  ArrowsClockwise,
  Broadcast,
  ChartLineUp,
  CheckCircle,
  ClockCounterClockwise,
  Database,
  Key,
  Lock,
  LockOpen,
  MagnifyingGlass,
  Plus,
  TerminalWindow,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { RedisBulkKeyList } from './bulk/key-list';
import { messages as unitMessages } from './i18n/redis-workbench';
import { RedisConsole } from './redis-console';
import { RedisDashboard } from './redis-dashboard';
import { RedisDatabaseSelector } from './redis-database-selector';
import { RedisMutationDialog } from './redis-mutation-dialog';
import type { RedisEditIntent } from './redis-mutation-model';
import { RedisPubSubView } from './redis-pubsub';
import { RedisSlowlog } from './redis-slowlog';
import { RedisValueViewer } from './redis-value-viewer';
import styles from './redis.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function RedisWorkbench({
  session,
  name,
  onBack,
  onSessionChange,
}: {
  session: RedisSession;
  name: string;
  onBack: () => void;
  onSessionChange: (session: RedisSession) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const base = `/api/database/redis/sessions/${session.id}`;
  const [pattern, setPattern] = useState('*');
  const [applied, setApplied] = useState('*');
  const [scan, setScan] = useState<RedisScanPage | null>(null);
  const [keys, setKeys] = useState<RedisKeyInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [value, setValue] = useState<RedisValuePage | null>(null);
  const [mode, setMode] = useState<'keys' | 'console' | 'dashboard' | 'slowlog' | 'pubsub'>('keys');
  const [scanBusy, setScanBusy] = useState(true);
  const [valueBusy, setValueBusy] = useState(false);
  const [scanError, setScanError] = useState<UiMessage>('');
  const [valueError, setValueError] = useState<UiMessage>('');
  const [scanRequest, setScanRequest] = useState({ cursor: '0', revision: 0 });
  const [valueRequest, setValueRequest] = useState({ cursor: '0', revision: 0 });
  const [readOnly, setReadOnly] = useState(session.readOnly);
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeError, setWriteError] = useState<UiMessage>('');
  const [feedback, setFeedback] = useState<UiMessage>('');
  const [intent, setIntent] = useState<RedisEditIntent | null>(null);
  const [databaseSelector, setDatabaseSelector] = useState(false);
  const [consoleBusy, setConsoleBusy] = useState(false);
  const [jsonDirty, setJsonDirty] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<RedisScanPage>(`${base}/scan`, {
      method: 'POST',
      body: JSON.stringify({ cursor: scanRequest.cursor, pattern: applied }),
      signal: controller.signal,
    })
      .then((page) => {
        if (!controller.signal.aborted) {
          setScan(page);
          setKeys((current) =>
            scanRequest.cursor === '0'
              ? page.keys
              : [
                  ...new Map(
                    [...current, ...page.keys].map((key) => [key.key.rawBase64, key]),
                  ).values(),
                ],
          );
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setScanError(uiFailure(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setScanBusy(false);
      });
    return () => controller.abort();
  }, [base, applied, scanRequest]);
  useEffect(() => {
    if (selected === null) return;
    const controller = new AbortController();
    void backendFetch<RedisValuePage>(`${base}/value`, {
      method: 'POST',
      body: JSON.stringify({ key: selected, cursor: valueRequest.cursor }),
      signal: controller.signal,
    })
      .then((page) => {
        if (!controller.signal.aborted) setValue(page);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setValueError(uiFailure(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setValueBusy(false);
      });
    return () => controller.abort();
  }, [base, selected, valueRequest]);
  function requestScan(cursor = '0') {
    setScanBusy(true);
    setScanError('');
    setScanRequest((current) => ({ cursor, revision: current.revision + 1 }));
  }
  function requestValue(cursor = '0') {
    setValueBusy(true);
    setValueError('');
    setValueRequest((current) => ({ cursor, revision: current.revision + 1 }));
  }
  function refresh() {
    requestScan();
    if (selected !== null) requestValue();
  }
  async function toggleWriteMode() {
    setWriteBusy(true);
    setWriteError('');
    setFeedback('');
    try {
      const updated = await backendFetch<RedisSession>(`${base}/write-mode`, {
        method: 'POST',
        body: JSON.stringify({ readOnly: !readOnly }),
      });
      setReadOnly(updated.readOnly);
      setIntent(null);
      setValue(null);
      if (selected !== null) requestValue();
      setFeedback(
        updated.readOnly
          ? uiMessage('已重新锁定写入')
          : uiMessage('当前会话写入已解锁；每项变更均需预览确认'),
      );
    } catch (reason) {
      setWriteError(uiFailure(reason));
    } finally {
      setWriteBusy(false);
    }
  }
  function openMutation(mutation: RedisMutation) {
    if (jsonDirty && mutation.kind !== 'json-set') {
      setWriteError(uiMessage('请先丢弃或保存 RedisJSON 草稿'));
      return;
    }
    setWriteError('');
    setFeedback('');
    setIntent({ mutation, writeVersion: value?.writeVersion ?? null });
  }
  async function editString() {
    if (selected === null) return;
    setWriteBusy(true);
    setWriteError('');
    try {
      const full = await backendFetch<{ content: RedisBlob; writeVersion: string }>(
        `${base}/edit-string`,
        {
          method: 'POST',
          body: JSON.stringify({ key: selected }),
        },
      );
      setIntent({
        mutation: { kind: 'string-set', key: selected, value: full.content.rawBase64 },
        writeVersion: full.writeVersion,
      });
    } catch (reason) {
      setWriteError(uiFailure(reason));
    } finally {
      setWriteBusy(false);
    }
  }
  function saved(result: RedisMutationResult) {
    setIntent(null);
    setFeedback(uiMessage('变更已执行 · {v0} ms', { v0: String(result.executionTimeMs) }));
    setWriteError('');
    setSelected(result.deleted ? null : result.key.rawBase64);
    setValue(null);
    setValueBusy(false);
    requestScan();
    if (!result.deleted) requestValue();
  }
  async function unlockBulk() {
    const updated = await backendFetch<RedisSession>(`${base}/write-mode`, {
      method: 'POST',
      body: JSON.stringify({ readOnly: false }),
    });
    setReadOnly(updated.readOnly);
    setIntent(null);
    setValue(null);
    if (selected !== null) requestValue();
  }
  function bulkApplied(result: RedisBulkResult) {
    setFeedback(
      uiMessage('批量结果 · 已执行 {v0} · 无需更改 {v1} · 未确认 {v2}', {
        v0: String(result.applied),
        v1: String(result.unchanged),
        v2: String(result.unknown),
      }),
    );
    setWriteError('');
    refresh();
  }
  return (
    <section className={styles.workbench} aria-label={tu('Redis 工作台')}>
      <header className={styles.header}>
        <button
          type="button"
          aria-label={tu('返回数据库连接列表')}
          disabled={writeBusy || consoleBusy || jsonDirty}
          onClick={onBack}
        >
          <ArrowLeft size={17} />
        </button>
        <Database size={17} />
        <strong title={name}>{name}</strong>
        <span>Redis {session.version ?? ''}</span>
        <button
          type="button"
          className={styles.databaseButton}
          disabled={writeBusy || consoleBusy || Boolean(intent) || jsonDirty}
          onClick={() => setDatabaseSelector(true)}
        >
          DB {session.database} ▾
        </button>
        <button
          type="button"
          className={styles.writeMode}
          aria-label={writeBusy ? tu('处理中…') : readOnly ? tu('解锁写入') : tu('重新锁定')}
          title={readOnly ? tu('解锁写入') : tu('重新锁定')}
          disabled={writeBusy || Boolean(intent) || jsonDirty}
          onClick={() => void toggleWriteMode()}
        >
          {readOnly ? <Lock size={14} /> : <LockOpen size={14} />}
          <span>{writeBusy ? tu('处理中…') : readOnly ? tu('解锁写入') : tu('重新锁定')}</span>
        </button>
        <button
          type="button"
          aria-label={tu('刷新 Redis 数据')}
          onClick={refresh}
          disabled={scanBusy || valueBusy || writeBusy || jsonDirty || mode !== 'keys'}
        >
          <ArrowsClockwise size={16} />
        </button>
      </header>
      {writeError && (
        <div role="alert" className={styles.error}>
          {uiText(writeError, locale)}
        </div>
      )}
      {feedback && (
        <div role="status" className={styles.feedback}>
          <CheckCircle size={14} />
          {uiText(feedback, locale)}
        </div>
      )}
      <nav className={styles.tabs} aria-label={tu('Redis 工作台视图')}>
        <button
          type="button"
          aria-current={mode === 'keys' ? 'page' : undefined}
          disabled={consoleBusy || jsonDirty}
          onClick={() => setMode('keys')}
        >
          <Key size={14} />
          {tu('Key 浏览')}{' '}
        </button>
        <button
          type="button"
          aria-current={mode === 'console' ? 'page' : undefined}
          disabled={jsonDirty}
          onClick={() => setMode('console')}
        >
          <TerminalWindow size={14} />
          {tu('命令台')}{' '}
        </button>
        <button
          type="button"
          aria-current={mode === 'dashboard' ? 'page' : undefined}
          disabled={consoleBusy || jsonDirty}
          onClick={() => setMode('dashboard')}
        >
          <ChartLineUp size={14} />
          {tu('运行概览')}
        </button>
        <button
          type="button"
          aria-current={mode === 'slowlog' ? 'page' : undefined}
          disabled={consoleBusy || jsonDirty}
          onClick={() => setMode('slowlog')}
        >
          <ClockCounterClockwise size={14} />
          {tu('慢日志')}
        </button>
        <button
          type="button"
          aria-current={mode === 'pubsub' ? 'page' : undefined}
          disabled={consoleBusy || jsonDirty}
          onClick={() => setMode('pubsub')}
        >
          <Broadcast size={14} />
          Pub/Sub
        </button>
      </nav>
      {mode === 'pubsub' ? (
        <RedisPubSubView base={base} readOnly={readOnly} onBusyChange={setWriteBusy} />
      ) : mode === 'dashboard' ? (
        <RedisDashboard base={base} />
      ) : mode === 'slowlog' ? (
        <RedisSlowlog base={base} />
      ) : mode === 'console' ? (
        <RedisConsole base={base} database={session.database} onBusyChange={setConsoleBusy} />
      ) : (
        <div className={styles.body}>
          <aside className={styles.keyPanel} aria-label={tu('Redis Key 列表')}>
            <form
              className={styles.search}
              onSubmit={(event) => {
                event.preventDefault();
                if (jsonDirty) return;
                setApplied(pattern || '*');
                requestScan();
                setSelected(null);
                setValue(null);
                setValueBusy(false);
                setValueError('');
                setKeys([]);
              }}
            >
              <MagnifyingGlass size={14} />
              <input
                aria-label={tu('Key 匹配规则')}
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                placeholder={tu('前缀:*')}
              />
              <button type="submit" disabled={scanBusy || writeBusy || jsonDirty}>
                {tu('搜索')}{' '}
              </button>
            </form>
            <div className={styles.keyCount}>
              DB {session.database} · {scan?.totalKeys ?? '…'} {tu('个 Key · 已加载')} {keys.length}
              {!readOnly && (
                <button
                  type="button"
                  disabled={writeBusy || jsonDirty}
                  onClick={() =>
                    openMutation({ kind: 'create', key: '', type: 'string', value: '' })
                  }
                >
                  <Plus size={12} />
                  {tu('新建 Key')}
                </button>
              )}
            </div>
            {scanError && (
              <div role="alert" className={styles.error}>
                {uiText(scanError, locale)}
                <button type="button" onClick={() => requestScan(scanRequest.cursor)}>
                  {tu('重试')}{' '}
                </button>
              </div>
            )}
            <div className={styles.keyList}>
              <RedisBulkKeyList
                key={base}
                base={base}
                database={session.database}
                keys={keys}
                selected={selected}
                disabled={writeBusy || jsonDirty}
                readOnly={readOnly}
                onUnlock={unlockBulk}
                onBusyChange={setWriteBusy}
                onApplied={bulkApplied}
                onSelect={(key) => {
                  setSelected(key);
                  setValue(null);
                  requestValue();
                }}
              />
              {scanBusy && (
                <div className={styles.notice} role="status">
                  {tu('扫描中…')}{' '}
                </div>
              )}
              {!scanBusy && !keys.length && !scanError && (
                <div className={styles.empty}>
                  {tu('当前批次没有匹配的 Key')}
                  {scan?.cursor !== '0' ? tu('，可继续扫描。') : '。'}
                </div>
              )}
            </div>
            {scan && scan.cursor !== '0' && (
              <button
                type="button"
                className={styles.loadMore}
                disabled={scanBusy}
                onClick={() => requestScan(scan.cursor)}
              >
                {tu('继续扫描')}{' '}
              </button>
            )}
          </aside>
          <main className={styles.main}>
            {valueError && (
              <div role="alert" className={styles.error}>
                {uiText(valueError, locale)}
                <button type="button" onClick={() => requestValue(valueRequest.cursor)}>
                  {tu('重试')}{' '}
                </button>
              </div>
            )}
            {valueBusy && (
              <p className={styles.notice} role="status">
                {tu('读取 Key 内容…')}{' '}
              </p>
            )}
            {value ? (
              <RedisValueViewer
                onDraftChange={setJsonDirty}
                base={base}
                key={`${selected}:${valueRequest.cursor}`}
                value={value}
                busy={valueBusy || writeBusy}
                onNext={requestValue}
                readOnly={readOnly}
                onMutation={openMutation}
                onEditString={() => void editString()}
              />
            ) : (
              !valueBusy &&
              !valueError && (
                <div className={styles.empty}>
                  <Key size={30} />
                  <strong>{tu('选择一个 Key')}</strong>
                  <span>{tu('查看原始值、集合成员与过期时间。')}</span>
                </div>
              )
            )}
          </main>
        </div>
      )}
      <footer className={styles.status}>
        {tu('Standalone · 当前设备 · Key 与值保留原始字节 · 扫描期间数据可能变化')}{' '}
      </footer>
      {intent && (
        <RedisMutationDialog
          base={base}
          intent={intent}
          onClose={() => setIntent(null)}
          onSaved={saved}
        />
      )}
      {databaseSelector && (
        <RedisDatabaseSelector
          base={base}
          current={session.database}
          onClose={() => {
            setDatabaseSelector(false);
            refresh();
          }}
          onSwitch={(updated) => {
            setDatabaseSelector(false);
            if (updated.id !== session.id) onSessionChange(updated);
          }}
        />
      )}
    </section>
  );
}
