'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PaperPlaneTilt, WarningCircle, CircleNotch } from '@phosphor-icons/react';
import { commentBodySchema, type CommentThreadKind } from '@fouc/shared/knowledge/comments';
import styles from './comments.module.css';

export interface CommentComposerProps {
  placeholder: string;
  submitLabel: string;
  sendingLabel: string;
  sending: boolean;
  error?: string | null;
  onSubmit: (bodyMd: string, kind: CommentThreadKind) => void | Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  minHeight?: number;
  allowIssue?: boolean;
  persistent?: boolean;
}

/** One write surface for page comments, quoted comments and replies. Drafts survive failed sends. */
export function CommentComposer({ placeholder, submitLabel, sendingLabel, sending, error, onSubmit, onCancel, autoFocus = true, minHeight = 64, allowIssue = false, persistent = false }: CommentComposerProps) {
  const [body, setBody] = useState('');
  const [issue, setIssue] = useState(false);
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`;
  }, [body, minHeight]);
  const valid = commentBodySchema.safeParse(body.trim()).success;
  const submit = async () => {
    setTouched(true);
    if (!valid || sending || submitting.current) return;
    submitting.current = true;
    try {
      if (await onSubmit(body.trim(), issue ? 'issue' : 'comment')) {
        setBody(''); setIssue(false); setTouched(false);
      }
    } finally { submitting.current = false; }
  };
  return <div className={styles.composer} data-persistent={persistent}>
    <textarea ref={ref} value={body} disabled={sending} rows={2}
      onChange={event => setBody(event.target.value)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && onCancel && !sending) { event.preventDefault(); onCancel(); }
        else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); }
      }}
      placeholder={placeholder} aria-label={placeholder} aria-invalid={touched && !valid}
      className={styles.composerInput} />
    {touched && !valid && <p className={styles.composerError}><WarningCircle size={12} aria-hidden />评论内容不能为空，且不超过 50000 字符。</p>}
    {error && <p className={styles.composerError} role="alert"><WarningCircle size={12} aria-hidden />{error}</p>}
    <div className={styles.composerActions}>
      {allowIssue ? <label className={styles.issueChoice} title="只有问题才需要标记解决状态"><input type="checkbox" checked={issue} disabled={sending} onChange={event => setIssue(event.target.checked)} />作为问题</label> : <span />}
      <div className={styles.sendActions}>
        {onCancel && <button type="button" className={styles.textButton} disabled={sending} onClick={onCancel}>取消</button>}
        <button type="button" className={styles.sendButton} onClick={() => void submit()} disabled={sending || !valid} aria-label={sending ? sendingLabel : submitLabel} title={`${submitLabel} · Ctrl / ⌘ + Enter`}>
          {sending ? <CircleNotch size={16} className="animate-spin" aria-hidden /> : <PaperPlaneTilt size={16} weight="fill" aria-hidden />}
          {!persistent && <span>{sending ? sendingLabel : submitLabel}</span>}
        </button>
      </div>
    </div>
  </div>;
}
