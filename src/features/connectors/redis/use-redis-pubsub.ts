'use client';

import { backendFetch } from '@/lib/backend';
import type { RedisPubSubAction, RedisPubSubMessage, RedisPubSubSubscriptions } from '@fouc/shared';
import { useEffect, useRef, useState } from 'react';
import { createUiMessages, uiFailure, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/use-redis-pubsub';
import { readRedisFrames } from './redis-live-stream';
import { redisPubSubFrame, redisPubSubMessages } from './redis-pubsub-model';
const { message: uiMessage, error: uiError } = createUiMessages(unitMessages);

const emptySubscriptions = (): RedisPubSubSubscriptions => ({
  channels: [],
  patterns: [],
  subscriptionCount: '0',
});
interface State {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  subscriptions: RedisPubSubSubscriptions;
  messages: RedisPubSubMessage[];
  dropped: number;
  error: UiMessage;
}
export function useRedisPubSub(base: string) {
  const [state, setState] = useState<State>({
    status: 'disconnected',
    subscriptions: emptySubscriptions(),
    messages: [],
    dropped: 0,
    error: '',
  });
  const [actionBusy, setActionBusy] = useState(false),
    [actionError, setActionError] = useState<UiMessage>('');
  const active = useRef<{ controller: AbortController; id: string | null } | null>(null);
  const desired = useRef<RedisPubSubSubscriptions>(emptySubscriptions());
  useEffect(
    () => () => {
      active.current?.controller.abort();
      active.current = null;
    },
    [base],
  );
  function disconnect() {
    active.current?.controller.abort();
    active.current = null;
    setActionBusy(false);
    setState((current) => ({ ...current, status: 'disconnected' }));
  }
  async function connect() {
    if (active.current) return;
    const operation = { controller: new AbortController(), id: null as string | null };
    active.current = operation;
    setActionError('');
    setState((current) => ({ ...current, status: 'connecting', error: '' }));
    try {
      await readRedisFrames(
        `${base}/pubsub`,
        operation.controller.signal,
        redisPubSubFrame,
        async (frame) => {
          if (operation.controller.signal.aborted || active.current !== operation) return;
          if (frame.type === 'error') throw new Error(frame.message);
          if (frame.type === 'ready') {
            operation.id = frame.captureId;
            let snapshot = emptySubscriptions();
            for (const [kind, names] of [
              ['subscribe', desired.current.channels],
              ['psubscribe', desired.current.patterns],
            ] as const) {
              for (let offset = 0; offset < names.length; offset += 100)
                snapshot = await backendFetch<RedisPubSubSubscriptions>(
                  `${base}/pubsub/${operation.id}/subscriptions`,
                  {
                    method: 'POST',
                    signal: operation.controller.signal,
                    body: JSON.stringify({
                      kind,
                      names: names.slice(offset, offset + 100).map((name) => name.rawBase64),
                    }),
                  },
                );
            }
            if (active.current === operation && !operation.controller.signal.aborted) {
              desired.current = snapshot;
              setState((current) => ({ ...current, status: 'connected', subscriptions: snapshot }));
            }
          } else {
            if (frame.entries.some((entry) => entry.captureId !== operation.id))
              throw uiError('Pub/Sub 消息所属连接不一致');
            setState((current) => ({
              ...current,
              messages: redisPubSubMessages(current.messages, frame.entries),
              dropped: current.dropped + frame.dropped,
            }));
          }
        },
      );
    } catch (reason) {
      if (!operation.controller.signal.aborted && active.current === operation)
        setState((current) => ({
          ...current,
          status: 'failed',
          error: uiFailure(reason),
        }));
    } finally {
      if (active.current === operation) {
        operation.controller.abort();
        active.current = null;
        setActionBusy(false);
      }
    }
  }
  async function change(kind: RedisPubSubAction, name: string): Promise<boolean> {
    const operation = active.current;
    if (!operation?.id) {
      if (kind === 'unsubscribe' || kind === 'punsubscribe') {
        const key = kind === 'unsubscribe' ? 'channels' : 'patterns';
        const next = {
          ...desired.current,
          [key]: desired.current[key].filter((item) => item.rawBase64 !== name),
        };
        next.subscriptionCount = String(next.channels.length + next.patterns.length);
        desired.current = next;
        setState((current) => ({ ...current, subscriptions: next }));
        return true;
      }
      setActionError(uiMessage('请先连接 Pub/Sub'));
      return false;
    }
    setActionBusy(true);
    setActionError('');
    try {
      const snapshot = await backendFetch<RedisPubSubSubscriptions>(
        `${base}/pubsub/${operation.id}/subscriptions`,
        {
          method: 'POST',
          signal: operation.controller.signal,
          body: JSON.stringify({ kind, names: [name] }),
        },
      );
      if (active.current === operation && !operation.controller.signal.aborted) {
        desired.current = snapshot;
        setState((current) => ({ ...current, subscriptions: snapshot }));
        return true;
      }
    } catch (reason) {
      if (active.current === operation && !operation.controller.signal.aborted) {
        setActionError(uiFailure(reason));
        // Batch restore may have accepted earlier names; always display acknowledged state.
        const snapshot = await backendFetch<RedisPubSubSubscriptions>(
          `${base}/pubsub/${operation.id}/subscriptions`,
          { signal: operation.controller.signal },
        ).catch(() => null);
        if (snapshot && active.current === operation && !operation.controller.signal.aborted) {
          desired.current = snapshot;
          setState((current) => ({ ...current, subscriptions: snapshot }));
        }
      }
    } finally {
      if (active.current === operation) setActionBusy(false);
    }
    return false;
  }
  function clearMessages() {
    setState((current) => ({ ...current, messages: [], dropped: 0 }));
  }
  return { state, actionBusy, actionError, connect, disconnect, change, clearMessages };
}
