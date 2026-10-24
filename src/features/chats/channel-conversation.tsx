'use client';

import { useEffect, useRef } from 'react';
import { Plus, Robot, Sparkle, UserPlus } from '@phosphor-icons/react';
import type { ChannelAttachment, ChannelMessage as Message } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { ChannelComposer } from './channel-composer';
import { ChannelMessage } from './channel-message';
import { ChannelEmpty, ChannelIcon } from './channel-ui';
import type { ChannelWorkbench } from './use-channel-workbench';
import styles from './channels.module.css';

export type ChannelMessageActions = ReturnType<typeof useMessageActions>;
export function useMessageActions(w: ChannelWorkbench, onAttachment: (attachment: ChannelAttachment) => void) {
  const channel = w.channel;
  const mutate = (operation: () => Promise<import('@fouc/shared/chats').ChannelSnapshot>) => w.action(() => w.mutate(operation));
  return {
    onAttachment,
    onReply: (message: Message) => w.setPanel({ thread: message.threadId ?? message.id }),
    onReact: (message: Message, emoji: string) => { if (channel) void mutate(() => channelClient.react(channel.projectId, channel.id, message.id, emoji)); },
    onEdit: (message: Message, body: string) => channel ? mutate(() => channelClient.editMessage(channel.projectId, channel.id, message.id, { body })) : Promise.resolve(false),
    onDelete: (message: Message) => w.setModal({ deleteMessage: message }),
    onPin: (message: Message) => { if (channel) void mutate(() => channelClient.editMessage(channel.projectId, channel.id, message.id, { pinned: !message.pinned })); },
    onVote: (message: Message, optionId: string) => channel ? mutate(() => channelClient.vote(channel.projectId, channel.id, message.id, optionId)) : Promise.resolve(false),
    onClosePoll: (message: Message) => { if (channel) void mutate(() => channelClient.editMessage(channel.projectId, channel.id, message.id, { closed: true })); },
    onAgent: (message: Message) => {
      const agent = w.ownAgents[0];
      if (agent && channel) void w.askAgent(agent, w.t('agentRequest', { channel: channel.name, context: w.context(message) }), message.threadId ?? message.id);
      else w.notify('warning', w.t('agentUnavailable'));
    },
  };
}
import { channelClient } from './channel-client';

export function ChannelConversation({ workbench: w, actions, highlight }: { workbench: ChannelWorkbench; actions: ChannelMessageActions; highlight: string | null }) {
  const { t, snapshot } = w;
  const stream = useRef<HTMLDivElement>(null);
  const wasNearBottom = useRef(true);
  const channelId = snapshot?.channel.id;
  const count = snapshot?.messages.length ?? 0;
  useEffect(() => { if (wasNearBottom.current && !highlight) stream.current?.scrollTo({ top: stream.current.scrollHeight }); }, [count, channelId, highlight]);
  if (!snapshot) return null;
  const channel = snapshot.channel;
  const roots = snapshot.messages.filter(message => !message.threadId && (w.tab !== 'topics' || message.kind === 'topic' || snapshot.messages.some(reply => reply.threadId === message.id)));
  const canPost = snapshot.actorRole !== 'member' || channel.permissions.post === 'members';
  const canInvite = snapshot.actorRole !== 'member' || channel.permissions.invite === 'members';
  function day(date: string) {
    const value = new Date(date);
    const today = new Date();
    if (value.toLocaleDateString() === today.toLocaleDateString()) return t('today');
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (value.toLocaleDateString() === yesterday.toLocaleDateString()) return t('yesterday');
    return value.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return <div className={styles.streamColumn}>
    <div ref={stream} className={styles.stream} onScroll={event => { const node = event.currentTarget; wasNearBottom.current = node.scrollHeight - node.clientHeight - node.scrollTop < 110; }}>
      {w.detail.hasMore && <div className={styles.historyControl}><Button variant="ghost" size="sm" loading={w.detail.loadingEarlier} onClick={() => { void w.action(() => w.detail.loadEarlier()); }}>{t('loadEarlier')}</Button></div>}
      {w.tab === 'topics' && !roots.length ? <ChannelEmpty title={t('noTopics')} description={t('noTopicsDescription')}><Button size="sm" disabled={!canPost} onClick={() => w.setModal('topic')}><Plus size={15} />{t('topic')}</Button></ChannelEmpty>
        : <>
          {snapshot.messages.length === 0 && <div className={styles.welcome}><ChannelIcon channel={channel} size={43} /><h3>{t('channelStart', { name: channel.name })}</h3><p>{channel.description || t('channelStartDescription')}</p><div className={styles.welcomeActions}>{canInvite && <Button size="sm" variant="outline" onClick={() => w.setModal('invite')}><UserPlus size={14} />{t('addMembers')}</Button>}<Button size="sm" variant="outline" onClick={() => void w.openAgentDialog()}><Robot size={14} />{t('addAgent')}</Button></div></div>}
          {roots.map((message, index) => <div key={message.id}>
            {(index === 0 || day(message.createdAt) !== day(roots[index - 1].createdAt)) && <div className={styles.dateSeparator}><span>{day(message.createdAt)}</span>{index === 0 && <button type="button" className={`fouc-action ${styles.catchUp}`} onClick={() => w.setPanel('summary')}><Sparkle size={12} weight="fill" />{t('aiSummary')}</button>}</div>}
            <ChannelMessage message={message} snapshot={snapshot} highlight={highlight === message.id} {...actions} />
          </div>)}
        </>}
    </div>
    {w.agentState?.channelId === channel.id && <div className={styles.agentStatus}><span className={styles.thinkingDots}><i /><i /><i /></span><span>{w.agentState.member.name} · {t(w.agentState.status === 'starting' ? 'agentStarting' : w.agentState.status === 'waitingApproval' ? 'approval' : 'agentThinking')}</span><Button variant="ghost" size="sm" onClick={w.cancelAgent}>{t('cancelRun')}</Button></div>}
    <ChannelComposer key={channel.id} channelId={channel.id} name={channel.name} members={snapshot.members} busy={w.sending} disabled={!canPost} onSend={(body, files) => w.send({ body }, files)} onTopic={() => w.setModal('topic')} onPoll={() => w.setModal('poll')} />
  </div>;
}
