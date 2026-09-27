'use client';

/**
 * Registration (A04). The backend accepts sign-up uniformly (anti-
 * enumeration) and never promises email delivery, so the acceptance copy is
 * exactly the A01 wording: 注册请求已受理,请查收验证邮件;未收到可重发。
 */

import { verificationCallbackUrl } from '../verification-url';
import { useState, type FormEvent } from 'react';
import { CircleNotch, PaperPlaneTilt } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { authErrorCopyFor } from '../auth-errors';
import { foucAuthApi, type FoucAuthApi } from '../auth-api';
import { authPendingEmailStorageKey } from '../return-to';
import { hasAuthFieldErrors, validateSignUpForm, type AuthFieldErrors } from '../validation';
import { AuthTextField } from './auth-field';
import { AuthStatusMessage } from './auth-status';
import { ResendVerificationEntry } from './resend-verification';

export function SignUpForm({ api = foucAuthApi }: { api?: FoucAuthApi }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [banner, setBanner] = useState<{ title: string; description: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const errors = validateSignUpForm({ name, email, password });
    setFieldErrors(errors);
    setBanner(null);
    if (hasAuthFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      await api.signUpWithEmail({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: verificationCallbackUrl(),
      });
      try {
        window.sessionStorage.setItem(authPendingEmailStorageKey, email.trim().toLowerCase());
      } catch {
        // Resend also accepts manual input; storage is a convenience only.
      }
      setAcceptedEmail(email.trim());
    } catch (cause) {
      setBanner(authErrorCopyFor(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (acceptedEmail !== null) {
    return (
      <div className="flex flex-col gap-4">
        <AuthStatusMessage
          tone="success"
          title="注册请求已受理"
          description="请查收验证邮件;未收到可重发。"
        />
        <ResendVerificationEntry initialEmail={acceptedEmail} />
        <p className="text-[11px] leading-5 text-[var(--muted)]">
          验证邮件中的链接 1 小时内有效;完成验证后即可使用邮箱登录。
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3.5" aria-label="注册账号">
      <AuthTextField
        label="名称"
        autoComplete="name"
        placeholder="你的名称"
        value={name}
        onChange={(value) => { setName(value); setFieldErrors((current) => ({ ...current, name: undefined })); }}
        error={fieldErrors.name ?? null}
        disabled={submitting}
        maxLength={121}
      />
      <AuthTextField
        label="邮箱"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@example.com"
        value={email}
        onChange={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
        error={fieldErrors.email ?? null}
        disabled={submitting}
      />
      <AuthTextField
        label="密码"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(value) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
        error={fieldErrors.password ?? null}
        hint="12–128 位,建议混合字母、数字与符号"
        disabled={submitting}
      />
      {banner ? <AuthStatusMessage tone="error" title={banner.title} description={banner.description} /> : null}
      <Button type="submit" disabled={submitting} className="mt-1 h-9 w-full" aria-busy={submitting}>
        {submitting ? <CircleNotch className="size-4 animate-spin" aria-hidden /> : <PaperPlaneTilt className="size-4" weight="fill" aria-hidden />}
        {submitting ? '正在提交…' : '创建账号'}
      </Button>
    </form>
  );
}
