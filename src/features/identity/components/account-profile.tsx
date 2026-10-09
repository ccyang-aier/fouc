'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { foucAuthApi } from '../auth-api';
import { authErrorCopyFor } from '../auth-errors';
import { useIdentity } from '../identity-provider';
import { presenceDisplay } from '../presence';
import { authNameMaxLength, validateAuthName } from '../validation';
import styles from './account-profile.module.css';

/** Account data stays in the identity provider; this form only edits the display name. */
export function AccountProfile({ onClose }: { onClose: () => void }) {
  const { session, refresh, presence } = useIdentity();
  const [name, setName] = useState(session.status === 'authenticated' ? session.user.name : '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const nameId = useId();
  if (session.status !== 'authenticated') return null;
  const { user } = session;
  const status = presenceDisplay(presence);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const error = validateAuthName(name);
    setNameError(error);
    if (error || name.trim() === user.name) return;
    setSaving(true);
    setFeedback(null);
    try {
      await foucAuthApi.updateProfile({ name: name.trim() });
      const updatedSession = await refresh();
      if (updatedSession.status === 'error') throw updatedSession.error;
      if (updatedSession.status === 'authenticated') {
        setName(updatedSession.user.name);
        setFeedback({ error: false, text: '个人资料已更新' });
      }
    } catch (error) {
      setFeedback({ error: true, text: authErrorCopyFor(error).description });
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.profile}>
    <ProfileCover name={user.name} />
    <form noValidate onSubmit={(event) => void saveProfile(event)}>
      <div className={styles.body}>
        <div className={styles.avatarWrap}>
          <UserAvatar name={user.name} image={user.image} className={styles.avatar} />
          <span aria-hidden className={styles.presenceDot} style={{ backgroundColor: status.color }} />
        </div>
        <div className={styles.summary}>
          <div className={styles.identity}>
            <h2 className={styles.name}>{user.name}</h2>
            <p className={styles.email}>{user.email}</p>
          </div>
          <span className={styles.status}><span aria-hidden style={{ backgroundColor: status.color }} />{status.label}</span>
        </div>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor={nameId}>显示名称</label>
            <input
              id={nameId}
              name="name"
              autoComplete="name"
              required
              maxLength={authNameMaxLength}
              readOnly={saving}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              value={name}
              onBlur={() => setNameError(validateAuthName(name))}
              onChange={(event) => { setName(event.target.value); setNameError(null); setFeedback(null); }}
              className={styles.input}
            />
            {nameError ? <p id={`${nameId}-error`} className={styles.error} role="alert">{nameError}</p> : null}
          </div>
          <div className={styles.field}>
            <span className={styles.label}>邮箱</span>
            <div className={styles.emailValue}>
              <span className={styles.emailAddress}>{user.email}</span>
              <span className={user.emailVerified ? styles.verified : styles.unverified}>
                {user.emailVerified ? <CheckCircle size={12} weight="fill" aria-hidden /> : null}
                {user.emailVerified ? '已验证' : '未验证'}
              </span>
            </div>
          </div>
        </div>
        {feedback ? <p className={feedback.error ? styles.error : styles.success} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p> : null}
      </div>
      <footer className={`fouc-dialog-footer ${styles.footer}`}>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>取消</Button>
        <Button type="submit" className={styles.save} loading={saving} disabled={!name.trim() || name.trim() === user.name}>
          {saving ? '正在保存…' : '保存更改'}
        </Button>
      </footer>
    </form>
  </div>;
}

/** A static, name-seeded halftone cover follows the reference without an image asset. */
function ProfileCover({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const seed = Array.from(name).reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
    function draw() {
      if (!element || !context) return;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      element.width = width * density;
      element.height = height * density;
      context.setTransform(density, 0, 0, density, 0, 0);
      context.fillStyle = getComputedStyle(element).color;
      for (let y = 5; y < height; y += 10) {
        for (let x = 5; x < width; x += 10) {
          const wave = (Math.sin(x / width * 6 + seed) + Math.sin(y / height * 4 + seed * 0.3) + Math.sin((x + y) / 90 + seed * 0.7)) / 3;
          const value = Math.pow((wave + 1) / 2, 2.2) * (x / width * 0.9 + 0.2);
          const radius = value * 4.2;
          if (radius < 0.3) continue;
          context.globalAlpha = 0.2 + value * 0.6;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [name]);
  return <div className={styles.cover} aria-hidden><canvas ref={canvas} /></div>;
}
