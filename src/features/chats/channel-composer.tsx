'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { At, ChartBar, Code, ImageSquare, PaperPlaneTilt, Paperclip, Plus, Smiley, TextB, TextItalic, TextT, X, ChatCircleText } from '@phosphor-icons/react';
import { CHANNEL_FILE_LIMIT, CHANNEL_FILE_MAX_BYTES, CHANNEL_FILE_TOTAL_MAX_BYTES, type ChannelMember } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppAlert } from '@/components/app-alert-provider';
import { usePageSessionState } from '@/lib/page-session-state';
import { usePageVisible } from '@/lib/page-visibility';
import { useTranslation } from '@/lib/i18n';
import { ChannelAvatar, ChannelTool } from './channel-ui';
import { messages } from './channels.messages';
import styles from './channels.module.css';

export const channelEmoji = ['👍', '❤️', '🎉', '👀', '✅', '🚀', '💡', '🙏', '😂'] as const;

export function ChannelComposer({ channelId, name, members, busy, disabled, thread = false, onSend, onTopic, onPoll }: {
  channelId: string; name: string; members: ChannelMember[]; busy: boolean; disabled?: boolean; thread?: boolean;
  onSend: (body: string, files: File[]) => Promise<boolean>; onTopic: () => void; onPoll: () => void;
}) {
  const { t } = useTranslation(messages);
  const { notify } = useAppAlert();
  const visible = usePageVisible();
  const [body, setBody] = usePageSessionState(`channel-draft:${channelId}`, '');
  const [files, setFiles] = usePageSessionState<File[]>(`channel-files:${channelId}`, []);
  const [dragging, setDragging] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [caret, setCaret] = useState<number | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const sendLock = useRef(false);
  useLayoutEffect(() => {
    const node = input.current;
    if (!node || !visible) return;
    node.style.height = '0px';
    node.style.height = `${Math.min(140, Math.max(52, node.scrollHeight))}px`;
  }, [body, visible]);
  useEffect(() => { if (thread) input.current?.focus({ preventScroll: true }); }, [thread]);
  const mentionText = body.slice(0, caret ?? body.length).match(/(?:^|\s)@([^@\n]*)$/)?.[1] ?? '';
  const suggestions = members.filter(member => member.active && member.name.toLocaleLowerCase().includes(mentionText.toLocaleLowerCase()));
  function change(value: string) {
    setBody(value);
    const prefix = value.slice(0, input.current?.selectionStart ?? value.length);
    setCaret(input.current?.selectionStart ?? value.length);
    setMentionOpen(/(?:^|\s)@[^@\n]*$/.test(prefix));
    setMentionIndex(0);
  }
  function insert(text: string, mention = false) {
    if (busy || disabled) return;
    const node = input.current;
    const end = node?.selectionEnd ?? body.length;
    let start = node?.selectionStart ?? body.length;
    if (mention) { const match = body.slice(0, start).match(/@[^@\n]*$/); if (match) start -= match[0].length; }
    const value = body.slice(0, start) + text + body.slice(end);
    setBody(value); setCaret(start + text.length); setMentionOpen(false);
    requestAnimationFrame(() => { node?.focus(); node?.setSelectionRange(start + text.length, start + text.length); });
  }
  function format(marker: string) {
    if (busy || disabled) return;
    const node = input.current;
    const start = node?.selectionStart ?? body.length;
    const end = node?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + marker + body.slice(start, end) + marker + body.slice(end));
    requestAnimationFrame(() => { node?.focus(); node?.setSelectionRange(start + marker.length, end + marker.length); });
  }
  function addFiles(incoming: File[]) {
    if (busy || disabled) return;
    if (incoming.some(file => file.size > CHANNEL_FILE_MAX_BYTES) || files.length + incoming.length > CHANNEL_FILE_LIMIT || [...files, ...incoming].reduce((sum, file) => sum + file.size, 0) > CHANNEL_FILE_TOTAL_MAX_BYTES) { notify('warning', t('fileTooLarge')); return; }
    setFiles(current => [...current, ...incoming]);
  }
  async function send() {
    if (busy || disabled || sendLock.current || (!body.trim() && !files.length)) return;
    sendLock.current = true;
    try { if (await onSend(body.trim(), files)) { setBody(''); setFiles([]); setMentionOpen(false); input.current?.focus(); } }
    finally { sendLock.current = false; }
  }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (mentionOpen && suggestions.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setMentionIndex(index => (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); insert(`@${suggestions[mentionIndex % suggestions.length].name} `, true); return; }
    }
    if (event.key === 'Escape') { setMentionOpen(false); return; }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); }
  }
  function paste(event: ClipboardEvent) {
    const incoming = Array.from(event.clipboardData.files);
    if (incoming.length) { event.preventDefault(); addFiles(incoming); }
  }
  return <div className={styles.composerArea} data-thread={thread}>
    <div className={styles.composer} data-dragging={dragging} data-disabled={disabled || undefined}
      onDragOver={event => { event.preventDefault(); if (!disabled && !busy) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) addFiles(Array.from(event.dataTransfer.files)); }}>
      {dragging && <div className={styles.dropZone}><Paperclip size={25} /><span>{t('dropFiles')}</span></div>}
      {files.length > 0 && <div className={styles.pendingFiles}>{files.map((file, index) => <span key={`${index}:${file.name}`}><Paperclip size={13} /><span>{file.name}</span><button type="button" disabled={busy || disabled} className="fouc-action" aria-label={t('removeAttachment', { name: file.name })} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X size={12} /></button></span>)}</div>}
      <textarea ref={input} rows={2} aria-label={t('composer', { name })} value={body} disabled={disabled} readOnly={busy}
        placeholder={t(disabled ? 'restricted' : thread ? 'replyPlaceholder' : 'composerPlaceholder')} maxLength={20000}
        onChange={event => change(event.target.value)} onKeyDown={keyDown} onPaste={paste} />
      {mentionOpen && suggestions.length > 0 && <div className={styles.mentionList} role="listbox" aria-label={t('mention')}>{suggestions.map((member, index) => <button type="button" key={member.id} role="option" aria-selected={index === mentionIndex % suggestions.length} className="fouc-action" onMouseDown={event => event.preventDefault()} onClick={() => insert(`@${member.name} `, true)}><ChannelAvatar member={member} size={26} /><span>{member.name}</span>{member.kind === 'agent' && <small>Agent</small>}</button>)}</div>}
      <div className={styles.composerToolbar}>
        <div className={styles.composeTools}>
          <DropdownMenu><DropdownMenuTrigger className={styles.composeAdd} aria-label={t('more')} disabled={disabled || busy}><Plus size={18} /></DropdownMenuTrigger><DropdownMenuContent align="start" side="top" density="compact">
            <DropdownMenuItem onSelect={() => fileInput.current?.click()}><Paperclip />{t('attachment')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => imageInput.current?.click()}><ImageSquare />{t('image')}</DropdownMenuItem>
            {!thread && <><DropdownMenuItem onSelect={onTopic}><ChatCircleText />{t('topic')}</DropdownMenuItem><DropdownMenuItem onSelect={onPoll}><ChartBar />{t('poll')}</DropdownMenuItem></>}
          </DropdownMenuContent></DropdownMenu>
          <span className={styles.toolSeparator} />
          <ChannelTool label={t('attachment')} disabled={disabled || busy} onClick={() => fileInput.current?.click()}><Paperclip size={17} /></ChannelTool>
          <ChannelTool label={t('mention')} disabled={disabled || busy} onClick={() => { insert('@'); setMentionOpen(true); }}><At size={17} /></ChannelTool>
          <DropdownMenu open={emojiOpen} onOpenChange={setEmojiOpen}><DropdownMenuTrigger className={styles.tool} aria-label={t('emoji')} disabled={disabled || busy}><Smiley size={17} /></DropdownMenuTrigger><DropdownMenuContent side="top" align="start"><div className={styles.emojiGrid}>{channelEmoji.map(emoji => <button key={emoji} type="button" className="fouc-action" aria-label={emoji} onClick={() => { insert(emoji); setEmojiOpen(false); }}>{emoji}</button>)}</div></DropdownMenuContent></DropdownMenu>
          <ChannelTool label={t('format')} disabled={disabled || busy} aria-pressed={formatOpen} onClick={() => setFormatOpen(!formatOpen)}><TextT size={17} /></ChannelTool>
          {formatOpen && <div className={styles.formatTools}><ChannelTool label={t('bold')} disabled={busy || disabled} onClick={() => format('**')}><TextB size={16} /></ChannelTool><ChannelTool label={t('italic')} disabled={busy || disabled} onClick={() => format('*')}><TextItalic size={16} /></ChannelTool><ChannelTool label={t('code')} disabled={busy || disabled} onClick={() => format('`')}><Code size={16} /></ChannelTool></div>}
        </div>
        <Button type="button" className={styles.sendButton} size="icon-sm" aria-label={t('send')} loading={busy} disabled={disabled || (!body.trim() && !files.length)} onClick={() => void send()}><PaperPlaneTilt size={17} weight="fill" /></Button>
      </div>
      <input ref={fileInput} type="file" multiple hidden onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <input ref={imageInput} type="file" multiple accept="image/*" hidden onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    </div>
    <div className={styles.composerHint}><span>{thread ? t('replyInChannel') : <><span className={styles.hintDot} />{t('composer', { name })}</>}</span><span>{t('sendHint')}</span></div>
  </div>;
}
