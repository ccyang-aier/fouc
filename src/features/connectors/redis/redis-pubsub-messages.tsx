'use client';
import { useTranslation } from '@/lib/i18n';
import type { RedisPubSubMessage } from '@fouc/shared';
import { Copy, MagnifyingGlass, Trash, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import common from '../datastore/relational.module.css';
import { createUiMessages, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-pubsub-messages';
import { redisPubSubSearch } from './redis-pubsub-model';
import styles from './redis-pubsub.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function RedisPubSubMessages({
  messages,
  dropped,
  onClear,
}: {
  messages: RedisPubSubMessage[];
  dropped: number;
  onClear: () => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [filter, setFilter] = useState(''),
    [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<RedisPubSubMessage | null>(null);
  const [feedback, setFeedback] = useState<UiMessage>('');
  const viewport = useRef<HTMLDivElement>(null);
  const entries = messages.filter((entry) => redisPubSubSearch(entry, filter));
  useEffect(() => {
    if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [messages, filter, follow]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
      setFeedback(uiMessage('已复制当前筛选的消息 JSON'));
    } catch {
      setFeedback(uiMessage('复制失败，请打开消息详情后选择内容复制。'));
    }
  }
  return (
    <section className={styles.messages} aria-label={tu('Pub/Sub 消息')}>
      <div className={styles.messageToolbar}>
        <strong>
          {tu('消息 ·')} {messages.length}
        </strong>
        <label className={styles.search}>
          <MagnifyingGlass size={13} />
          <input
            aria-label={tu('筛选 Pub/Sub 消息')}
            value={filter}
            placeholder={tu('频道、模式或消息')}
            onChange={(event) => {
              setFilter(event.target.value);
              setFeedback('');
            }}
          />
        </label>
        <label className={styles.follow}>
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => setFollow(event.target.checked)}
          />
          {tu('跟随')}
        </label>
        <button
          type="button"
          aria-label={tu('复制 Pub/Sub 消息 JSON')}
          disabled={!entries.length}
          onClick={() => void copy()}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          aria-label={tu('清空 Pub/Sub 消息')}
          disabled={!messages.length}
          onClick={() => {
            onClear();
            setFeedback('');
            setSelected(null);
          }}
        >
          <Trash size={13} />
        </button>
      </div>
      {feedback && (
        <p role="status" className={styles.notice}>
          {uiText(feedback, locale)}
        </p>
      )}
      <div
        ref={viewport}
        className={styles.messageList}
        tabIndex={0}
        aria-label={tu('Pub/Sub 实时消息列表')}
      >
        {entries.map((entry) => (
          <button
            type="button"
            key={`${entry.captureId}:${entry.sequence}`}
            className={styles.message}
            aria-label={tu('打开 Pub/Sub 消息 {v0}', { v0: String(entry.sequence) })}
            onClick={() => setSelected(entry)}
          >
            <header>
              <time>{new Date(entry.receivedAt).toLocaleTimeString(locale)}</time>
              <strong title={entry.channel.display}>
                {entry.channel.display || tu('（空频道）')}
              </strong>
              <span>{entry.pattern === null ? tu('频道') : tu('模式')}</span>
            </header>
            {entry.pattern !== null && (
              <small title={entry.pattern.display}>
                {tu('匹配')} {entry.pattern.display || tu('（空模式）')}
              </small>
            )}
            <pre>
              {entry.payload.display.slice(0, 1800) || tu('（零字节消息）')}
              {entry.payload.display.length > 1800 && '…'}
            </pre>
            {(entry.channel.truncated || entry.pattern?.truncated || entry.payload.truncated) && (
              <em>{tu('内容已截断，详情显示原始长度。')}</em>
            )}
          </button>
        ))}
        {!entries.length && (
          <p className={styles.empty}>
            {messages.length ? tu('没有匹配的消息。') : tu('等待订阅频道收到消息…')}
          </p>
        )}
      </div>
      <footer>
        {tu('最近最多 500 条 / 2 MiB · 单项读取最多 64 KiB')}
        {dropped > 0 && (
          <strong>
            {' '}
            {tu('· 传输缓冲丢弃')} {dropped} {tu('条，记录不完整')}
          </strong>
        )}
      </footer>
      {selected && <MessageDetail entry={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
function MessageDetail({ entry, onClose }: { entry: RedisPubSubMessage; onClose: () => void }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const dialog = useRef<HTMLDialogElement>(null),
    [feedback, setFeedback] = useState<UiMessage>('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function copy(text: string, name: UiMessage) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(uiMessage('已复制{v0}', { v0: name }));
    } catch {
      setFeedback(uiMessage('复制失败，请选择内容复制。'));
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`${common.dialog} ${styles.dialog}`}
      aria-labelledby="pubsub-message-title"
      onCancel={onClose}
    >
      <header className={common.dialogHead}>
        <div>
          <strong id="pubsub-message-title">
            {tu('Pub/Sub 消息 #')}
            {entry.sequence}
          </strong>
        </div>
        <button type="button" aria-label={tu('关闭 Pub/Sub 消息')} onClick={onClose}>
          <X size={17} />
        </button>
      </header>
      <div className={styles.detail}>
        <small>
          {tu('接收时间')} {new Date(entry.receivedAt).toLocaleString(locale)} ·{' '}
          {entry.pattern === null ? tu('频道订阅') : tu('模式订阅')}
        </small>
        {(
          [
            ['频道', entry.channel],
            ['模式', entry.pattern],
            ['消息', entry.payload],
          ] as const
        ).map(
          ([name, blob]) =>
            blob !== null && (
              <section key={name}>
                <header>
                  <strong>
                    {tu(name)} · {blob.byteLength} {tu('字节')}
                    {blob.truncated && tu(' · 已截断')}
                  </strong>
                  <button
                    type="button"
                    aria-label={tu('复制 Pub/Sub {v0} Base64', { v0: tu(name) })}
                    onClick={() =>
                      void copy(blob.rawBase64, uiMessage('{v0} Base64', { v0: uiMessage(name) }))
                    }
                  >
                    <Copy size={13} />
                    Base64
                  </button>
                </header>
                <pre>{blob.display || tu('（零字节）')}</pre>
              </section>
            ),
        )}
        {feedback && <p role="status">{uiText(feedback, locale)}</p>}
      </div>
      <footer className={common.dialogFooter}>
        <button
          type="button"
          className={common.secondary}
          onClick={() => void copy(JSON.stringify(entry, null, 2), uiMessage('消息 JSON'))}
        >
          {tu('复制消息 JSON')}
        </button>
        <span />
        <button type="button" className={common.primary} onClick={onClose}>
          {tu('完成')}
        </button>
      </footer>
    </dialog>
  );
}
