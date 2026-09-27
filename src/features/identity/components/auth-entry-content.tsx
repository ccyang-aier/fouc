'use client';

import { useState } from 'react';
import { AuthBrandLockup, AuthPanelHeading } from './auth-scene';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';
import { OAuthProviderSection } from './oauth-provider-list';
import { saveAuthReturnTo } from '../return-to';

export function AuthEntryContent({ initialMode = 'sign-in', targetPath = '/', onSuccess, showBrand = true }: { showBrand?: boolean; initialMode?: 'sign-in' | 'sign-up'; targetPath?: string; onSuccess?: () => void }) {
  const [mode, setMode] = useState(initialMode);
  return <>
    {showBrand ? <AuthBrandLockup /> : null}
    <div className="mt-7">
      <AuthPanelHeading title={mode === 'sign-in' ? '欢迎回到 Fouc' : '创建你的 Fouc 账户'} description={mode === 'sign-in' ? '一个账户，连接你的个人工作与团队协作。' : '使用邮箱注册，验证后即可开启团队协作。'} />
      {mode === 'sign-in' ? <SignInForm targetPath={targetPath} onSuccess={onSuccess} /> : <SignUpForm />}
    </div>
    <div className="mt-5"><OAuthProviderSection onBeforeNavigate={() => saveAuthReturnTo(window.sessionStorage, targetPath)} /></div>
    <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
      {mode === 'sign-in' ? '还没有账户？' : '已有账户？'}
      <button type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className="rounded text-[var(--accent-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">{mode === 'sign-in' ? '创建账户' : '直接登录'}</button>
    </div>
    <p className="mt-5 text-center text-[11px] leading-5 text-[var(--muted)]">你也可以先使用本机知识库，登录后再开启协作。</p>
  </>;
}
