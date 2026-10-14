'use client';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import { formatJsonSource } from '@fouc/shared';
import type { MongoCommandResult } from '@fouc/shared/mongo';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import { useEffect, useRef, useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/mongo-console';
import styles from './mongo.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function MongoConsole({ base, database }: { base: string; database: string }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [text, setText] = useState('{"ping": 1}'),
    [result, setResult] = useState<MongoCommandResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<UiMessage>('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function run() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await backendFetch<MongoCommandResult>(`${base}/command`, {
        method: 'POST',
        body: JSON.stringify({ database, command: text, limit: 50 }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setResult(response);
    } catch (reason) {
      if (!controller.signal.aborted) setError(uiFailure(reason));
    } finally {
      if (active.current === controller) {
        setBusy(false);
        active.current = null;
      }
    }
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setError(uiMessage('查询已取消。'));
  }
  return (
    <div className={styles.console}>
      <div className={styles.consoleHeader}>
        <div>
          <h3>{tu('只读命令')}</h3>
          <p>{tu('Extended JSON 命令文档 · 不执行 JavaScript')}</p>
        </div>
        <button
          className={busy ? styles.smallButton : styles.primaryButton}
          onClick={() => (busy ? cancel() : void run())}
        >
          {busy ? <Stop size={14} /> : <Play size={14} weight="fill" />}
          {busy ? tu('取消') : tu('运行')}
        </button>
      </div>
      <textarea
        aria-label={tu('MongoDB 只读命令')}
        className={styles.commandInput}
        value={text}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!busy) void run();
          }
        }}
      />
      <p className={styles.precision}>
        {tu(
          '支持 find、aggregate、count、distinct、统计与 queryPlanner。$out、$merge、$where 和写入命令会被拦截。',
        )}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {uiText(error, locale)}
        </p>
      )}
      {busy && (
        <div role="status" className={styles.loading}>
          {tu('正在读取')} {database}…
        </div>
      )}
      {result && (
        <div className={styles.commandResult}>
          <div className={styles.resultCaption}>
            <span>{result.commandName}</span>
            <span>
              {result.elapsedMs.toFixed(1)} ms
              {result.documents.length
                ? tu(' · {v0} 个文档', { v0: String(result.documents.length) })
                : ''}
              {result.hasMore ? tu(' · 更多结果未展示') : ''}
            </span>
          </div>
          {result.warnings.map((warning) => (
            <p className={styles.notice} key={warning}>
              {uiText(warning, locale)}
            </p>
          ))}
          <pre className={styles.json}>
            {result.value
              ? formatJsonSource(result.value, 2)
              : `[\n${result.documents.map((document) => formatJsonSource(document, 2)).join(',\n')}\n]`}
          </pre>
        </div>
      )}
    </div>
  );
}
