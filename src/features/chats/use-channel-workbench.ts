'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
import type { AgentInstallation, ApprovalDto, ModelSnapshotDto, ProviderSpec } from '@fouc/shared';
import type { ChannelMember, ChannelMessage, ChannelSnapshot, SendChannelMessageInput } from '@fouc/shared/chats';
import { useProjectResources } from '@/features/project/project-resources';
import { projectClient } from '@/features/project/project-client';
import { useIdentity } from '@/features/identity/identity-provider';
import { useAppAlert } from '@/components/app-alert-provider';
import { usePageSessionState } from '@/lib/page-session-state';
import { usePageVisible } from '@/lib/page-visibility';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import { ChannelRequestError, channelClient } from './channel-client';
import { useChannelDetail, useChannelDirectory, publishChannelSnapshot, refreshChannelDirectory, forgetChannel, runChannelMutation } from './channel-data';
import { useChannelPreferences } from './channel-preferences';
import { channelNavigation } from './channel-navigation';
import { ChannelAgentRunError, runChannelAgent, type ChannelAgentStatus } from './channel-agent-runner';
import { messages } from './channels.messages';

export type ChannelModal = 'create' | 'settings' | 'invite' | 'agent' | 'poll' | 'topic' | 'deleteChannel' | 'leave' | { deleteMessage: ChannelMessage } | { removeMember: ChannelMember } | null;
export type ChannelPanel = 'search' | 'summary' | 'pins' | { thread: string } | null;

export function useChannelWorkbench() {
  const { t } = useTranslation(messages);
  const { notify } = useAppAlert();
  const project = useProjectResources();
  const identity = useIdentity();
  const visible = usePageVisible();
  const directory = useChannelDirectory();
  const preferences = useChannelPreferences(project.scopeKey);
  const navigation = useSyncExternalStore(channelNavigation.subscribe, channelNavigation.getSnapshot, channelNavigation.getServerSnapshot);
  const linkedChannel = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('channel');
  const [selectedId, setSelectedId] = usePageSessionState<string | null>('channels:selected', linkedChannel, { preferInitial: Boolean(linkedChannel) });
  const [tab, setTab] = usePageSessionState<'conversation' | 'topics' | 'assets' | 'members'>('channels:tab', 'conversation');
  const [modal, setModal] = useState<ChannelModal>(null);
  const [panel, setPanel] = useState<ChannelPanel>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [agents, setAgents] = useState<{ installations: AgentInstallation[]; providers: ProviderSpec[] }>({ installations: [], providers: [] });
  const [agentState, setAgentState] = useState<{ member: ChannelMember; status: ChannelAgentStatus; channelId: string } | null>(null);
  const [approval, setApproval] = useState<{ value: ApprovalDto; resolve: (choice: string | null) => void } | null>(null);
  const [modelRetry, setModelRetry] = useState<{ member: ChannelMember; prompt: string; channelId: string; threadId?: string; models: ModelSnapshotDto; detail?: string } | null>(null);
  const alive = useRef(true);
  const running = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const channels = directory.data?.items ?? [];
  const resolvedId = selectedId ?? channels[0]?.id ?? null;
  const detail = useChannelDetail(resolvedId);
  const snapshot = detail.data;
  const channel = channels.find(item => item.id === resolvedId) ?? (snapshot?.channel.id === resolvedId ? snapshot.channel : null);
  const canUse = project.selectedProject?.source === 'server' && project.principal !== 'guest';
  // Members are read only when a people dialog needs the project directory.
  const people = useQuery({ queryKey: ['channel-project-members', project.scopeKey], queryFn: ({ signal }) => projectClient.members(project.selectedProject!.id, signal), enabled: canUse && (modal === 'create' || modal === 'invite'), retry: false }, peopleQueries);

  useEffect(() => { alive.current = true; return () => { alive.current = false; running.current?.abort(); }; }, []);
  useEffect(() => {
    if (!(detail.error instanceof ChannelRequestError) || ![401, 403, 404].includes(detail.error.status)) return;
    running.current?.abort();
    queueMicrotask(() => { setModal(null); setPanel(null); setModelRetry(null); setApproval(current => { current?.resolve(null); return null; }); });
  }, [detail.error]);
  useEffect(() => {
    if (navigation?.scope !== project.scopeKey) return;
    if (navigation.mode && navigation.channelId) {
      if (selectedId !== navigation.channelId) { queueMicrotask(() => { setSelectedId(navigation.channelId); setModal(null); setPanel(null); }); return; }
      if (directory.isPending) return;
      if (channel?.id !== navigation.channelId) { channelNavigation.consume(navigation.revision); notify('error', t('loadError')); return; }
      if (detail.isError) { channelNavigation.consume(navigation.revision); return; }
      if (!snapshot || snapshot.channel.id !== navigation.channelId) return;
    }
    channelNavigation.consume(navigation.revision);
    queueMicrotask(() => { setSelectedId(navigation.channelId); setTab('conversation'); setPanel(null); if (canUse) setModal(navigation.create ? 'create' : navigation.mode === 'settings' ? 'settings' : navigation.mode === 'delete' ? 'deleteChannel' : null); });
  }, [navigation, project.scopeKey, canUse, setSelectedId, setTab, selectedId, channel?.id, snapshot, directory.isPending, detail.isError, notify, t]);
  const updatedAt = snapshot?.channel.updatedAt;
  const channelId = snapshot?.channel.id;
  useEffect(() => {
    if (visible && channelId && updatedAt) preferences.markRead(channelId, updatedAt);
  }, [channelId, updatedAt, visible, preferences]);

  function select(id: string) { setSelectedId(id); setPanel(null); setModal(null); }
  function accept(next: ChannelSnapshot) { if (project.scopeKey) publishChannelSnapshot(project.scopeKey, next); }
  async function mutate(operation: () => Promise<ChannelSnapshot>, success?: string, create = false) {
    const next = !create && channel && project.scopeKey ? await runChannelMutation(project.scopeKey, channel.id, operation) : await operation();
    if (alive.current) { if (create) accept(next); if (success) notify('success', success); }
    return next;
  }
  async function dialog(operation: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await operation(); if (alive.current) setModal(null); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function action(operation: () => Promise<unknown>, success?: string) {
    try { await operation(); if (success && alive.current) notify('success', success); return true; }
    catch (cause) { if (alive.current) notify('error', t('failed'), cause instanceof Error ? cause.message : undefined); return false; }
  }
  const actor = snapshot?.members.find(member => member.id === snapshot.actorId);
  const ownAgents = snapshot?.members.filter(member => member.active && member.kind === 'agent' && member.agentOwnerId === actor?.userId) ?? [];
  function context(target?: ChannelMessage) {
    const items = (snapshot?.messages ?? []).filter(message => message.kind !== 'summary').slice(-60);
    return items.map(message => `${message.authorName}: ${message.title ? `[${message.title}] ` : ''}${message.body}`).join('\n') + (target ? `\n\n${target.authorName}: ${target.body}` : '');
  }
  async function askAgent(member: ChannelMember, prompt: string, threadId?: string, modelId?: string) {
    if (running.current) { notify('warning', t('agentBusy')); return; }
    if (!member.installationId || !snapshot || !project.scopeKey) return;
    const target = snapshot.channel;
    const controller = new AbortController(); running.current = controller;
    setAgentState({ member, status: 'starting', channelId: target.id });
    try {
      const result = await runChannelAgent({ installationId: member.installationId, prompt, modelId, signal: controller.signal,
        onStatus: status => { if (alive.current) setAgentState({ member, status, channelId: target.id }); },
        onApproval: value => new Promise(resolve => { if (alive.current) setApproval({ value, resolve }); else resolve(null); }),
      });
      if (!controller.signal.aborted && alive.current) {
        await runChannelMutation(project.scopeKey, target.id, () => channelClient.agentMessage(target.projectId, target.id, member.id, { body: result.text, ...(threadId ? { threadId } : {}), execution: { sessionId: result.sessionId, runId: result.runId } }));
      }
    } catch (cause) {
      if (alive.current && cause instanceof ChannelAgentRunError && cause.code === 'model_unavailable' && cause.models?.availableModels.length) setModelRetry({ member, prompt, channelId: target.id, threadId, models: cause.models, detail: cause.detail });
      else if (alive.current && !(cause instanceof ChannelAgentRunError && cause.code === 'cancelled')) notify('error', t('agentFailed'), cause instanceof ChannelAgentRunError ? [t(`agentError_${cause.code}`), cause.detail].filter(Boolean).join('\n') : t('failed'));
    } finally { running.current = null; if (alive.current) { setAgentState(null); setApproval(null); } }
  }
  async function send(input: SendChannelMessageInput, files: File[] = []) {
    if (!channel || !project.selectedProject || sending) return false;
    setSending(true);
    try {
      const next = await mutate(() => channelClient.send(channel.projectId, channel.id, input, files));
      const mentioned = ownAgents.find(member => input.body?.includes(`@${member.name}`));
      if (mentioned) void askAgent(mentioned, t('agentRequest', { channel: channel.name, context: next.messages.slice(-60).map(message => `${message.authorName}: ${message.body}`).join('\n') }), input.threadId);
      return true;
    } catch (cause) { if (alive.current) notify('error', t('failed'), cause instanceof Error ? cause.message : undefined); return false; }
    finally { if (alive.current) setSending(false); }
  }
  async function openAgentDialog() {
    setBusy(true);
    try {
      const [installations, providers] = await Promise.all([backendFetch<AgentInstallation[]>('/api/agents/installations'), backendFetch<ProviderSpec[]>('/api/agents/providers')]);
      if (alive.current) { setAgents({ installations, providers }); setModal('agent'); }
    } catch (cause) { notify('error', t('failed'), cause instanceof Error ? cause.message : undefined); }
    finally { if (alive.current) setBusy(false); }
  }
  async function removeChannel() {
    if (!channel || !project.scopeKey) return;
    await channelClient.remove(channel.projectId, channel.id);
    forgetChannel(project.scopeKey, channel.id); setSelectedId(channels.find(item => item.id !== channel.id)?.id ?? ''); notify('success', t('deleted'));
  }
  async function leaveChannel() {
    if (!channel || !snapshot || !project.scopeKey) return;
    await channelClient.leave(channel.projectId, channel.id, snapshot.actorId);
    running.current?.abort(); forgetChannel(project.scopeKey, channel.id); setSelectedId(''); notify('success', t('left'));
  }
  return { t, notify, project, identity, canUse, directory, channels, channel, snapshot, detail, preferences, people, agents,
    selectedId, select, tab, setTab, modal,
    setModal(value: ChannelModal) { if (value && channel) setSelectedId(channel.id); setModal(value); }, panel, setPanel,
    busy, sending, dialog, mutate, action, accept, send, openAgentDialog, removeChannel, leaveChannel, ownAgents, askAgent, context,
    agentState, cancelAgent: () => running.current?.abort(), approval, closeApproval(choice: string | null) { approval?.resolve(choice); setApproval(null); },
    modelRetry, closeModelRetry: () => setModelRetry(null), retryAgent(modelId: string) { const retry = modelRetry; setModelRetry(null); if (retry && retry.channelId === channel?.id) void askAgent(retry.member, retry.prompt, retry.threadId, modelId); },
    refresh: () => project.scopeKey ? refreshChannelDirectory(project.scopeKey) : Promise.resolve(),
  };
}

// People queries use the same cache but never share authenticated project keys.
const peopleQueries = new QueryClient();
export type ChannelWorkbench = ReturnType<typeof useChannelWorkbench>;
