'use client';

/**
 * Email/password sign-in (A04). Client validation gates obvious input errors;
 * server failures normalize to the domain error whose fixed copy never
 * distinguishes "unknown user" from "wrong password". `EMAIL_NOT_VERIFIED`
 * switches to a resend sub-state instead of a plain error.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CircleNotch, SignIn } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { authErrorCopyFor, isKnowledgeAuthFlowError } from '../auth-errors';
import { knowledgeAuthApi, type KnowledgeAuthApi } from '../auth-api';
import { hasAuthFieldErrors, validateSignInForm, type AuthFieldErrors } from '../validation';
import { AuthTextField } from './auth-field';
import { AuthStatusMessage } from './auth-status';
import { ResendVerificationEntry } from './resend-verification';

export function SignInForm({
  targetPath,
  api = knowledgeAuthApi,
}: {
  targetPath: string;
  api?: KnowledgeAuthApi;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [banner, setBanner] = useState<{ title: string; description: string } | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const errors = validateSignInForm({ email, password });
    setFieldErrors(errors);
    setBanner(null);
    if (hasAuthFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      await api.signInWithPassword({ email: email.trim(), password });
      router.push(targetPath);
    } catch (cause) {
      setSubmitting(false);
      if (isKnowledgeAuthFlowError(cause) && cause.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email.trim());
        return;
      }
      setBanner(authErrorCopyFor(cause));
    }
  }

  if (unverifiedEmail !== null) {
    return (
      <div className="flex flex-col gap-4">
        <AuthStatusMessage
          tone="warning"
          title="邮箱尚未验证"
          description="该邮箱已注册但尚未完成验证。请查收验证邮件并打开其中的链接;未收到可重新发送。"
        />
        <ResendVerificationEntry initialEmail={unverifiedEmail} />
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => { setUnverifiedEmail(null); setPassword(''); }}>
          <ArrowLeft className="size-3.5" aria-hidden />
          返回登录
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3.5" aria-label="邮箱登录">
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
        autoFocus
      />
      <AuthTextField
        label="密码"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(value) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
        error={fieldErrors.password ?? null}
        disabled={submitting}
      />
      {banner ? <AuthStatusMessage tone="error" title={banner.title} description={banner.description} /> : null}
      <Button type="submit" disabled={submitting} className="mt-1 h-9 w-full" aria-busy={submitting}>
        {submitting ? <CircleNotch className="size-4 animate-spin" aria-hidden /> : <SignIn className="size-4" weight="bold" aria-hidden />}
        {submitting ? '正在登录…' : '登录'}
      </Button>
    </form>
  );
}
