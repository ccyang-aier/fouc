'use client';

/**
 * Configured SSO entrances (A04). `GET /api/auth/oauth/providers` returns the
 * admin-configured `{id,name,kind}[]` — an entrance list, not a health
 * check. Clicking a provider asks `POST /api/auth/sign-in/social` for the
 * authorization URL and performs a top-level navigation to it (tokens never
 * touch the page); the IdP later returns to `/auth/callback`.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise, CircleNotch, Fingerprint } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { authErrorCopyFor } from '../auth-errors';
import { foucAuthApi, type FoucOAuthProvider } from '../auth-api';
import { AuthStatusMessage } from './auth-status';

type ProvidersState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; providers: FoucOAuthProvider[] };

export function OAuthProviderSection({
  onBeforeNavigate,
  api = foucAuthApi,
}: {
  /** Persists the post-login target before the top-level jump to the IdP. */
  onBeforeNavigate?: () => void;
  api?: typeof foucAuthApi;
}) {
  const [state, setState] = useState<ProvidersState>({ phase: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const seq = ++requestSeq.current;
    api.listOAuthProviders(controller.signal).then(
      (providers) => {
        if (seq === requestSeq.current) setState({ phase: 'ready', providers });
      },
      (cause) => {
        if (controller.signal.aborted || seq !== requestSeq.current) return;
        setState({ phase: 'error', message: authErrorCopyFor(cause).description });
      },
    );
    return () => controller.abort();
  }, [api, reloadToken]);

  async function startSignIn(provider: FoucOAuthProvider) {
    if (startingId) return;
    setStartError(null);
    setStartingId(provider.id);
    onBeforeNavigate?.();
    try {
      const callbackBase = typeof window === 'undefined' ? '' : new URL('/auth/callback', window.location.origin).origin;
      const callbackURL = `${callbackBase}/auth/callback?status=ok`;
      const errorCallbackURL = `${callbackBase}/auth/callback`;
      const { url } = await api.startSocialSignIn({ provider: provider.id, callbackURL, errorCallbackURL });
      window.location.assign(url);
    } catch (cause) {
      setStartingId(null);
      setStartError(authErrorCopyFor(cause).description);
    }
  }

  if (state.phase === 'ready' && state.providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3.5" aria-label="企业单点登录">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[10.5px] font-medium tracking-[0.06em] text-[var(--muted)]">或使用企业账号</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      {state.phase === 'loading' ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="正在加载登录方式">
          {[0, 1].map((index) => (
            <div key={index} className="h-10 animate-pulse rounded-[8px] border border-[var(--line)] bg-[var(--surface-subtle)]" />
          ))}
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <AuthStatusMessage
          tone="error"
          title="企业登录暂不可用"
          description={state.message}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => { setState({ phase: 'loading' }); setReloadToken((token) => token + 1); }}>
              <ArrowClockwise className="size-3.5" aria-hidden />
              重试
            </Button>
          }
        />
      ) : null}

      {state.phase === 'ready' ? (
        <div className="flex flex-col gap-2">
          {state.providers.map((provider) => {
            const starting = startingId === provider.id;
            return (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                disabled={startingId !== null}
                aria-busy={starting}
                onClick={() => void startSignIn(provider)}
                className="h-10 w-full justify-start gap-2.5 px-3 font-normal"
              >
                {starting ? (
                  <CircleNotch className="size-4 shrink-0 animate-spin text-[var(--muted-strong)]" aria-hidden />
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--accent-soft)]">
                    <Fingerprint className="size-[15px] text-[var(--accent-ink)]" weight="duotone" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-left text-[12.5px] text-[var(--ink)]">
                  {starting ? '正在跳转…' : `通过 ${provider.name} 继续`}
                </span>
                <span className="shrink-0 rounded-[4px] border border-[var(--line)] bg-[var(--surface-subtle)] px-1.5 py-px text-[9.5px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                  {provider.kind === 'oidc' ? 'OIDC' : 'OAuth'}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}

      {startError ? (
        <p role="alert" className="text-[11px] leading-4 text-[var(--err-ink)]">
          {startError}
        </p>
      ) : null}
    </div>
  );
}
