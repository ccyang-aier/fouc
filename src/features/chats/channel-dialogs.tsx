'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { Channel, ChannelMember, CreateChannelInput, UpdateChannelInput } from '@fouc/shared/chats';
import type { ProjectMember } from '@fouc/shared/projects';
import type { AgentInstallation, ProviderSpec } from '@fouc/shared';
import { CaretRight, Check, Hash, LockSimple, MagnifyingGlass, Plus, Robot, Trash, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAppAlert } from '@/components/app-alert-provider';
import { useTranslation } from '@/lib/i18n';
import { ChannelPanelModal } from './channel-panel-modal';
import { ChannelPeoplePicker } from './channel-panel-people-picker';
import { panelMessages } from './channel-panels.messages';
import styles from './channel-panels.module.css';

function useDialogSubmit() {
  const { notify } = useAppAlert();
  const { t } = useTranslation(panelMessages);
  return async (operation: () => Promise<void>) => {
    try { await operation(); }
    catch (cause) { notify('error', cause instanceof Error ? cause.message : t('requestFailed')); }
  };
}

export function ChannelFormDialog({ channel, projectMembers, busy, onClose, onSubmit }: {
  channel?: Channel; projectMembers: ProjectMember[]; busy: boolean; onClose: () => void;
  onSubmit: (input: CreateChannelInput | UpdateChannelInput) => Promise<void>;
}) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  const [name, setName] = useState(channel?.name ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [color, setColor] = useState<Channel['color']>(channel?.color ?? 'violet');
  const [visibility, setVisibility] = useState<Channel['visibility']>(channel?.visibility ?? 'private');
  const [permissions, setPermissions] = useState(channel?.permissions ?? { invite: 'members' as const, post: 'members' as const });
  const [memberIds, setMemberIds] = useState<string[]>([]);
  function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !name.trim()) return;
    void run(() => onSubmit({ name: name.trim(), description: description.trim(), color, visibility, ...(channel ? { permissions } : { memberIds }) }));
  }
  return <ChannelPanelModal title={t(channel ? 'settings' : 'create')} onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <div className={styles.dialogBody}>
        <label className={styles.field}>{t('name')}<div className={styles.nameInput}><Hash size={17} aria-hidden /><input data-autofocus value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder={t('namePlaceholder')} /></div></label>
        <label className={styles.field}>{t('description')}<textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} placeholder={t('descriptionPlaceholder')} /></label>
        <details className={styles.optionDetails} open={Boolean(channel)}><summary><CaretRight size={12} /><span>{t('channelOptions')}</span><small>{t(visibility === 'private' ? 'private' : 'project')}</small></summary><div>
        <fieldset className={styles.colorField}><legend>{t('color')}</legend><div className={styles.colors}>
          {(['violet', 'blue', 'green', 'orange', 'rose', 'slate'] as const).map(value => <button key={value} type="button" className={`fouc-action ${styles.colorChoice}`} data-color={value} aria-label={t(value)} aria-pressed={color === value} onClick={() => setColor(value)}><Hash size={18} />{color === value && <Check size={10} weight="bold" className={styles.colorCheck} />}</button>)}
        </div></fieldset>
        <label className={styles.field}>{t('visibility')}<span className={styles.selectWrap}><LockSimple size={16} /><select value={visibility} onChange={event => setVisibility(event.target.value as Channel['visibility'])}><option value="private">{t('private')}</option><option value="project">{t('project')}</option></select></span><small className={styles.fieldHint}>{t(visibility === 'private' ? 'privateHelp' : 'projectHelp')}</small></label>
        </div></details>
        {channel ? <fieldset className={styles.permissionFields}><legend>{t('permissions')}</legend>
          {(['invite', 'post'] as const).map(key => <label key={key} className={styles.permissionRow}><span>{t(key === 'invite' ? 'invitePermission' : 'postPermission')}</span><select aria-label={t(key === 'invite' ? 'invitePermission' : 'postPermission')} value={permissions[key]} onChange={event => setPermissions(current => ({ ...current, [key]: event.target.value as 'members' | 'admins' }))}><option value="members">{t('everyone')}</option><option value="admins">{t('admins')}</option></select></label>)}
        </fieldset> : projectMembers.length > 0 && <div className={styles.field}><span>{t('addInitial')}</span><ChannelPeoplePicker people={projectMembers} selected={memberIds} onChange={setMemberIds} /></div>}
      </div>
      <footer><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('cancel')}</Button><Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>{t(channel ? 'save' : 'create')}</Button></footer>
    </form>
  </ChannelPanelModal>;
}

export function ChannelInviteDialog({ members, projectMembers, busy, onClose, onInvite }: {
  members: ChannelMember[]; projectMembers: ProjectMember[]; busy: boolean; onClose: () => void; onInvite: (userIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  const [selected, setSelected] = useState<string[]>([]);
  const joined = new Set(members.filter(member => member.active && member.kind === 'user').map(member => member.userId));
  return <ChannelPanelModal title={t('addPeople')} onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); if (!busy && selected.length) void run(() => onInvite(selected)); }}>
      <div className={styles.dialogBody}><ChannelPeoplePicker autoFocus people={projectMembers.filter(member => !joined.has(member.userId))} selected={selected} onChange={setSelected} emptyLabel={t('allJoined')} /></div>
      <footer><span className={styles.footerNote}>{t('selected', { count: selected.length })}</span><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('cancel')}</Button><Button type="submit" size="sm" loading={busy} disabled={!selected.length}>{t('invite')}</Button></footer>
    </form>
  </ChannelPanelModal>;
}

export function ChannelAgentDialog({ members, installations, providers, actorUserId, busy, onClose, onAdd }: {
  members: ChannelMember[]; installations: AgentInstallation[]; providers: ProviderSpec[]; busy: boolean;
  actorUserId?: string; onClose: () => void; onAdd: (installation: AgentInstallation, name: string) => Promise<void>;
}) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const joined = new Set(members.filter(member => member.active && member.kind === 'agent' && (!actorUserId || member.agentOwnerId === actorUserId)).map(member => member.installationId));
  const available = installations.filter(installation => installation.enabled && installation.status !== 'missing' && installation.status !== 'disabled');
  const matching = available.filter(installation => `${providers.find(provider => provider.id === installation.providerId)?.name ?? installation.providerId} ${installation.version ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const installation = available.find(item => item.id === selected);
  return <ChannelPanelModal title={t('agentTitle')} onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); if (!busy && installation?.status === 'ready' && name.trim()) void run(() => onAdd(installation, name.trim())); }}>
      <div className={styles.dialogBody}>
        <p className={styles.hint}>{t('agentDescription')}</p>
        <div className={styles.search}><MagnifyingGlass size={16} /><input data-autofocus aria-label={t('searchAgent')} placeholder={t('searchAgent')} value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className={styles.agentOptions}>
          {matching.map(item => {
            const label = providers.find(provider => provider.id === item.providerId)?.name ?? item.providerId;
            const added = joined.has(item.id);
            const unavailable = item.status !== 'ready';
            return <button type="button" key={item.id} className={`fouc-action ${styles.personOption}`} data-surface="plain" aria-pressed={selected === item.id} disabled={added || unavailable} onClick={() => { setSelected(item.id); setName(label); }}>
              <span className={styles.agentAvatar}><Robot size={21} /></span><span className={styles.personIdentity}><strong>{label}</strong><small>{item.version ?? item.providerId}</small></span>{added || unavailable ? <span className={styles.badge}>{t(added ? 'alreadyAdded' : 'agentUnavailable')}</span> : <span className={styles.checkBox}>{selected === item.id && <Check size={12} weight="bold" />}</span>}
            </button>;
          })}
          {!matching.length && <div className={styles.emptySmall}><Robot size={27} /><strong>{t('noAgents')}</strong><span>{t('noAgentsHelp')}</span></div>}
        </div>
        {installation && <label className={styles.field}>{t('agentName')}<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>}
      </div>
      <footer><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('cancel')}</Button><Button type="submit" size="sm" loading={busy} disabled={!installation || installation.status !== 'ready' || !name.trim()}>{t('addAgent')}</Button></footer>
    </form>
  </ChannelPanelModal>;
}

export function ChannelPollDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (question: string, options: string[]) => Promise<void> }) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([{ id: 'one', text: '' }, { id: 'two', text: '' }]);
  const populated = options.map(option => option.text.trim().toLocaleLowerCase()).filter(Boolean);
  const duplicated = new Set(populated).size !== populated.length;
  const valid = question.trim() && populated.length === options.length && !duplicated;
  return <ChannelPanelModal title={t('pollTitle')} onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); if (!busy && valid) void run(() => onSubmit(question.trim(), options.map(option => option.text.trim()))); }}>
      <div className={styles.dialogBody}>
        <label className={styles.field}>{t('question')}<input data-autofocus value={question} readOnly={busy} onChange={event => setQuestion(event.target.value)} placeholder={t('questionPlaceholder')} maxLength={300} required /></label>
        <fieldset className={styles.pollOptions}><legend>{t('options')}</legend>{options.map((option, index) => <div className={styles.pollOption} key={option.id}><input aria-label={t('option', { index: index + 1 })} placeholder={t('option', { index: index + 1 })} value={option.text} readOnly={busy} maxLength={200} required onChange={event => setOptions(current => current.map(item => item.id === option.id ? { ...item, text: event.target.value } : item))} />{options.length > 2 && <Button type="button" variant="ghost" size="icon-sm" data-surface="plain" disabled={busy} aria-label={t('removeOption', { index: index + 1 })} onClick={() => setOptions(current => current.filter(item => item.id !== option.id))}><X size={15} /></Button>}</div>)}</fieldset>
        {options.length < 10 && <Button type="button" variant="ghost" size="sm" data-surface="plain" className={styles.addOption} disabled={busy} onClick={() => setOptions(current => [...current, { id: crypto.randomUUID(), text: '' }])}><Plus size={15} />{t('addOption')}</Button>}
        <p className={duplicated ? styles.fieldError : styles.hint} role={duplicated ? 'alert' : undefined}>{t(duplicated ? 'duplicateOptions' : 'pollHint')}</p>
      </div>
      <footer><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('cancel')}</Button><Button type="submit" size="sm" loading={busy} disabled={!valid}>{t('publishPoll')}</Button></footer>
    </form>
  </ChannelPanelModal>;
}

export function ChannelTopicDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (title: string, body: string) => Promise<void> }) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return <ChannelPanelModal title={t('topicTitle')} onClose={onClose} busy={busy}>
    <form onSubmit={event => { event.preventDefault(); if (!busy && title.trim() && body.trim()) void run(() => onSubmit(title.trim(), body.trim())); }}>
      <div className={styles.dialogBody}>
        <label className={styles.field}>{t('title')}<input data-autofocus value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder={t('titlePlaceholder')} required /></label>
        <label className={styles.field}>{t('body')}<textarea rows={6} value={body} onChange={event => setBody(event.target.value)} maxLength={20000} placeholder={t('bodyPlaceholder')} required /></label>
      </div>
      <footer><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('cancel')}</Button><Button type="submit" size="sm" loading={busy} disabled={!title.trim() || !body.trim()}>{t('publishTopic')}</Button></footer>
    </form>
  </ChannelPanelModal>;
}

export function ChannelConfirmDialog({ title, description, busy, onClose, onConfirm, confirmLabel, icon }: { title: string; description: string; busy: boolean; onClose: () => void; onConfirm: () => Promise<void>; confirmLabel?: string; icon?: ReactNode }) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  return <ChannelPanelModal title={title} onClose={onClose} busy={busy} alert>
    <div className={styles.confirmBody}><span className={styles.dangerIcon}>{icon ?? <Trash size={23} />}</span><p>{description}</p></div>
    <footer><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose} data-autofocus>{t('cancel')}</Button><Button type="button" variant="ghost" size="sm" data-variant="destructive" className={styles.danger} loading={busy} onClick={() => void run(onConfirm)}>{confirmLabel ?? t('confirm')}</Button></footer>
  </ChannelPanelModal>;
}
