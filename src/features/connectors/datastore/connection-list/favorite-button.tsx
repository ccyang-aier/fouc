'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './favorite-button.messages';
import { useState } from 'react';
import { Star } from '@phosphor-icons/react';
import type { ConnectionListProps, ConnectionListRow } from './types';
import styles from './connection-list.module.css';
/** Show the requested star immediately; saving never flashes a disabled cursor or animation. */
export function ConnectionFavoriteButton({
  row,
  pending,
  disabled,
  onFavorite,
}: {
  row: ConnectionListRow;
  pending: boolean;
  disabled: boolean;
  onFavorite: ConnectionListProps['onFavorite'];
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const favorite = optimistic ?? row.favorite;
  async function toggle() {
    if (pending || saving || disabled) return;
    setOptimistic(!favorite);
    setSaving(true);
    try {
      await onFavorite(row, !favorite);
    } catch {
      /* The directory owner reports the failure; restore the saved star below. */
    } finally {
      setOptimistic(null);
      setSaving(false);
    }
  }
  return (
    <button
      type="button"
      className={styles.favoriteButton}
      data-favorite={favorite}
      aria-label={`${favorite ? tConnector('removeFavorite') : tConnector('favorite')} ${row.name}`}
      title={favorite ? tConnector('removeFavorite') : tConnector('favoriteConnection')}
      aria-pressed={favorite}
      aria-busy={saving || undefined}
      disabled={disabled}
      onClick={() => void toggle()}
    >
      <Star size={15} weight={favorite ? 'fill' : 'regular'} />
    </button>
  );
}
