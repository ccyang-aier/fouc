'use client';

/**
 * Email/password sign-in (A04). Client validation gates obvious input errors;
 * server failures normalize to the domain error whose fixed copy never
 * distinguishes "unknown user" from "wrong password". `EMAIL_NOT_VERIFIED`
 * switches to a resend sub-state instead of a plain error.
 */

import { useState, type FormEvent } from 'react';
import { useIdentity } from '../identity-provider';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { authErrorCopyFor, isFoucAuthFlowError } from '../auth-errors';
import { foucAuthApi, type FoucAuthApi } from '../auth-api';
import { hasAuthFieldErrors, validateSignInForm, type AuthFieldErrors } from '../validation';
import { AuthTextField } from './auth-field';
import { AppAlert } from '@/components/app-alert';
import { ResendVerificationEntry } from './resend-verification';
import styles from './auth-form.module.css';

export function SignInForm({
  targetPath,
  onSuccess,
  submitLabel = '登录',
  api = foucAuthApi,
}: {
  targetPath: string;
  onSuccess?: () => void;
  submitLabel?: string;
  api?: FoucAuthApi;
}) {
  const router = useRouter();
  const identity = useIdentity();
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
      await identity.completeSignIn();
      if (onSuccess) onSuccess();
      else router.replace(targetPath);
    } catch (cause) {
      setSubmitting(false);
      if (isFoucAuthFlowError(cause) && cause.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email.trim());
        return;
      }
      setBanner(authErrorCopyFor(cause));
    }
  }

  if (unverifiedEmail !== null) {
    return (
      <div className="flex flex-col gap-4">
        <AppAlert
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
    <form noValidate onSubmit={submit} className={styles.form} aria-label="邮箱登录">
      <AuthTextField
        label="邮箱"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@company.com"
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
        placeholder="输入你的密码"
        value={password}
        onChange={(value) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
        error={fieldErrors.password ?? null}
        disabled={submitting}
      />
      {banner ? <AppAlert tone="error" title={banner.title} description={banner.description} /> : null}
      <Button type="submit" loading={submitting} className={styles.submit}>
        {submitting ? '正在登录…' : submitLabel}
        {!submitting ? <ArrowRight size={15} data-arrow aria-hidden /> : null}
      </Button>
    </form>
  );
}
