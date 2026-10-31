'use client';

import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { CHANNEL_ICON_NAMES, type Channel, type ChannelIconName, type ChannelMember, type CreateChannelInput, type UpdateChannelInput } from '@fouc/shared/chats';
import type { ProjectMember } from '@fouc/shared/projects';
import type { AgentInstallation, ProviderSpec } from '@fouc/shared';
import { CaretDown, CaretRight, Check, DiceFive, LockSimple, MagnifyingGlass, Plus, Robot, Trash, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppAlert } from '@/components/app-alert-provider';
import { useTranslation } from '@/lib/i18n';
import { ChannelPanelModal } from './channel-panel-modal';
import { ChannelPeoplePicker } from './channel-panel-people-picker';
import { ChannelIcon } from './channel-ui';
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

function movePickerFocus(event: KeyboardEvent<HTMLDivElement>, columns: number) {
  const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns } as Record<string, number>)[event.key];
  if (step === undefined) return;
  const choices = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
  if (!choices.length) return;
  const index = choices.findIndex(choice => choice === document.activeElement);
  event.preventDefault(); event.stopPropagation();
  choices[(Math.max(index, 0) + step + choices.length) % choices.length].focus();
}

export function ChannelFormDialog({ channel, projectMembers, busy, onClose, onSubmit }: {
  channel?: Channel; projectMembers: ProjectMember[]; busy: boolean; onClose: () => void;
  onSubmit: (input: CreateChannelInput | UpdateChannelInput) => Promise<void>;
}) {
  const { t } = useTranslation(panelMessages);
  const run = useDialogSubmit();
  const [name, setName] = useState(channel?.name ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [icon, setIcon] = useState<ChannelIconName>(channel?.icon ?? 'hash');
  const [color, setColor] = useState<Channel['color'] | undefined>(channel?.color);
  const [previewTone] = useState<Channel['color']>(() => {
    const tones = ['blue', 'violet', 'green', 'orange', 'rose'] as const;
    return channel?.color ?? tones[Math.floor(Math.random() * tones.length)];
  });
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const [visibility, setVisibility] = useState<Channel['visibility']>(channel?.visibility ?? 'private');
  const [permissions, setPermissions] = useState(channel?.permissions ?? { invite: 'members' as const, post: 'members' as const });
  const [memberIds, setMemberIds] = useState<string[]>([]);
  function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !name.trim()) return;
    void run(() => onSubmit({ name: name.trim(), description: description.trim(), icon, visibility, ...(color ? { color } : {}), ...(channel ? { permissions } : { memberIds }) }));
  }
  return <ChannelPanelModal title={t(channel ? 'settings' : 'create')} onClose={onClose} busy={busy}>
    <form onSubmit={submit}>
      <div className={styles.dialogBody}>
        <div className={styles.channelIdentity}>
          <DropdownMenu open={iconMenuOpen} onOpenChange={setIconMenuOpen}><DropdownMenuTrigger className={styles.iconPickerTrigger} aria-label={t('chooseIcon')} disabled={busy}>
            <ChannelIcon channel={{ icon, color: color ?? previewTone }} size={34} /><CaretDown size={10} />
          </DropdownMenuTrigger>{iconMenuOpen && <DropdownMenuContent className={styles.iconPickerMenu} density="compact" align="start">
            <DropdownMenuRadioGroup className={styles.iconGrid} value={icon} aria-label={t('icon')} onKeyDown={event => movePickerFocus(event, 8)}>
              {CHANNEL_ICON_NAMES.map(value => <DropdownMenuRadioItem key={value} value={value} className={styles.iconChoice} indicator="none" emphasizeSelection={false} aria-label={t(`icon_${value}`)} onSelect={event => { event.preventDefault(); setIcon(value); }}><ChannelIcon channel={{ icon: value, color: color ?? previewTone }} size={23} /></DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup><DropdownMenuSeparator />
            <DropdownMenuRadioGroup className={styles.colorGrid} value={color ?? 'random'} aria-label={t('color')} onKeyDown={event => movePickerFocus(event, 7)}>
              {!channel && <DropdownMenuRadioItem value="random" className={styles.colorRadio} indicator="none" emphasizeSelection={false} aria-label={t('randomColor')} onSelect={event => { event.preventDefault(); setColor(undefined); }}><DiceFive size={19} /></DropdownMenuRadioItem>}
              {(['violet', 'blue', 'green', 'orange', 'rose', 'slate'] as const).map(value => <DropdownMenuRadioItem key={value} value={value} className={styles.colorRadio} indicator="none" emphasizeSelection={false} aria-label={t(value)} onSelect={event => { event.preventDefault(); setColor(value); }}><ChannelIcon channel={{ icon, color: value }} size={21} /></DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>}</DropdownMenu>
          <label className={styles.field}><span className={styles.identityLabel}>{t('name')}{!channel && !color && <small>{t('randomColor')}</small>}</span><input data-autofocus value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder={t('namePlaceholder')} /></label>
        </div>
        <label className={styles.field}>{t('description')}<textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} placeholder={t('descriptionPlaceholder')} /></label>
        <details className={styles.optionDetails} open={Boolean(channel)}><summary><CaretRight size={12} /><span>{t('channelOptions')}</span><small>{t(visibility === 'private' ? 'private' : 'project')}</small></summary><div>
        <label className={styles.field}>{t('visibility')}<span className={styles.selectWrap}><LockSimple size={16} /><select value={visibility} onChange={event => setVisibility(event.target.value as Channel['visibility'])}><option value="private">{t('private')}</option><option value="project">{t('project')}</option></select></span><small className={styles.fieldHint}>{t(visibility === 'private' ? 'privateHelp' : 'projectHelp')}</small></label>
        </div></details>
        {channel ? <fieldset className={styles.permissionFields}><legend>{t('permissions')}</legend>
          {(['invite', 'post'] as const).map(key => <label key={key} className={styles.permissionRow}><span>{t(key === 'invite' ? 'invitePermission' : 'postPermission')}</span><select aria-label={t(key === 'invite' ? 'invitePermission' : 'postPermission')} value={permissions[key]} onChange={event => setPermissions(current => ({ ...current, [key]: event.target.value as 'members' | 'admins' }))}><option value="members">{t('everyone')}</option><option value="admins">{t('admins')}</option></select></label>)}
        </fieldset> : projectMembers.length > 0 && <details className={styles.optionDetails}><summary><CaretRight size={12} /><span>{t('addInitial')}</span>{memberIds.length > 0 && <small>{t('selected', { count: memberIds.length })}</small>}</summary><div><ChannelPeoplePicker people={projectMembers} selected={memberIds} onChange={setMemberIds} /></div></details>}
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
        <div className={styles.search}><MagnifyingGlass size={16} /><input data-autofocus aria-label={t('searchAgent')} placeholder={t('searchAgent')} value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className={styles.agentOptions}>
          {matching.map(item => {
            const label = providers.find(provider => provider.id === item.providerId)?.name ?? item.providerId;
            const added = joined.has(item.id);
            const unavailable = item.status !== 'ready';
            return <button type="button" key={item.id} className={`fouc-action ${styles.personOption}`} data-surface="plain" aria-pressed={selected === item.id} disabled={added || unavailable} onClick={() => { setSelected(item.id); setName(label); }}>
              <span className={styles.agentAvatar}><Robot size={21} /></span><span className={styles.personIdentity}><strong>{label}</strong><small>{item.version ?? item.providerId}</small></span>{added || unavailable ? <span className={styles.badge}>{t(added ? 'alreadyAdded' : 'agentUnavailable')}</span> : <span className={styles.checkBox}>{selected === item.id && <Check size={12} />}</span>}
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
        <label className={styles.field}>{t('body')}<textarea rows={4} value={body} onChange={event => setBody(event.target.value)} maxLength={20000} placeholder={t('bodyPlaceholder')} required /></label>
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
