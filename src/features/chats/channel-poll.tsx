'use client';

import { useId, useRef, useState } from 'react';
import { ChartBar, CheckCircle, Circle, LockSimple, Users } from '@phosphor-icons/react';
import type { ChannelMember, ChannelPoll } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import cardStyles from '@/components/ui/resource-card.module.css';
import { ChannelAvatar } from './channel-ui';
import { messages } from './channels.messages';
import styles from './channel-poll.module.css';

export function ChannelPollCard({ poll, actorId, members, canVote, onVote }: {
  poll: ChannelPoll; actorId: string; members: ChannelMember[]; canVote: boolean;
  onVote: (optionId: string) => Promise<boolean>;
}) {
  const { t } = useTranslation(messages);
  const id = useId();
  const locked = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const voted = poll.options.some(option => option.voterIds.includes(actorId));
  const voters = [...new Set(poll.options.flatMap(option => option.voterIds))];
  const portraits = voters.map(voter => members.find(member => member.id === voter)).filter(member => member !== undefined).slice(0, 3);
  const showResults = voted || poll.closed;

  async function choose(optionId: string) {
    if (locked.current || poll.closed || !canVote) return;
    locked.current = true;
    setPending(optionId);
    try { await onVote(optionId); }
    finally { locked.current = false; setPending(null); }
  }

  return <section className={`${cardStyles.card} ${styles.poll}`} aria-labelledby={`${id}-question`}>
    <div className={styles.label}><ChartBar size={15} aria-hidden /><span>{t('singleChoicePoll')}</span>{poll.closed && <span className={styles.closed}><LockSimple size={11} aria-hidden />{t('closed')}</span>}</div>
    <h4 id={`${id}-question`}>{poll.question}</h4>
    <div className={styles.options} role="group" aria-labelledby={`${id}-question`} aria-describedby={`${id}-hint`}>
      {poll.options.map(option => {
        const selected = option.voterIds.includes(actorId);
        const percentage = voters.length ? Math.round(option.voterIds.length / voters.length * 100) : 0;
        return <Button type="button" key={option.id} variant="ghost" className={styles.option}
          aria-pressed={selected} disabled={poll.closed || !canVote || pending !== null} loading={pending === option.id} onClick={() => void choose(option.id)}>
          <span className={styles.optionContent}>
            {selected ? <CheckCircle className={styles.marker} size={19} weight="fill" aria-hidden /> : <Circle className={styles.marker} size={19} aria-hidden />}
            <span className={styles.optionLabel}>{option.text}</span>
            {showResults && <span className={styles.percentage}>{percentage}%</span>}
          </span>
          {showResults && <span className={styles.resultFill} aria-hidden style={{ transform: `scaleX(${percentage / 100})` }} />}
        </Button>;
      })}
    </div>
    <div className={styles.footer}>
      <span className={styles.voters}>{portraits.length ? <span className={styles.portraits} aria-hidden>{portraits.map(member => <ChannelAvatar key={member.id} member={member} size={20} />)}</span> : <Users size={14} aria-hidden />}{t('votes', { count: voters.length })}</span>
      {voted && <span className={styles.voted}><CheckCircle size={12} weight="fill" aria-hidden />{t('voted')}</span>}
    </div>
    <p id={`${id}-hint`} className={styles.hint}>{t(poll.closed ? 'pollClosedHint' : !canVote ? 'restricted' : voted ? 'voteChangeHint' : 'voteChooseHint')}</p>
  </section>;
}
