'use client';

import { ImageSquare, X } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TASK_COMMENT_IMAGE_LIMIT, TASK_COMMENT_IMAGE_MAX_BYTES, TASK_COMMENT_IMAGE_MIME_TYPES } from '@fouc/shared/tasks';
import { AppAlert } from '@/components/app-alert';
import { Button } from '@/components/ui/button';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import { messages } from './task-comments.messages';
import styles from './task-comment-composer.module.css';

interface DraftImage { id: string; file: File; url: string }
type ComposerError = 'imageType' | 'imageSize' | 'imageLimit' | 'postFailed';

export function TaskCommentComposer({ author, hidden, onSubmit, onDirtyChange }: {
  author?: { name: string; image: string | null }; hidden: boolean;
  onSubmit: (body: string, images: File[]) => Promise<void>; onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation(messages);
  const [body, setBody] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<ComposerError | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    const ownedUrls = urls.current;
    return () => { active.current = false; for (const url of ownedUrls) URL.revokeObjectURL(url); ownedUrls.clear(); };
  }, []);
  useEffect(() => { onDirtyChange(Boolean(body.trim()) || images.length > 0); }, [body, images.length, onDirtyChange]);
  useLayoutEffect(() => {
    if (!input.current || hidden) return;
    input.current.style.height = '0px';
    input.current.style.height = `${Math.min(140, Math.max(38, input.current.scrollHeight))}px`;
  }, [body, hidden]);

  function release(image: DraftImage) { URL.revokeObjectURL(image.url); urls.current.delete(image.url); }
  function clear() { setBody(''); images.forEach(release); setImages([]); setError(null); }
  function addImages(files: readonly File[]) {
    if (posting || hidden) return;
    const next: DraftImage[] = [];
    let issue: ComposerError | null = null;
    for (const file of files) {
      if (!(TASK_COMMENT_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) { issue ??= 'imageType'; continue; }
      if (!file.size || file.size > TASK_COMMENT_IMAGE_MAX_BYTES) { issue ??= 'imageSize'; continue; }
      if (images.length + next.length >= TASK_COMMENT_IMAGE_LIMIT) { issue ??= 'imageLimit'; continue; }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      next.push({ id: crypto.randomUUID(), file, url });
    }
    setImages([...images, ...next]); setError(issue);
    input.current?.focus({ preventScroll: true });
  }
  function insertEmoji(emoji: string) {
    const start = input.current?.selectionStart ?? body.length, end = input.current?.selectionEnd ?? start;
    const next = body.slice(0, start) + emoji + body.slice(end);
    if (next.length > 4000) return;
    setBody(next);
    requestAnimationFrame(() => { input.current?.focus({ preventScroll: true }); input.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }
  async function post() {
    if (posting || hidden || (!body.trim() && !images.length)) return;
    setPosting(true); setError(null);
    try {
      await onSubmit(body.trim(), images.map(image => image.file));
      if (active.current) { clear(); input.current?.focus({ preventScroll: true }); }
    } catch { if (active.current) setError('postFailed'); }
    finally { if (active.current) setPosting(false); }
  }

  return <div className={styles.composer} hidden={hidden}>
    <UserAvatar name={author?.name} image={author?.image} className={styles.avatar} />
    <div className={styles.content}>
      <div className={styles.editor}>
        {images.length > 0 && <div className={styles.previews} aria-label={t('selectedImages')}>
          {images.map(image => <div className={styles.preview} key={image.id}>
            {/* Browser-owned blob URLs are released on removal, publication and unmount. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.file.name} />
            <button type="button" className={`fouc-action ${styles.remove}`} data-variant="destructive" aria-label={t('removeImage', { name: image.file.name })}
              disabled={posting} onClick={() => { release(image); setImages(current => current.filter(item => item.id !== image.id)); }}><X size={11} aria-hidden /></button>
          </div>)}
        </div>}
        <textarea ref={input} aria-label={t('placeholder')} placeholder={t('placeholder')} value={body} maxLength={4000} disabled={posting} rows={1}
          onChange={event => setBody(event.target.value)} onPaste={event => {
            const pasted = [...event.clipboardData.files];
            if (pasted.length) { event.preventDefault(); addImages(pasted); }
          }} onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void post(); }
          }} />
        <div className={styles.actions}>
          <input ref={filesInput} type="file" multiple accept={TASK_COMMENT_IMAGE_MIME_TYPES.join(',')} className={styles.fileInput} tabIndex={-1} aria-label={t('uploadImages')}
            onChange={event => { addImages([...event.target.files ?? []]); event.target.value = ''; }} />
          <button type="button" className={`fouc-action ${styles.tool}`} data-surface="plain" aria-label={t('uploadImages')} title={t('uploadImages')}
            disabled={posting || images.length >= TASK_COMMENT_IMAGE_LIMIT} onClick={() => filesInput.current?.click()}><ImageSquare size={15} aria-hidden /></button>
          <EmojiPicker className={styles.tool} disabled={posting || hidden} onSelect={insertEmoji} />
          <span className={styles.shortcut}>{t('shortcut')}</span>
          {(body.trim() || images.length > 0) && <Button variant="ghost" size="sm" className={styles.clear} data-variant="destructive" disabled={posting} onClick={clear}>{t('clear')}</Button>}
          <Button variant="outline" size="sm" className={styles.publish} loading={posting} disabled={!body.trim() && !images.length} onClick={() => void post()}>{t('publish')}</Button>
        </div>
      </div>
      {error && <AppAlert tone="error" title={t(error)} onClose={() => setError(null)} />}
    </div>
  </div>;
}
