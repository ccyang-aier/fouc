'use client';

/**
 * Verification-email resend entry (A04). Shared by the sign-up acceptance
 * state, the `EMAIL_NOT_VERIFIED` sign-in error and the verify-email landing.
 * A 60-second client cooldown keeps honest users under the backend's 5/min
 * resend limit; a server 429 still renders the fixed boundary copy. Sending
 * is always "accepted" — the API is anti-enumeration and never promises
 * delivery for unknown or already-verified addresses.
 */

import { verificationCallbackUrl } from '../verification-url';
import { useEffect, useMemo, useState } from 'react';
import { CircleNotch, PaperPlaneTilt } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { authErrorCopyFor, isFoucAuthFlowError } from '../auth-errors';
import { foucAuthApi, type FoucAuthApi } from '../auth-api';
import { isResendAvailable, resendCooldownRemaining, startResendCooldown, type ResendCooldownState } from '../resend-cooldown';
import { AuthTextField } from './auth-field';
import { AuthStatusMessage } from './auth-status';

export function ResendVerificationEntry({
  initialEmail = '',
  compact = false,
  api = foucAuthApi,
}: {
  initialEmail?: string;
  /** Compact renders without the bordered box (embedded in another panel). */
  compact?: boolean;
  api?: FoucAuthApi;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<ResendCooldownState>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'error' | 'warning'; title: string; description: string } | null>(null);

  useEffect(() => {
    if (cooldown === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const remainingSeconds = useMemo(() => resendCooldownRemaining(cooldown, now), [cooldown, now]);

  async function resend() {
    if (sending || (cooldown !== null && !isResendAvailable(cooldown, Date.now()))) return;
    const candidate = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      setEmailError('请输入邮箱地址');
      return;
    }
    setEmailError(null);
    setSending(true);
    setOutcome(null);
    try {
      await api.sendVerificationEmail({ email: candidate, callbackURL: verificationCallbackUrl() });
      setOutcome({
        tone: 'success',
        title: '发送请求已受理',
        description: '如该邮箱已注册且尚未验证,将收到新的验证邮件;未收到请稍后再试或检查垃圾箱。',
      });
      setCooldown(startResendCooldown());
    } catch (cause) {
      const copy = authErrorCopyFor(cause);
      const tone = isFoucAuthFlowError(cause) && cause.code === 'RATE_LIMITED' ? 'warning' : 'error';
      setOutcome({ tone, title: copy.title, description: copy.description });
    } finally {
      setSending(false);
    }
  }

  const body = (
    <div className="flex flex-col gap-3">
      <AuthTextField
        label="邮箱地址"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@example.com"
        value={email}
        onChange={(value) => setEmail(value)}
        error={emailError}
        disabled={sending}
      />
      <Button type="button" variant="outline" size="sm" className="h-8 self-start" disabled={sending || remainingSeconds > 0} onClick={() => void resend()}>
        {sending ? <CircleNotch className="size-3.5 animate-spin" aria-hidden /> : <PaperPlaneTilt className="size-3.5" weight="fill" aria-hidden />}
        {remainingSeconds > 0 ? `重新发送(${remainingSeconds}s)` : '重新发送验证邮件'}
      </Button>
      {outcome ? <AuthStatusMessage tone={outcome.tone} title={outcome.title} description={outcome.description} /> : null}
    </div>
  );

  if (compact) return body;
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] p-4">{body}</div>
  );
}
