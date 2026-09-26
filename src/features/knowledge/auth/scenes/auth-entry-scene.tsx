'use client';

/**
 * `/auth` entry scene (A04): sign-in / sign-up card plus configured SSO
 * entrances. The post-login target (`returnTo`) is resolved once from the URL
 * (sanitized) or sessionStorage and persisted again before any top-level
 * OAuth jump, so both the email and the SSO path restore the same target.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { resolveAuthReturnTo, saveAuthReturnTo } from '../return-to';
import { AuthPanel, AuthPanelHeading, AuthScene } from '../components/auth-scene';
import { AuthStatusMessage } from '../components/auth-status';
import { OAuthProviderSection } from '../components/oauth-provider-list';
import { SignInForm } from '../components/sign-in-form';
import { SignUpForm } from '../components/sign-up-form';

type EntryMode = 'sign-in' | 'sign-up';

const reasonCopy = {
  expired: { title: '登录已过期', description: '会话不再有效,请重新登录;完成后会回到之前的页面。' },
  'signed-out': { title: '已退出登录', description: '期待你再次回来。' },
} as const;

export function AuthEntryScene() {
  const params = useSearchParams();
  const [mode, setMode] = useState<EntryMode>(() => (params.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'));
  const reason = params.get('reason');

  const targetPath = useMemo(
    () => resolveAuthReturnTo(params.get('returnTo'), typeof window === 'undefined' ? null : window.sessionStorage),
    [params],
  );

  // The OAuth round-trip leaves the document; keep the target in
  // sessionStorage so the callback page can restore it after returning.
  const persistTarget = useCallback(() => {
    if (typeof window !== 'undefined') saveAuthReturnTo(window.sessionStorage, targetPath);
  }, [targetPath]);

  // Esc cancels the sign-up form back to sign-in (keyboard cancel semantics).
  useEffect(() => {
    if (mode !== 'sign-up') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode('sign-in');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const notice = reason === 'expired' || reason === 'signed-out' ? reasonCopy[reason] : null;

  return (
    <AuthScene aria-label="Fouc 登录">
      <AuthPanel aria-label="账号登录">
        {notice ? (
          <div className="mb-4">
            <AuthStatusMessage tone="info" title={notice.title} description={notice.description} />
          </div>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'sign-up' ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'sign-up' ? -10 : 10 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {mode === 'sign-in' ? (
              <>
                <AuthPanelHeading title="登录 Fouc" description="使用邮箱与密码,或通过企业账号继续。" />
                <SignInForm targetPath={targetPath} />
              </>
            ) : (
              <>
                <AuthPanelHeading title="创建账号" description="注册后通过验证邮件激活,即可登录使用。" />
                <SignUpForm />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <OAuthProviderSection onBeforeNavigate={persistTarget} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-1 text-[11.5px] text-[var(--muted-strong)]">
          {mode === 'sign-in' ? (
            <>
              <span>还没有账号?</span>
              <button
                type="button"
                onClick={() => setMode('sign-up')}
                className="rounded-[5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
              >
                创建账号
              </button>
            </>
          ) : (
            <>
              <span>已有账号?</span>
              <button
                type="button"
                onClick={() => setMode('sign-in')}
                className="rounded-[5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
              >
                直接登录
              </button>
            </>
          )}
        </div>
      </AuthPanel>
    </AuthScene>
  );
}
