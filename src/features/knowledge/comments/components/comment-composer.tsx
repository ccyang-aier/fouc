'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowBendUpLeft, ArrowUpRight, At, CaretDown, Chat, CircleNotch, LinkSimple, TextB, WarningCircle } from '@phosphor-icons/react';
import { commentBodySchema, type CommentThreadKind } from '@fouc/shared/knowledge/comments';
import { safeKnowledgeUrl } from '@fouc/shared/knowledge/schema';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CommentAvatar, type CommentAuthor } from './comment-avatar';
import styles from './comments.module.css';

export interface CommentComposerProps {
  placeholder: string;
  submitLabel: string;
  sendingLabel: string;
  sending: boolean;
  error?: string | null;
  onSubmit: (bodyMd: string, kind: CommentThreadKind, mentions: string[]) => void | Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  minHeight?: number;
  allowIssue?: boolean;
  persistent?: boolean;
  replyTo?: CommentAuthor;
  focusKey?: string;
  authors?: ReadonlyMap<string, CommentAuthor>;
  initialBodyMd?: string;
}

/** Shared write surface: drafts survive failures; formatted text remains Markdown. */
export function CommentComposer({ placeholder, submitLabel, sendingLabel, sending, error, onSubmit, onCancel, autoFocus = true, minHeight = 64, allowIssue = false, persistent = false, replyTo, focusKey, authors, initialBodyMd = '' }: CommentComposerProps) {
  const [body, setBody] = useState(initialBodyMd);
  const [issue, setIssue] = useState(false);
  const [touched, setTouched] = useState(false);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [link, setLink] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const range = useRef({ start: 0, end: 0 });
  const submitting = useRef(false);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus, focusKey]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(160, Math.max(element.scrollHeight, minHeight))}px`;
  }, [body, minHeight]);
  const valid = commentBodySchema.safeParse(body.trim()).success;
  const rememberSelection = () => { if (ref.current) range.current = { start: ref.current.selectionStart, end: ref.current.selectionEnd }; };
  const insert = (text: string, selectFrom = text.length, selectTo = selectFrom) => {
    const { start, end } = range.current;
    setBody(value => value.slice(0, start) + text + value.slice(end));
    queueMicrotask(() => { ref.current?.focus(); ref.current?.setSelectionRange(start + selectFrom, start + selectTo); rememberSelection(); });
  };
  const submit = async () => {
    setTouched(true);
    if (!valid || sending || submitting.current) return;
    submitting.current = true;
    try {
      const mentions = mentioned.filter(id => body.includes(`@${authors?.get(id)?.name}`));
      if (await onSubmit(body.trim(), issue ? 'issue' : 'comment', mentions)) {
        setBody(''); setIssue(false); setTouched(false); setMentioned([]);
      }
    } finally { submitting.current = false; }
  };
  return <div className={styles.composer} data-persistent={persistent}>
    {replyTo && <div className={styles.composerHeading}><ArrowBendUpLeft size={17} aria-hidden /><CommentAvatar author={replyTo} /><span>回复 <strong>{replyTo.name}</strong></span><button type="button" className={styles.cancelReply} disabled={sending} onClick={onCancel}>取消</button></div>}
    <div className={styles.composerBox}>
      <textarea ref={ref} value={body} disabled={sending} rows={1}
        onChange={event => { setBody(event.target.value); rememberSelection(); }} onSelect={rememberSelection}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && onCancel && !sending) { event.preventDefault(); onCancel(); }
          else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); }
        }}
        placeholder={placeholder} aria-label={placeholder} aria-invalid={touched && !valid}
        className={styles.composerInput} />
      <div className={styles.composerActions}>
        <div className={styles.composeTools}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} disabled={sending || !authors?.size} aria-label="提及成员" title="提及成员"><At size={18} aria-hidden /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); ref.current?.focus(); }}>
              {Array.from(authors ?? []).map(([id, author]) => <DropdownMenuItem key={id} onSelect={() => { insert(`@${author.name} `); setMentioned(value => [...new Set([...value, id])]); }}>@{author.name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className={styles.iconButton} disabled={sending} aria-label="加粗评论文字" title="加粗文字" onMouseDown={event => event.preventDefault()} onClick={() => { const selected = body.slice(range.current.start, range.current.end) || '加粗文字'; insert(`**${selected}**`, 2, selected.length + 2); }}><TextB size={17} aria-hidden /></button>
          <DropdownMenu modal={false} open={linkOpen} onOpenChange={open => { setLinkOpen(open); if (open) { setLink(''); setLinkInvalid(false); } }}>
            <DropdownMenuTrigger asChild><button type="button" className={styles.iconButton} disabled={sending} aria-label="插入评论链接" title="插入链接"><LinkSimple size={18} aria-hidden /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={event => { event.preventDefault(); ref.current?.focus(); }}>
              <form className={styles.linkForm} onSubmit={event => { event.preventDefault(); const href = safeKnowledgeUrl(link.trim(), 'link'); if (!href) { setLinkInvalid(true); return; } insert(`[${body.slice(range.current.start, range.current.end) || '链接文字'}](${href})`); setLinkOpen(false); }} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
                <label>链接地址<input autoFocus aria-label="评论链接地址" placeholder="https://" value={link} onChange={event => { setLink(event.target.value); setLinkInvalid(false); }} aria-invalid={linkInvalid} /></label>
                {linkInvalid && <p role="alert">请输入有效、安全的链接地址。</p>}<button type="submit" className={styles.textButton}>插入链接</button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
          {allowIssue && <DropdownMenu modal={false}><DropdownMenuTrigger asChild><button type="button" className={styles.issueChoice} disabled={sending} aria-label="评论发表类型">{issue ? <WarningCircle size={14} /> : <Chat size={14} />}{issue ? '问题' : '评论'}<CaretDown size={10} /></button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onSelect={() => setIssue(false)}>普通评论</DropdownMenuItem><DropdownMenuItem onSelect={() => setIssue(true)}>作为问题</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
        </div>
        <span className={styles.sendHint}>Ctrl / ⌘ + Enter 发送</span>
        <button type="button" className={styles.sendButton} onClick={() => void submit()} disabled={sending || !valid} aria-label={sending ? sendingLabel : submitLabel} title={`${submitLabel} · Ctrl / ⌘ + Enter`}>
          <span>{sending ? sendingLabel : submitLabel}</span>{sending ? <CircleNotch size={15} className="animate-spin" aria-hidden /> : <ArrowUpRight size={15} aria-hidden />}
        </button>
      </div>
    </div>
    {touched && !valid && <p className={styles.composerError}><WarningCircle size={12} aria-hidden />评论内容不能为空，且不超过 50000 字符。</p>}
    {error && <p className={styles.composerError} role="alert"><WarningCircle size={12} aria-hidden />{error}</p>}
    {onCancel && !replyTo && <button type="button" className={styles.cancelReply} disabled={sending} onClick={onCancel}>取消</button>}
  </div>;
}
