'use client';

/**
 * `/auth/verify` — email-verification landing (A04). The verification link
 * bounces through the API's `/api/auth/verify-email` back here: success
 * arrives as `?status=verified` (no session is created — A01), failures as
 * `?error=TOKEN_EXPIRED|INVALID_TOKEN|USER_NOT_FOUND|INVALID_USER`. Expired
 * and used links offer a cooldown-gated resend; verification itself never
 * signs the user in.
 */

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignIn } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { parseVerifyEmailQuery, verifyEmailErrorCopy } from '../verify-callback';
import { readAuthPendingEmail } from '../return-to';
import { authEntryPath } from '../session';
import { AuthPanel, AuthPanelHeading, AuthScene } from '../components/auth-scene';
import { AuthStatusMessage } from '../components/auth-status';
import { ResendVerificationEntry } from '../components/resend-verification';

export function VerifyEmailScene() {
  const router = useRouter();
  const params = useSearchParams();
  const view = useMemo(() => parseVerifyEmailQuery(params.toString()), [params]);
  const pendingEmail = useMemo(
    () => (typeof window === 'undefined' ? null : readAuthPendingEmail(window.sessionStorage)),
    [],
  );

  if (view.kind === 'verified') {
    return (
      <AuthScene aria-label="邮箱验证完成" width={380}>
        <AuthPanel>
          <AuthStatusMessage
            tone="success"
            title="邮箱验证成功"
            description="你的邮箱已完成验证。验证不会自动登录,请使用邮箱与密码登录后继续。"
          />
          <Button type="button" className="mt-5 h-9 w-full" onClick={() => router.push(authEntryPath)}>
            <SignIn className="size-4" weight="bold" aria-hidden />
            前往登录
          </Button>
        </AuthPanel>
      </AuthScene>
    );
  }

  if (view.kind === 'error') {
    const copy = verifyEmailErrorCopy(view.code);
    return (
      <AuthScene aria-label="邮箱验证未完成" width={420}>
        <AuthPanel>
          <AuthPanelHeading title="邮箱验证" />
          <AuthStatusMessage tone={copy.resend ? 'warning' : 'error'} title={copy.title} description={copy.description} />
          {copy.resend ? (
            <div className="mt-4">
              <ResendVerificationEntry initialEmail={pendingEmail ?? ''} />
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="mt-4 self-start" onClick={() => router.push(authEntryPath)}>
            返回登录
          </Button>
        </AuthPanel>
      </AuthScene>
    );
  }

  return (
    <AuthScene aria-label="邮箱验证指引" width={420}>
      <AuthPanel>
        <AuthPanelHeading
          title="完成邮箱验证"
          description="请打开注册时收到的验证邮件,点击其中的链接完成验证;链接在发送后 1 小时内有效。"
        />
        <ResendVerificationEntry initialEmail={pendingEmail ?? ''} />
        <Button type="button" variant="ghost" size="sm" className="mt-4 self-start" onClick={() => router.push(authEntryPath)}>
          返回登录
        </Button>
      </AuthPanel>
    </AuthScene>
  );
}
