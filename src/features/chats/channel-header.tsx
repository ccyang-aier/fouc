'use client';

import { BellSimpleSlash, ChatCircleDots, ChatCircleText, Files, UsersThree } from '@phosphor-icons/react';
import { ChannelSwitcher } from './channel-switcher';
import { ChannelHeaderActions } from './channel-header-actions';
import type { ChannelWorkbench } from './use-channel-workbench';
import styles from './channels.module.css';

export function ChannelHeader({ workbench: w }: { workbench: ChannelWorkbench }) {
  const { t, channel, snapshot } = w;
  const active = snapshot?.members.filter(member => member.active) ?? [];
  const assets = snapshot?.messages.flatMap(message => message.attachments).length ?? 0;
  return <>
    <header className={styles.header}>
      <span className={styles.chatLabel}><ChatCircleDots size={15} weight="bold" />{t('channels')}</span>
      {channel && <><span className={styles.headerSlash} aria-hidden>/</span><ChannelSwitcher workbench={w} /></>}
      {channel && w.preferences.muted.includes(channel.id) && <BellSimpleSlash className={styles.channelState} size={12} aria-label={t('muted')} />}
      {channel && <><span className={styles.headerSlash} aria-hidden>/</span><span className={styles.headerContext}>{t(w.tab)}</span></>}
      <ChannelHeaderActions workbench={w} members={active} />
    </header>
    {channel && <nav className={styles.tabs} role="tablist" aria-label={channel.name}>
      {([{ key: 'conversation', Icon: ChatCircleDots }, { key: 'topics', Icon: ChatCircleText }, { key: 'assets', Icon: Files }, { key: 'members', Icon: UsersThree }] as const).map(({ key, Icon }) => <button type="button" role="tab" key={key} className={`fouc-action ${styles.tab}`} aria-selected={w.tab === key} onClick={() => { w.setTab(key); w.setPanel(null); }}><Icon size={14} weight="bold" />{t(key)}{key === 'assets' && assets > 0 && <small>{assets}</small>}{key === 'members' && <small>{active.length}</small>}</button>)}
    </nav>}
  </>;
}
