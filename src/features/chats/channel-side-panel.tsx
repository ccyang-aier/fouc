'use client';

import { useState } from 'react';
import { ChatCircleText, Files, MagnifyingGlass, PushPin, Robot, Sparkle, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChannelMessage } from './channel-message';
import { ChannelComposer } from './channel-composer';
import { ChannelEmpty, ChannelTool } from './channel-ui';
import type { ChannelMessageActions } from './channel-conversation';
import type { ChannelWorkbench } from './use-channel-workbench';
import styles from './channels.module.css';

export function channelRecap(w: ChannelWorkbench) {
  const snapshot = w.snapshot;
  if (!snapshot) return '';
  const roots = snapshot.messages.filter(message => !message.threadId && message.kind !== 'summary');
  const topics = roots.filter(message => message.title || message.poll);
  const assets = snapshot.messages.flatMap(message => message.attachments);
  return [`## ${w.t('summaryLabel')}`, ...(topics.length ? [`\n### ${w.t('summaryTopics')}`, ...topics.slice(-8).map(message => `- ${message.title ?? message.poll?.question}`)] : []), `\n### ${w.t('summaryRecent')}`, ...roots.slice(-8).map(message => `- **${message.authorName}**：${message.body.slice(0, 600) || message.attachments.map(file => file.name).join('、') || message.poll?.question}`), ...(assets.length ? [`\n### ${w.t('summaryFiles')}`, ...assets.slice(-8).map(asset => `- ${asset.name}`)] : []), `\n_${w.t('summaryNotice')}_`].join('\n');
}

export function ChannelSidePanel({ workbench: w, actions, onJump }: { workbench: ChannelWorkbench; actions: ChannelMessageActions; onJump: (id: string) => void }) {
  const { t, snapshot, panel } = w;
  const [search, setSearch] = useState('');
  if (!panel || !snapshot) return null;
  const title = typeof panel === 'object' ? t('thread') : t(panel === 'search' ? 'searchResults' : panel === 'pins' ? 'pins' : 'summary');
  const Icon = typeof panel === 'object' ? ChatCircleText : panel === 'search' ? MagnifyingGlass : panel === 'pins' ? PushPin : Sparkle;
  const thread = typeof panel === 'object' ? snapshot.messages.find(message => message.id === panel.thread) : undefined;
  const replies = thread ? snapshot.messages.filter(message => message.threadId === thread.id) : [];
  const roots = snapshot.messages.filter(message => !message.threadId && message.kind !== 'summary');
  const topics = roots.filter(message => message.title || message.poll);
  const files = snapshot.messages.flatMap(message => message.attachments);
  const searchTerm = search.trim().toLocaleLowerCase();
  const searchResults = panel === 'pins' ? snapshot.messages.filter(message => message.pinned) : searchTerm ? snapshot.messages.filter(message => [message.body, message.title ?? '', message.authorName, ...message.attachments.map(file => file.name)].some(text => text.toLocaleLowerCase().includes(searchTerm))) : [];
  return <aside className={styles.sidePanel} aria-label={title}>
    <header className={styles.sideHeader}><Icon size={16} /><h3>{title}</h3><ChannelTool label={t('close')} onClick={() => w.setPanel(null)}><X size={16} /></ChannelTool></header>
    {panel === 'search' || panel === 'pins' ? <>
      {panel === 'search' && <div className={`${styles.search} ${styles.searchPanelInput}`}><MagnifyingGlass size={14} /><input autoFocus aria-label={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} value={search} onChange={event => setSearch(event.target.value)} /></div>}
      <div className={styles.searchResults}>{searchResults.map(message => <button type="button" className={`fouc-action ${styles.searchResult}`} key={message.id} onClick={() => onJump(message.id)}><strong>{message.authorName}</strong><time>{new Date(message.createdAt).toLocaleDateString()}</time><p>{message.title ? `${message.title} · ` : ''}{message.body.slice(0, 180) || message.attachments.map(file => file.name).join('、')}</p></button>)}{!searchResults.length && <p className={styles.noChannels}>{t(panel === 'pins' ? 'noPins' : 'noResults')}</p>}</div>
    </> : thread ? <>
      <div className={styles.stream}><ChannelMessage message={thread} snapshot={snapshot} {...actions} compact /><div className={styles.threadReplies}>{t('replyCount', { count: replies.length })}</div>{replies.map(message => <ChannelMessage key={message.id} message={message} snapshot={snapshot} {...actions} compact />)}{!replies.length && <p className={styles.noChannels}>{t('noReplies')}</p>}</div>
      <ChannelComposer key={thread.id} thread channelId={`${snapshot.channel.id}:${thread.id}`} name={snapshot.channel.name} members={snapshot.members} busy={w.sending} disabled={snapshot.actorRole === 'member' && snapshot.channel.permissions.post === 'admins'} onSend={(body, attachments) => w.send({ body, threadId: thread.id }, attachments)} onTopic={() => {}} onPoll={() => {}} />
    </> : panel === 'summary' ? <>
      <div className={styles.sideContent}><div className={styles.summaryIntro}><Sparkle size={23} /></div><h4 className={styles.summaryHeading}>{t('summarize')}</h4><p className={styles.summaryDescription}>{t('summaryDescription')}</p>
        {!roots.length ? <p className={styles.summaryDescription}>{t('summaryEmpty')}</p> : <>
          {topics.length > 0 && <section className={styles.summarySection}><h4><ChatCircleText size={13} />{t('summaryTopics')}</h4><ul>{topics.slice(-6).map(message => <li key={message.id}><button type="button" className="fouc-action" onClick={() => onJump(message.id)}>{message.title ?? message.poll?.question}</button></li>)}</ul></section>}
          <section className={styles.summarySection}><h4><ChatCircleText size={13} />{t('summaryRecent')}</h4><ul>{roots.slice(-6).map(message => <li key={message.id}><strong>{message.authorName}</strong><button type="button" className="fouc-action" onClick={() => onJump(message.id)}>{message.body.slice(0, 160) || message.attachments.map(file => file.name).join('、') || message.poll?.question}</button></li>)}</ul></section>
          {files.length > 0 && <section className={styles.summarySection}><h4><Files size={13} />{t('summaryFiles')}</h4><ul>{files.slice(-5).map(file => <li key={file.id}><button type="button" className="fouc-action" onClick={() => actions.onAttachment(file)}>{file.name}</button></li>)}</ul></section>}
        </>}
      </div>
      <footer className={styles.summaryFoot}><small>{t('summaryNotice')}</small><div><Button variant="outline" size="sm" loading={w.sending} disabled={!roots.length || (snapshot.actorRole === 'member' && snapshot.channel.permissions.post === 'admins')} onClick={() => { void w.send({ kind: 'summary', title: t('summaryLabel'), body: channelRecap(w) }).then(ok => { if (ok) w.notify('success', t('summaryShared')); }); }}><Sparkle size={13} />{t('postSummary')}</Button>
      {w.ownAgents.length > 0 && <DropdownMenu><DropdownMenuTrigger className={styles.summaryButton} disabled={Boolean(w.agentState)}><Robot size={14} />{t('summaryByAgent')}</DropdownMenuTrigger><DropdownMenuContent align="end" side="top" density="compact">{w.ownAgents.map(member => <DropdownMenuItem key={member.id} onSelect={() => void w.askAgent(member, `${t('summaryAgentPrompt')}\n\n${w.context()}`)}><Robot />{member.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}</div></footer>
    </> : <ChannelEmpty title={t('noReplies')} />}
  </aside>;
}
