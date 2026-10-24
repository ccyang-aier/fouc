'use client';

import { useState } from 'react';
import type { ChannelAttachment, ChannelMember, ChannelSnapshot } from '@fouc/shared/chats';
import { ArrowUpRight, ChatCircleDots, DotsThree, DownloadSimple, File, FileCode, FilePdf, FileText, FolderOpen, ImageSquare, MagnifyingGlass, Robot, ShieldCheck, UserMinus, UserPlus, UsersThree } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ViewSwitcher, type ViewMode } from '@/components/ui/view-switcher';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import cardStyles from '@/components/ui/resource-card.module.css';
import { panelMessages } from './channel-panels.messages';
import styles from './channel-panels.module.css';

type AssetType = 'all' | 'documents' | 'images' | 'other';
function assetType(asset: ChannelAttachment): Exclude<AssetType, 'all'> {
  if (asset.mime.startsWith('image/')) return 'images';
  return /(?:pdf|word|document|text|sheet|presentation|json|csv|markdown)/i.test(asset.mime) || /\.(?:docx?|xlsx?|pptx?|pdf|md|txt|csv|json)$/i.test(asset.name) ? 'documents' : 'other';
}
function FileIcon({ asset }: { asset: ChannelAttachment }) {
  const Icon = assetType(asset) === 'images' ? ImageSquare : /pdf/i.test(asset.mime) ? FilePdf : /(?:json|javascript|html|css)/i.test(asset.mime) ? FileCode : assetType(asset) === 'documents' ? FileText : File;
  return <span className={styles.fileIcon} data-type={assetType(asset)}><Icon size={25} weight="regular" aria-hidden /></span>;
}
function fileSize(size: number, locale: string) {
  const unit = size >= 1024 * 1024 ? 'MB' : 'KB';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size / (unit === 'MB' ? 1024 * 1024 : 1024))} ${unit}`;
}

export function ChannelAssets({ snapshot, assets: suppliedAssets, onOpen, onDownload, onJump }: {
  snapshot: ChannelSnapshot; assets?: ChannelAttachment[]; onOpen: (attachment: ChannelAttachment, messageId: string) => void; onDownload?: (attachment: ChannelAttachment) => void; onJump: (messageId: string) => void;
}) {
  const { t, locale } = useTranslation(panelMessages);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AssetType>('all');
  const [mode, setMode] = useState<ViewMode>('grid');
  const assets = suppliedAssets ? suppliedAssets.map(attachment => ({ attachment, message: snapshot.messages.find(message => message.id === attachment.messageId) })) : snapshot.messages.flatMap(message => message.attachments.map(attachment => ({ attachment, message })));
  const term = search.trim().toLocaleLowerCase();
  const matching = assets.filter(({ attachment, message }) => (type === 'all' || assetType(attachment) === type) && `${attachment.name} ${message?.authorName ?? ''}`.toLocaleLowerCase().includes(term));
  const filtered = Boolean(term || type !== 'all');
  const date = (createdAt: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(createdAt));
  return <section className={styles.panel} aria-label={t('assets')}>
    <header className={styles.panelHeader}><div><h2>{t('assets')}<span>{t('assetCount', { count: assets.length })}</span></h2><p>{t('assetHint')}</p></div></header>
    <div className={styles.assetToolbar}><div className={styles.filters} role="group" aria-label={t('assets')}>
      {(['all', 'documents', 'images', 'other'] as const).map(value => <button type="button" key={value} className={`fouc-action ${styles.filter}`} data-surface="plain" aria-pressed={type === value} onClick={() => setType(value)}>{t(value)}</button>)}
    </div><div className={styles.toolbarRight}><div className={styles.search}><MagnifyingGlass size={15} aria-hidden /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('searchAssets')} aria-label={t('searchAssets')} /></div><ViewSwitcher value={mode} onValueChange={setMode} /></div></div>
    {!matching.length ? <div className={styles.panelEmpty}><FolderOpen size={36} weight="regular" /><h3>{t(filtered ? 'noResults' : 'noAssets')}</h3>{!filtered && <p>{t('noAssetsHelp')}</p>}{filtered && <Button type="button" variant="outline" size="sm" onClick={() => { setSearch(''); setType('all'); }}>{t('resetSearch')}</Button>}</div>
      : mode === 'grid' ? <ul className={styles.assetsGrid}>{matching.map(({ attachment, message }) => <li key={attachment.id} className={`${cardStyles.card} ${styles.assetCard}`}>
        <button type="button" className={`fouc-action ${styles.assetMain}`} data-surface="plain" onClick={() => onOpen(attachment, attachment.messageId)} aria-label={t('preview', { name: attachment.name })}><FileIcon asset={attachment} /><strong title={attachment.name}>{attachment.name}</strong><span>{fileSize(attachment.size, locale)}<span>·</span>{attachment.name.split('.').at(-1)?.toUpperCase()}</span></button>
        <div className={styles.assetFooter}>{message && <UserAvatar name={message.authorName} image={message.authorImage} className={styles.tinyAvatar} />}<span>{message?.authorName ?? t('channelFile')}</span><time dateTime={attachment.createdAt}>{date(attachment.createdAt)}</time><DropdownMenu><DropdownMenuTrigger className={styles.iconButton} aria-label={attachment.name}><DotsThree size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact"><DropdownMenuGroup><DropdownMenuItem disabled={!onDownload} onSelect={() => onDownload?.(attachment)}><DownloadSimple />{t('downloadAction')}</DropdownMenuItem><DropdownMenuItem onSelect={() => onJump(attachment.messageId)}><ChatCircleDots />{t('origin')}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu></div>
      </li>)}</ul> : <div className={styles.tableScroll}><table className={styles.assetTable}><thead><tr><th>{t('assetName')}</th><th>{t('sharedBy')}</th><th>{t('sharedAt')}</th><th>{t('size')}</th><th><span className="sr-only">{t('downloadAction')}</span></th></tr></thead><tbody>{matching.map(({ attachment, message }) => <tr key={attachment.id}>
        <td><button type="button" className={`fouc-action ${styles.assetName}`} aria-label={t('preview', { name: attachment.name })} onClick={() => onOpen(attachment, attachment.messageId)}><FileIcon asset={attachment} /><span>{attachment.name}</span></button></td><td><span className={styles.tablePerson}>{message && <UserAvatar name={message.authorName} image={message.authorImage} className={styles.tinyAvatar} />}{message?.authorName ?? t('channelFile')}</span></td><td><time dateTime={attachment.createdAt}>{date(attachment.createdAt)}</time></td><td>{fileSize(attachment.size, locale)}</td><td><Button type="button" variant="ghost" size="icon-sm" data-surface="plain" aria-label={t('origin')} onClick={() => onJump(attachment.messageId)}><ArrowUpRight size={16} /></Button><Button type="button" variant="ghost" size="icon-sm" data-surface="plain" disabled={!onDownload} aria-label={t('download', { name: attachment.name })} onClick={() => onDownload?.(attachment)}><DownloadSimple size={16} /></Button></td>
      </tr>)}</tbody></table></div>}
  </section>;
}

function MemberActions({ member, snapshot, onRole, onRemove }: {
  member: ChannelMember; snapshot: ChannelSnapshot; onRole: (id: string, role: 'admin' | 'member') => void; onRemove: (id: string) => void;
}) {
  const { t } = useTranslation(panelMessages);
  const actor = snapshot.members.find(item => item.id === snapshot.actorId);
  const canManage = member.role !== 'owner' && (snapshot.actorRole === 'owner' || (snapshot.actorRole === 'admin' && member.role === 'member'));
  const ownAgent = member.kind === 'agent' && member.agentOwnerId === actor?.userId;
  const canChangeRole = snapshot.actorRole === 'owner' && member.role !== 'owner' && member.kind === 'user' && member.id !== snapshot.actorId;
  if (!canManage && !ownAgent) return null;
  return <DropdownMenu><DropdownMenuTrigger className={styles.iconButton} aria-label={t('memberActions', { name: member.name })}><DotsThree size={19} /></DropdownMenuTrigger><DropdownMenuContent density="compact" align="end"><DropdownMenuGroup>
    {canChangeRole && <><DropdownMenuItem onSelect={() => onRole(member.id, member.role === 'admin' ? 'member' : 'admin')}><ShieldCheck />{t(member.role === 'admin' ? 'demote' : 'promote')}</DropdownMenuItem><DropdownMenuSeparator /></>}
    <DropdownMenuItem variant="destructive" onSelect={() => onRemove(member.id)}><UserMinus />{t('removeMember')}</DropdownMenuItem>
  </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>;
}

export function ChannelMembers({ snapshot, onInvite, onAddAgent, onRole, onRemove }: {
  snapshot: ChannelSnapshot; onInvite: () => void; onAddAgent: () => void;
  onRole: (memberId: string, role: 'admin' | 'member') => void; onRemove: (memberId: string) => void;
}) {
  const { t, locale } = useTranslation(panelMessages);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'people' | 'agents'>('all');
  const members = snapshot.members.filter(member => member.active);
  const people = members.filter(member => member.kind === 'user');
  const agents = members.filter(member => member.kind === 'agent');
  const term = search.trim().toLocaleLowerCase();
  const matching = members.filter(member => (filter === 'all' || member.kind === (filter === 'people' ? 'user' : 'agent')) && member.name.toLocaleLowerCase().includes(term));
  const canInvite = snapshot.actorRole !== 'member' || snapshot.channel.permissions.invite === 'members';
  const joined = (value: string) => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
  return <section className={styles.panel} aria-label={t('members')}>
    <header className={styles.panelHeader}><div><h2>{t('members')}</h2><p>{t('memberCount', { people: people.length, agents: agents.length })}</p></div><div className={styles.headerActions}><Button type="button" variant="outline" size="sm" onClick={onAddAgent}><Robot size={15} />{t('addAgent')}</Button>{canInvite && <Button type="button" variant="outline" size="sm" onClick={onInvite}><UserPlus size={15} />{t('addPeople')}</Button>}</div></header>
    <div className={styles.assetToolbar}><div className={styles.filters} role="group" aria-label={t('members')}>
      {(['all', 'people', 'agents'] as const).map(value => <button type="button" className={`fouc-action ${styles.filter}`} data-surface="plain" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{t(value)}<span>{value === 'all' ? members.length : value === 'people' ? people.length : agents.length}</span></button>)}
    </div><div className={styles.search}><MagnifyingGlass size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('searchMembers')} aria-label={t('searchMembers')} /></div></div>
    <ul className={styles.memberList}>{matching.map(member => {
      const owner = snapshot.members.find(item => item.kind === 'user' && item.userId === member.agentOwnerId);
      return <li className={styles.memberRow} key={member.id}><div className={styles.avatarWrap}><UserAvatar name={member.name} image={member.image} className={styles.memberAvatar} />{member.kind === 'agent' && <span className={styles.robotMark}><Robot size={11} /></span>}</div><span className={styles.memberIdentity}><strong>{member.name}{member.id === snapshot.actorId && <small>{t('yours')}</small>}{member.kind === 'agent' && <span className={styles.agentBadge}>Agent</span>}</strong><small>{member.kind === 'agent' ? t('ownedBy', { name: owner?.name ?? t('removedOwner') }) : t('joined', { date: joined(member.joinedAt) })}</small></span><span className={styles.role} data-role={member.role}>{member.role === 'owner' && <ShieldCheck size={13} />}{t(member.role)}</span><MemberActions member={member} snapshot={snapshot} onRole={onRole} onRemove={onRemove} /></li>;
    })}</ul>
    {!matching.length && <div className={styles.panelEmpty}><UsersThree size={32} /><h3>{t('noMembers')}</h3><Button type="button" variant="outline" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>{t('resetSearch')}</Button></div>}
  </section>;
}
