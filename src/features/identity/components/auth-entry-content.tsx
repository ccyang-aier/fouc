'use client';

import { useState } from 'react';
import { AuthBrandLockup } from './auth-scene';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';
import { OAuthProviderSection } from './oauth-provider-list';
import { saveAuthReturnTo } from '../return-to';
import styles from './auth-form.module.css';

export function AuthEntryContent({ initialMode = 'sign-in', targetPath = '/', onSuccess, onDismiss, showBrand = true, currentAccount }: { showBrand?: boolean; initialMode?: 'sign-in' | 'sign-up'; targetPath?: string; onSuccess?: () => void; onDismiss?: () => void; currentAccount?: string }) {
  const [mode, setMode] = useState(initialMode);
  return <div className={styles.entry}>
    {showBrand ? <AuthBrandLockup /> : null}
    <header className={styles.heading}>
      <p className={styles.eyebrow}>{currentAccount ? 'Switch account' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</p>
      <h1 className={styles.title}>{currentAccount ? '切换 ' : mode === 'sign-in' ? '欢迎回到 ' : '加入 '}<span className={styles.wordmark}>Fouc</span>{currentAccount ? ' 账户' : null}</h1>
      <p className={styles.lead}>{currentAccount ? `当前账户：${currentAccount}` : mode === 'sign-in' ? '一个账户，连接你的个人工作与团队协作。' : '使用邮箱创建账户，验证后即可开始协作。'}</p>
    </header>
    <div>
      {mode === 'sign-in' ? <SignInForm targetPath={targetPath} onSuccess={onSuccess} submitLabel={currentAccount ? '切换账户' : '登录'} /> : <SignUpForm />}
    </div>
    <OAuthProviderSection onBeforeNavigate={() => saveAuthReturnTo(window.sessionStorage, targetPath)} />
    <div className={styles.footer}>
      {!currentAccount ? <span>{mode === 'sign-in' ? '还没有账户？' : '已有账户？'}<button type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className={`fouc-action ${styles.modeButton}`}>{mode === 'sign-in' ? '创建账户' : '直接登录'}</button></span> : <span />}
      {onDismiss ? <button type="button" onClick={onDismiss} className={`fouc-action ${styles.dismiss}`}>{currentAccount ? '取消切换' : '暂不登录'}</button> : null}
    </div>
  </div>;
}
