'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { ChannelAttachment } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { useProjectResources } from '@/features/project/project-resources';
import { usePageVisible } from '@/lib/page-visibility';
import { replaceWorkbenchLocation } from '@/lib/navigation-history';
import { ChannelHeader } from './channel-header';
import { ChannelConversation, useMessageActions } from './channel-conversation';
import { ChannelSidePanel } from './channel-side-panel';
import { ChannelFilePreview, ChannelOverlays } from './channel-overlays';
import { ChannelAssets, ChannelMembers } from './channel-panels';
import { ChannelEmpty } from './channel-ui';
import { channelClient } from './channel-client';
import { useChannelWorkbench } from './use-channel-workbench';
import { useChannelAssets } from './channel-data';
import './channel-fonts.css';
import styles from './channels.module.css';

export function ProjectChatsPage() {
  const { scopeKey, projects, selectedProject, selectProject } = useProjectResources();
  const linkConsumed = useRef(false);
  // A copied link selects only a project already returned by the authorized directory.
  useEffect(() => {
    if (linkConsumed.current) return;
    const target = new URLSearchParams(window.location.search).get('project');
    if (!target) { linkConsumed.current = true; return; }
    if (target === selectedProject?.id) { linkConsumed.current = true; const url = new URL(window.location.href); url.searchParams.delete('project'); url.searchParams.delete('channel'); replaceWorkbenchLocation(url); return; }
    if (projects.some(project => project.id === target && project.source === 'server')) selectProject(target);
  }, [projects, selectedProject?.id, selectProject]);
  const target = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('project');
  if (target && target !== selectedProject?.id && projects.some(project => project.id === target && project.source === 'server')) return <div className={styles.skeleton} />;
  return <ChannelWorkbenchPage key={scopeKey} />;
}

function ChannelWorkbenchPage() {
  const w = useChannelWorkbench();
  const { t, snapshot, channel } = w;
  const [preview, setPreview] = useState<{ attachment: ChannelAttachment; channelId: string } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const page = useRef<HTMLElement>(null);
  const visible = usePageVisible();
  const assets = useChannelAssets(w.tab === 'assets' ? channel?.id ?? null : null);
  function openAttachment(attachment: ChannelAttachment) { if (channel) setPreview({ attachment, channelId: channel.id }); }
  const actions = useMessageActions(w, openAttachment);
  async function download(attachment: ChannelAttachment) {
    if (!channel) return;
    await w.action(async () => {
      const blob = await channelClient.attachment(channel.projectId, channel.id, attachment);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = attachment.name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function jump(id: string) {
    const message = snapshot?.messages.find(item => item.id === id);
    if (!message) return;
    w.setTab('conversation');
    if (message.threadId) w.setPanel({ thread: message.threadId });
    else w.setPanel(null);
    setHighlight(id);
    requestAnimationFrame(() => page.current?.querySelector(`[id="channel-${message.threadId ? 'thread-' : ''}message-${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }
  useEffect(() => { if (!highlight) return; const timer = setTimeout(() => setHighlight(null), 2000); return () => clearTimeout(timer); }, [highlight]);
  useEffect(() => {
    if (!visible) return;
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !w.modal) { event.preventDefault(); w.setTab('conversation'); w.setPanel('search'); }
      if (event.key === 'Escape' && !event.defaultPrevented && w.panel) w.setPanel(null);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [visible, w]);
  return <section ref={page} className={styles.page} aria-label={t('chats')}>
    <div className={styles.content}>
      <ChannelHeader workbench={w} />
      {!w.canUse ? <ChannelEmpty title={t('serverProject')} description={t(w.project.principal === 'guest' ? 'signInDescription' : 'serverProjectDescription')}>{w.project.principal === 'guest' && <Button size="sm" onClick={w.identity.openSignIn}>{t('signIn')}</Button>}</ChannelEmpty>
        : w.directory.isError && !w.channels.length ? <ChannelEmpty title={t('loadError')}><Button size="sm" variant="outline" onClick={() => void w.directory.refetch()}>{t('retry')}</Button></ChannelEmpty>
        : !channel ? w.directory.isLoading ? <div aria-label={t('loading')}>{[0, 1, 2].map(item => <div className={styles.skeleton} key={item} />)}</div> : <ChannelEmpty title={t('noChannels')} description={t('noChannelsDescription')}><Button size="sm" onClick={() => w.setModal('create')}><Plus size={15} />{t('new')}</Button></ChannelEmpty>
        : <>
          {w.detail.isError && <div className={styles.status} role="status"><span>{t('disconnected')}</span><Button variant="ghost" size="sm" onClick={() => void w.detail.refetch()}>{t('retry')}</Button></div>}
          {!snapshot ? w.detail.isError ? <ChannelEmpty title={t('loadError')} /> : <div aria-label={t('loading')}>{[0, 1, 2].map(item => <div className={styles.skeleton} key={item} />)}</div>
            : w.tab === 'assets' ? <><div className={styles.assetsStatus}>{assets.isFetching && !assets.data ? <span>{t('loading')}</span> : assets.isError ? <span>{t('disconnected')} <Button variant="ghost" size="sm" onClick={() => void assets.refetch()}>{t('retry')}</Button></span> : null}</div><ChannelAssets snapshot={snapshot} assets={assets.data?.items} onOpen={openAttachment} onDownload={attachment => void download(attachment)} onJump={jump} /></>
            : w.tab === 'members' ? <ChannelMembers snapshot={snapshot} onInvite={() => w.setModal('invite')} onAddAgent={() => void w.openAgentDialog()} onRole={(memberId, role) => { void w.action(() => w.mutate(() => channelClient.memberRole(channel.projectId, channel.id, memberId, role), t('memberRoleSaved'))); }} onRemove={memberId => { const member = snapshot.members.find(item => item.id === memberId); if (member) w.setModal({ removeMember: member }); }} />
            : <div className={styles.conversation}><ChannelConversation workbench={w} actions={actions} highlight={highlight} /><ChannelSidePanel key={typeof w.panel === 'object' && w.panel ? w.panel.thread : w.panel} workbench={w} actions={actions} onJump={jump} /></div>}
        </>}
    </div>
    <ChannelOverlays workbench={w} />
    {preview && channel?.id === preview.channelId && snapshot && <ChannelFilePreview key={`${preview.channelId}:${preview.attachment.id}`} attachment={preview.attachment} workbench={w} onClose={() => setPreview(null)} />}
  </section>;
}
