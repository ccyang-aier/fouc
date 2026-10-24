'use client';

import { useState } from 'react';
import { ArrowClockwise, SignOut } from '@phosphor-icons/react';
import type { CreateChannelInput } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { ChannelAgentDialog, ChannelConfirmDialog, ChannelFormDialog, ChannelInviteDialog, ChannelPollDialog, ChannelTopicDialog } from './channel-dialogs';
import { ChannelPanelModal } from './channel-panel-modal';
import { channelClient } from './channel-client';
import type { ChannelWorkbench } from './use-channel-workbench';
import styles from './channels.module.css';

export { ChannelFilePreview } from './channel-file-preview';

export function ChannelOverlays({ workbench: w }: { workbench: ChannelWorkbench }) {
  const { t, modal, channel, snapshot } = w;
  const close = () => w.setModal(null);
  const submit = (operation: () => Promise<unknown>) => w.dialog(operation);
  const projectId = w.project.selectedProject?.id;
  if (w.approval) return <ChannelPanelModal title={t('approval')} onClose={() => w.closeApproval(null)}>
    <div className={styles.sideContent}><p className={styles.summaryDescription}>{w.agentState?.member.name} · {w.channels.find(item => item.id === w.agentState?.channelId)?.name}</p><h3 className={styles.summaryHeading}>{w.approval.value.title}</h3><p className={styles.summaryDescription}>{t('approvalDescription')}</p>{w.approval.value.rawInput !== undefined && <pre className={styles.approvalInput}>{JSON.stringify(w.approval.value.rawInput, null, 2)}</pre>}{w.approval.value.locations?.map(location => <p key={location.path} className={styles.description}>{location.path}</p>)}</div><footer><Button size="sm" variant="outline" onClick={() => w.closeApproval(null)}>{t('reject')}</Button>{w.approval.value.options.filter(option => option.kind === 'allow_once').map(option => <Button size="sm" key={option.optionId} onClick={() => w.closeApproval(option.optionId)}>{option.label}</Button>)}</footer>
  </ChannelPanelModal>;
  if (w.modelRetry && w.modelRetry.channelId === channel?.id && snapshot) return <ChannelModelRetry key={w.modelRetry.models.currentModelId} workbench={w} />;
  if (!modal || !projectId) return null;
  if ((modal === 'invite' || modal === 'create') && (w.people.isLoading || w.people.isError)) return <ChannelPanelModal title={t(modal === 'invite' ? 'addMembers' : 'new')} onClose={close}><div className={styles.sideContent}>{w.people.isError ? <><p className={styles.summaryDescription}>{t('loadError')}</p><Button variant="outline" size="sm" onClick={() => void w.people.refetch()}><ArrowClockwise size={14} />{t('retry')}</Button></> : <div className={styles.skeleton} aria-label={t('loading')} />}</div></ChannelPanelModal>;
  if (modal === 'create') return <ChannelFormDialog projectMembers={w.people.data?.items.filter(member => member.userId !== w.project.principal) ?? []} busy={w.busy} onClose={close} onSubmit={input => submit(async () => {
    const next = await w.mutate(() => channelClient.create(projectId, input as CreateChannelInput), t('created'), true); w.select(next.channel.id); w.setTab('conversation');
  })} />;
  if (!channel || !snapshot) return null;
  if (modal === 'settings') return <ChannelFormDialog channel={channel} projectMembers={[]} busy={w.busy} onClose={close} onSubmit={input => submit(() => w.mutate(() => channelClient.update(projectId, channel.id, input), t('saved')))} />;
  if (modal === 'invite') return <ChannelInviteDialog members={snapshot.members} projectMembers={w.people.data?.items ?? []} busy={w.busy} onClose={close} onInvite={ids => submit(() => w.mutate(() => channelClient.invite(projectId, channel.id, ids), t('invited')))} />;
  if (modal === 'agent') return <ChannelAgentDialog members={snapshot.members} actorUserId={w.project.principal} {...w.agents} busy={w.busy} onClose={close} onAdd={(installation, name) => submit(() => w.mutate(() => channelClient.addAgent(projectId, channel.id, { installationId: installation.id, name, image: installation.providerId === 'codex' ? '/agent-logos/tools/coding/codex.svg' : null }), t('agentAdded')))} />;
  if (modal === 'poll') return <ChannelPollDialog busy={w.sending} onClose={close} onSubmit={async (question, options) => { if (await w.send({ kind: 'poll', poll: { question, options } })) close(); }} />;
  if (modal === 'topic') return <ChannelTopicDialog busy={w.sending} onClose={close} onSubmit={async (title, body) => { if (await w.send({ kind: 'topic', title, body })) close(); }} />;
  if (modal === 'deleteChannel') return <ChannelConfirmDialog title={t('deleteChannelTitle', { name: channel.name })} description={t('deleteChannelDescription')} busy={w.busy} onClose={close} onConfirm={() => submit(w.removeChannel)} />;
  if (modal === 'leave') return <ChannelConfirmDialog title={t('leaveTitle', { name: channel.name })} description={t('leaveDescription')} confirmLabel={t('leave')} icon={<SignOut size={23} />} busy={w.busy} onClose={close} onConfirm={() => submit(w.leaveChannel)} />;
  if (typeof modal === 'object' && 'deleteMessage' in modal) return <ChannelConfirmDialog title={t('deleteMessageTitle')} description={t('deleteMessageDescription')} busy={w.busy} onClose={close} onConfirm={() => submit(() => w.mutate(() => channelClient.removeMessage(projectId, channel.id, modal.deleteMessage.id), t('messageDeleted')))} />;
  if (typeof modal === 'object' && 'removeMember' in modal) return <ChannelConfirmDialog title={t('removeMemberTitle', { name: modal.removeMember.name })} description={t('removeMemberDescription')} busy={w.busy} onClose={close} onConfirm={() => submit(() => w.mutate(() => channelClient.removeMember(projectId, channel.id, modal.removeMember.id), t('membersRemoved')))} />;
  return null;
}

function ChannelModelRetry({ workbench: w }: { workbench: ChannelWorkbench }) {
  const retry = w.modelRetry!;
  const options = retry.models.availableModels.filter(model => model.id !== retry.models.currentModelId);
  const [modelId, setModelId] = useState(options[0]?.id ?? '');
  return <ChannelPanelModal title={w.t('chooseAgentModel')} onClose={w.closeModelRetry}>
    <div className={styles.modelRetry}><p>{w.t('agentError_model_unavailable')}</p><label>{retry.member.name}<select value={modelId} aria-label={w.t('chooseAgentModel')} onChange={event => setModelId(event.target.value)}>{options.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>{retry.detail && <details><summary>{w.t('errorDetails')}</summary><pre>{retry.detail}</pre></details>}</div>
    <footer><Button size="sm" variant="outline" onClick={w.closeModelRetry}>{w.t('cancel')}</Button><Button size="sm" disabled={!modelId} onClick={() => w.retryAgent(modelId)}>{w.t('retry')}</Button></footer>
  </ChannelPanelModal>;
}
