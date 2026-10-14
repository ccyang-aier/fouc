'use client';

import { useTranslation } from '@/lib/i18n';
import type { RedisPubSubAction } from '@fouc/shared';
import { Broadcast, PaperPlaneTilt, Plug, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-pubsub';
import { RedisByteField } from './redis-byte-field';
import { draftToBytes, type RedisByteDraft } from './redis-mutation-model';
import { RedisPubSubMessages } from './redis-pubsub-messages';
import { RedisPubSubPublish } from './redis-pubsub-publish';
import styles from './redis-pubsub.module.css';
import { useRedisPubSub } from './use-redis-pubsub';
const { error: uiError } = createUiMessages(unitMessages);

export function RedisPubSubView({
  base,
  readOnly,
  onBusyChange,
}: {
  base: string;
  readOnly: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const pubsub = useRedisPubSub(base);
  const [channel, setChannel] = useState<RedisByteDraft>({ encoding: 'text', text: '' }),
    [pattern, setPattern] = useState<RedisByteDraft>({ encoding: 'text', text: '' });
  const [inputError, setInputError] = useState<UiMessage>(''),
    [published, setPublished] = useState(''),
    [publisher, setPublisher] = useState(false);
  const connected = pubsub.state.status === 'connected',
    connecting = pubsub.state.status === 'connecting';
  async function subscribe(kind: RedisPubSubAction) {
    try {
      const raw = draftToBytes(kind === 'subscribe' ? channel : pattern);
      if (atob(raw).length > 65536) throw uiError('频道或模式名称最多 64 KiB。');
      setInputError('');
      if (await pubsub.change(kind, raw)) {
        if (kind === 'subscribe') setChannel({ encoding: 'text', text: '' });
        else setPattern({ encoding: 'text', text: '' });
      }
    } catch (reason) {
      setInputError(uiFailure(reason));
    }
  }
  return (
    <section className={styles.panel} aria-label={tu('Redis Pub/Sub')}>
      <header className={styles.header}>
        <Broadcast size={17} />
        <strong>Pub/Sub</strong>
        <span data-connected={connected} role="status">
          {connected
            ? tu('已连接 · {v0} 个订阅', {
                v0: String(pubsub.state.subscriptions.subscriptionCount),
              })
            : connecting
              ? tu('连接与恢复订阅中…')
              : pubsub.state.status === 'failed'
                ? tu('连接失败')
                : tu('未连接')}
        </span>
        <button
          type="button"
          aria-label={connected || connecting ? tu('断开 Pub/Sub') : tu('连接 Pub/Sub')}
          onClick={() => {
            if (connected || connecting) pubsub.disconnect();
            else void pubsub.connect();
          }}
        >
          <Plug size={13} />
          {connected || connecting ? tu('断开') : tu('连接')}
        </button>
      </header>
      <p className={styles.notice}>
        {tu(
          '频道跨 DB 共享；频道和模式同时匹配会保留两条投递。断开期间的消息不会补发，关闭视图会释放订阅连接。',
        )}
      </p>
      {pubsub.state.error && (
        <p role="alert" className={styles.error}>
          {uiText(pubsub.state.error, locale)} {tu('· 已保留消息和上次订阅，可重新连接。')}
        </p>
      )}
      {(inputError || pubsub.actionError) && (
        <p role="alert" className={styles.error}>
          {uiText(inputError || pubsub.actionError, locale)}
        </p>
      )}
      <div className={styles.subscriptions}>
        {(['channels', 'patterns'] as const).map((key) => (
          <section key={key} aria-label={key === 'channels' ? tu('频道订阅') : tu('模式订阅')}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void subscribe(key === 'channels' ? 'subscribe' : 'psubscribe');
              }}
            >
              <RedisByteField
                label={key === 'channels' ? tu('订阅频道') : tu('订阅模式')}
                value={key === 'channels' ? channel : pattern}
                onChange={key === 'channels' ? setChannel : setPattern}
              />
              <button type="submit" disabled={!connected || pubsub.actionBusy}>
                {pubsub.actionBusy
                  ? tu('处理中…')
                  : key === 'channels'
                    ? tu('订阅')
                    : tu('订阅模式')}
              </button>
            </form>
            <div className={styles.tags} data-connected={connected}>
              {pubsub.state.subscriptions[key].map((name) => (
                <span key={name.rawBase64}>
                  <code title={name.display}>{name.display || tu('（空名称）')}</code>
                  <button
                    type="button"
                    disabled={connecting || pubsub.actionBusy}
                    aria-label={tu('取消{v0}订阅 {v1}', {
                      v0: String(key === 'channels' ? '频道' : '模式'),
                      v1: String(name.display || '（空名称）'),
                    })}
                    onClick={() =>
                      void pubsub.change(
                        key === 'channels' ? 'unsubscribe' : 'punsubscribe',
                        name.rawBase64,
                      )
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      <RedisPubSubMessages
        messages={pubsub.state.messages}
        dropped={pubsub.state.dropped}
        onClear={pubsub.clearMessages}
      />
      <footer className={styles.publishFooter}>
        <span role="status">
          {published ||
            (readOnly ? '发布消息需先解锁当前会话写入' : '发布时预览完整频道与消息字节')}
        </span>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            setPublished('');
            setPublisher(true);
          }}
        >
          <PaperPlaneTilt size={13} />
          {tu('发布消息')}
        </button>
      </footer>
      {publisher && (
        <RedisPubSubPublish
          base={base}
          readOnly={readOnly}
          onBusyChange={onBusyChange}
          onClose={() => setPublisher(false)}
          onPublished={(result) => setPublished(`已发布 · Redis 接收计数 ${result.receivers}`)}
        />
      )}
    </section>
  );
}
