'use client';

import { useState } from 'react';
import { ArrowSquareOut, ChatCircleText, Check, Copy, DotsThree, PencilSimple, PushPin, Robot, Sparkle, Trash } from '@phosphor-icons/react';
import type { ChannelAttachment, ChannelMessage as Message, ChannelSnapshot } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppAlert } from '@/components/app-alert-provider';
import { useTranslation } from '@/lib/i18n';
import { EmojiGlyph, ModernEmojiPicker } from '@/components/chat-emoji';
import { ChannelAvatar, ChannelTool } from './channel-ui';
import { ChannelAttachmentCard } from './channel-attachment';
import { ChannelPollCard } from './channel-poll';
import { ChannelMessageMarkdown } from './channel-message-markdown';
import { ChannelTextInput } from './channel-text-input';
import { messages } from './channels.messages';
import styles from './channels.module.css';

export function ChannelMessage({ message, snapshot, onReply, onReact, onEdit, onDelete, onPin, onVote, onClosePoll, onAttachment, onAgent, highlight = false, compact = false }: {
  message: Message; snapshot: ChannelSnapshot; highlight?: boolean; compact?: boolean;
  onReply: (message: Message) => void; onReact: (message: Message, emoji: string) => void;
  onEdit: (message: Message, body: string) => Promise<boolean>; onDelete: (message: Message) => void;
  onPin: (message: Message) => void; onVote: (message: Message, optionId: string) => Promise<boolean>;
  onClosePoll: (message: Message) => void; onAttachment: (attachment: ChannelAttachment) => void;
  onAgent: (message: Message) => void;
}) {
  const { t, locale } = useTranslation(messages);
  const { notify } = useAppAlert();
  const [edit, setEdit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const author = snapshot.members.find(member => member.id === message.authorId) ?? { name: message.authorName, image: message.authorImage, kind: message.authorKind };
  const actor = snapshot.members.find(member => member.id === snapshot.actorId);
  const own = message.authorId === snapshot.actorId;
  const manager = snapshot.actorRole === 'owner' || snapshot.actorRole === 'admin';
  const canPost = snapshot.channel.permissions.post === 'members' || manager;
  const replies = snapshot.messages.filter(item => item.threadId === message.id);
  const replyMembers = [...new Set(replies.map(item => item.authorId))].map(id => snapshot.members.find(member => member.id === id)).filter(member => member !== undefined).slice(0, 3);
  const hasOwnAgent = snapshot.members.some(member => member.active && member.kind === 'agent' && member.agentOwnerId === actor?.userId);
  async function save() {
    if (!edit?.trim()) return;
    setSaving(true);
    if (await onEdit(message, edit.trim())) setEdit(null);
    setSaving(false);
  }
  async function copy() { try { await navigator.clipboard.writeText(message.body); notify('success', t('messageCopied')); } catch { notify('error', t('failed')); } }
  return <article id={`channel-${compact ? 'thread-' : ''}message-${message.id}`} className={styles.message} data-threaded={!compact && replies.length > 0 || undefined} data-highlight={highlight || undefined} aria-label={`${author.name}: ${message.title ?? message.body.slice(0, 80)}`}>
    <ChannelAvatar member={author} size={compact ? 28 : 36} />
    <div className={styles.messageBody}>
      {message.pinned && <div className={styles.pinnedLabel}><PushPin size={11} />{t('pinned')}</div>}
      <div className={styles.messageHeader}><strong>{author.name}</strong>{author.kind === 'agent' && <span className={styles.agentBadge}>Agent</span>}<time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString(locale)}>{new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}</time>{message.editedAt && <small>· {t('edited')}</small>}</div>
      {message.title && <h3 className={styles.messageTitle}>{message.kind === 'summary' ? <Sparkle size={16} /> : <ChatCircleText size={16} />}{message.title}</h3>}
      {edit !== null ? <div className={styles.messageEdit}><ChannelTextInput autoFocus label={t('content')} placeholder={t('content')} value={edit} members={snapshot.members} readOnly={saving} onChange={value => setEdit(value)} onSelectionChange={() => {}} onKeyDown={event => { if (event.key === 'Escape' && !saving) setEdit(null); }} onFiles={() => {}} /><div className={styles.messageEditActions}><Button variant="ghost" size="sm" disabled={saving} onClick={() => setEdit(null)}>{t('cancel')}</Button><Button size="sm" loading={saving} disabled={!edit.trim()} onClick={() => void save()}>{t('save')}</Button></div></div>
        : message.body && <div className={styles.messageText}><ChannelMessageMarkdown body={message.body} members={snapshot.members} /></div>}
      {message.poll && <ChannelPollCard poll={message.poll} actorId={snapshot.actorId} members={snapshot.members} canVote={canPost} onVote={optionId => onVote(message, optionId)} />}
      {message.attachments.length > 0 && <div className={styles.messageAttachments}>{message.attachments.map(attachment => <ChannelAttachmentCard key={attachment.id} attachment={attachment} onOpen={() => onAttachment(attachment)} />)}</div>}
      {message.reactions.some(reaction => reaction.userIds.length > 0) && <div className={styles.reactions}>{message.reactions.filter(reaction => reaction.userIds.length > 0).map(reaction => <button type="button" className={`fouc-action ${styles.reaction}`} key={reaction.emoji} aria-label={`${reaction.emoji} ${reaction.userIds.map(id => snapshot.members.find(member => member.id === id)?.name ?? '').join(', ')}`} aria-pressed={reaction.userIds.includes(snapshot.actorId)} disabled={!canPost} onClick={() => onReact(message, reaction.emoji)}><EmojiGlyph emoji={reaction.emoji} size={18} /><small>{reaction.userIds.length}</small></button>)}</div>}
      {!compact && replies.length > 0 && <button type="button" className={`fouc-action ${styles.replyButton}`} onClick={() => onReply(message)}><span className={styles.replyAvatars}>{replyMembers.map(member => <ChannelAvatar key={member.id} member={member} size={24} />)}</span><span>{t('replyCount', { count: replies.length })}</span><ArrowSquareOut size={12} aria-hidden /></button>}
    </div>
    <div className={styles.messageTools}>
      <ModernEmojiPicker className={styles.tool} mode="reaction" disabled={!canPost} label={t('react')} onSelect={emoji => onReact(message, emoji)} />
      {!compact && <ChannelTool label={t('reply')} onClick={() => onReply(message)}><ChatCircleText size={16} /></ChannelTool>}
      <DropdownMenu><DropdownMenuTrigger className={styles.tool} aria-label={t('more')}><DotsThree size={19} /></DropdownMenuTrigger><DropdownMenuContent className={styles.menu} side="top" align="end" density="compact">
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
