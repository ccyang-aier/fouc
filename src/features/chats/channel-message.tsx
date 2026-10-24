'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowDown, ArrowSquareOut, ChatCircleText, Check, CheckCircle, Copy, DotsThree, File, FileCode, FileDoc, FilePdf, ImageSquare, PencilSimple, PushPin, Robot, Smiley, Sparkle, Trash } from '@phosphor-icons/react';
import type { ChannelAttachment, ChannelMessage as Message, ChannelSnapshot } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppAlert } from '@/components/app-alert-provider';
import { useTranslation } from '@/lib/i18n';
import { channelClient } from './channel-client';
import { ChannelAvatar, ChannelTool, formatFileSize } from './channel-ui';
import { channelEmoji } from './channel-composer';
import { messages } from './channels.messages';
import styles from './channels.module.css';

function Attachment({ attachment, projectId, channelId, onOpen }: { attachment: ChannelAttachment; projectId: string; channelId: string; onOpen: () => void }) {
  const { t, locale } = useTranslation(messages);
  const [url, setUrl] = useState<string | null>(null);
  const { id, mime, messageId } = attachment;
  useEffect(() => {
    if (!/^image\/(png|jpeg|gif|webp|avif)$/.test(mime)) return;
    let active = true;
    let resource: string | undefined;
    void channelClient.attachment(projectId, channelId, { id, messageId }).then(blob => {
      if (active) { resource = URL.createObjectURL(blob); setUrl(resource); }
    }).catch(() => {});
    return () => { active = false; if (resource) URL.revokeObjectURL(resource); };
  }, [id, mime, messageId, projectId, channelId]);
  if (url) return <button type="button" className={`fouc-action ${styles.imageCard}`} onClick={onOpen} aria-label={`${t('preview')}: ${attachment.name}`}><Image src={url} alt={attachment.name} width={640} height={420} style={{ width: 'auto', height: 'auto' }} unoptimized /><span>{attachment.name} · {formatFileSize(attachment.size, locale)}</span></button>;
  const extension = attachment.name.split('.').pop()?.toUpperCase() ?? '';
  const Icon = attachment.mime.includes('pdf') ? FilePdf : /json|javascript|typescript/.test(attachment.mime) ? FileCode : /text|word|document/.test(attachment.mime) ? FileDoc : attachment.mime.startsWith('image/') ? ImageSquare : File;
  return <button type="button" className={`fouc-action ${styles.fileCard}`} onClick={onOpen} aria-label={`${t('preview')}: ${attachment.name}`}><Icon size={28} weight="duotone" /><span><strong>{attachment.name}</strong><small>{formatFileSize(attachment.size, locale)}<span>·</span>{extension}<span className={styles.uploaded}><CheckCircle size={11} weight="fill" />{t('uploaded')}</span></small></span><ArrowDown size={15} /></button>;
}

export function ChannelMessage({ message, snapshot, onReply, onReact, onEdit, onDelete, onPin, onVote, onClosePoll, onAttachment, onAgent, highlight = false, compact = false }: {
  message: Message; snapshot: ChannelSnapshot; highlight?: boolean; compact?: boolean;
  onReply: (message: Message) => void; onReact: (message: Message, emoji: string) => void;
  onEdit: (message: Message, body: string) => Promise<boolean>; onDelete: (message: Message) => void;
  onPin: (message: Message) => void; onVote: (message: Message, optionId: string) => void;
  onClosePoll: (message: Message) => void; onAttachment: (attachment: ChannelAttachment) => void;
  onAgent: (message: Message) => void;
}) {
  const { t, locale } = useTranslation(messages);
  const { notify } = useAppAlert();
  const [edit, setEdit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const author = snapshot.members.find(member => member.id === message.authorId) ?? { name: message.authorName, image: message.authorImage, kind: message.authorKind };
  const actor = snapshot.members.find(member => member.id === snapshot.actorId);
  const own = message.authorId === snapshot.actorId;
  const manager = snapshot.actorRole === 'owner' || snapshot.actorRole === 'admin';
  const canPost = snapshot.channel.permissions.post === 'members' || manager;
  const replies = snapshot.messages.filter(item => item.threadId === message.id);
  const replyMembers = [...new Set(replies.map(item => item.authorId))].map(id => snapshot.members.find(member => member.id === id)).filter(member => member !== undefined).slice(0, 3);
  const hasOwnAgent = snapshot.members.some(member => member.active && member.kind === 'agent' && member.agentOwnerId === actor?.userId);
  const voted = message.poll?.options.some(option => option.voterIds.includes(snapshot.actorId));
  const totalVotes = message.poll?.options.reduce((total, option) => total + option.voterIds.length, 0) ?? 0;
  async function save() {
    if (!edit?.trim()) return;
    setSaving(true);
    if (await onEdit(message, edit.trim())) setEdit(null);
    setSaving(false);
  }
  async function copy() { try { await navigator.clipboard.writeText(message.body); notify('success', t('messageCopied')); } catch { notify('error', t('failed')); } }
  return <article id={`channel-${compact ? 'thread-' : ''}message-${message.id}`} className={styles.message} data-highlight={highlight || undefined} aria-label={`${author.name}: ${message.title ?? message.body.slice(0, 80)}`}>
    <ChannelAvatar member={author} size={34} />
    <div className={styles.messageBody}>
      {message.pinned && <div className={styles.pinnedLabel}><PushPin size={11} />{t('pinned')}</div>}
      <div className={styles.messageHeader}><strong>{author.name}</strong>{author.kind === 'agent' && <span className={styles.agentBadge}>Agent</span>}<time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString(locale)}>{new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}</time>{message.editedAt && <small>· {t('edited')}</small>}</div>
      {message.title && <h3 className={styles.messageTitle}>{message.kind === 'summary' ? <Sparkle size={16} /> : <ChatCircleText size={16} />}{message.title}</h3>}
      {edit !== null ? <div className={styles.messageEdit}><textarea autoFocus aria-label={t('content')} value={edit} onChange={event => setEdit(event.target.value)} maxLength={20000} onKeyDown={event => { if (event.key === 'Escape') setEdit(null); }} /><div><Button variant="ghost" size="sm" onClick={() => setEdit(null)}>{t('cancel')}</Button><Button size="sm" loading={saving} disabled={!edit.trim()} onClick={() => void save()}>{t('save')}</Button></div></div>
        : message.body && <div className={styles.messageText}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" />, img: ({ alt }) => <span>{alt}</span> }}>{message.body}</ReactMarkdown></div>}
      {message.poll && <div className={styles.poll}><h4>{message.poll.question}</h4>{message.poll.options.map(option => {
        const percentage = totalVotes ? Math.round(option.voterIds.length / totalVotes * 100) : 0;
        const selected = option.voterIds.includes(snapshot.actorId);
        return <button type="button" key={option.id} className={`fouc-action ${styles.pollOption}`} aria-pressed={selected} disabled={message.poll?.closed || !canPost} onClick={() => onVote(message, option.id)}>
          {(voted || message.poll?.closed) && <i style={{ width: `${percentage}%` }} />}{selected ? <Check size={13} /> : <span style={{ flex: '0 0 13px' }} />}<span>{option.text}</span>{(voted || message.poll?.closed) && <small>{percentage}%</small>}
        </button>;
      })}<div className={styles.pollFooter}><span>{t('votes', { count: totalVotes })}</span><span>{message.poll.closed ? t('closed') : t('poll')}</span></div>{!message.poll.closed && <p className={styles.pollHint}>{t('voteHint')}</p>}</div>}
      {message.attachments.length > 0 && <div className={styles.messageAttachments}>{message.attachments.map(attachment => <Attachment key={attachment.id} attachment={attachment} projectId={snapshot.channel.projectId} channelId={snapshot.channel.id} onOpen={() => onAttachment(attachment)} />)}</div>}
      {message.reactions.some(reaction => reaction.userIds.length > 0) && <div className={styles.reactions}>{message.reactions.filter(reaction => reaction.userIds.length > 0).map(reaction => <button type="button" className={`fouc-action ${styles.reaction}`} key={reaction.emoji} aria-label={`${reaction.emoji} ${reaction.userIds.map(id => snapshot.members.find(member => member.id === id)?.name ?? '').join(', ')}`} aria-pressed={reaction.userIds.includes(snapshot.actorId)} onClick={() => onReact(message, reaction.emoji)}>{reaction.emoji}<small>{reaction.userIds.length}</small></button>)}</div>}
      {!compact && replies.length > 0 && <button type="button" className={`fouc-action ${styles.replyButton}`} onClick={() => onReply(message)}><span className={styles.replyAvatars}>{replyMembers.map(member => <ChannelAvatar key={member.id} member={member} size={22} />)}</span><span>{t('replyCount', { count: replies.length })}</span><ArrowSquareOut size={11} /></button>}
    </div>
    <div className={styles.messageTools}>
      <DropdownMenu open={reactionOpen} onOpenChange={setReactionOpen}><DropdownMenuTrigger className={styles.tool} aria-label={t('react')}><Smiley size={16} /></DropdownMenuTrigger><DropdownMenuContent side="top" align="end"><div className={styles.emojiGrid}>{channelEmoji.map(emoji => <button type="button" className="fouc-action" key={emoji} aria-label={emoji} onClick={() => { onReact(message, emoji); setReactionOpen(false); }}>{emoji}</button>)}</div></DropdownMenuContent></DropdownMenu>
      {!compact && <ChannelTool label={t('reply')} onClick={() => onReply(message)}><ChatCircleText size={16} /></ChannelTool>}
      <DropdownMenu><DropdownMenuTrigger className={styles.tool} aria-label={t('more')}><DotsThree size={19} /></DropdownMenuTrigger><DropdownMenuContent side="top" align="end" density="compact">
        <DropdownMenuItem onSelect={() => void copy()}><Copy />{t('copy')}</DropdownMenuItem>
        {manager && <DropdownMenuItem onSelect={() => onPin(message)}><PushPin />{t(message.pinned ? 'unpin' : 'pin')}</DropdownMenuItem>}
        {own && message.kind !== 'poll' && <DropdownMenuItem onSelect={() => setEdit(message.body)}><PencilSimple />{t('edit')}</DropdownMenuItem>}
        {hasOwnAgent && canPost && <DropdownMenuItem onSelect={() => onAgent(message)}><Robot />{t('agentRun')}</DropdownMenuItem>}
        {message.poll && !message.poll.closed && (own || manager) && <DropdownMenuItem onSelect={() => onClosePoll(message)}><Check />{t('closePoll')}</DropdownMenuItem>}
        {(own || manager) && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => onDelete(message)}><Trash />{t('deleteMessage')}</DropdownMenuItem></>}
      </DropdownMenuContent></DropdownMenu>
    </div>
  </article>;
}
