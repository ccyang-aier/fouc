'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Star } from '@phosphor-icons/react';
import styles from './document-star-button.module.css';

const rays = [[0, -22], [16, -16], [22, 0], [16, 16], [0, 22], [-16, 16], [-22, 0], [-16, -16]];

export function DocumentStarButton({ starred, onToggle }: { starred: boolean; onToggle: () => void }) {
  const [celebrating, setCelebrating] = useState(false);
  const label = starred ? '取消星标' : '添加星标';

  return <button
    type="button"
    className={styles.button}
    aria-label={label}
    title={label}
    aria-pressed={starred}
    data-celebrating={celebrating && starred || undefined}
    onClick={() => { setCelebrating(!starred); onToggle(); }}
  >
    <Star className={styles.star} aria-hidden size={18} weight={starred ? 'fill' : 'bold'} onAnimationEnd={() => setCelebrating(false)} />
    {celebrating && starred ? <span className={styles.burst} aria-hidden>
      {rays.map(([x, y], index) => <span key={index} className={styles.ray} style={{ '--ray-x': `${x}px`, '--ray-y': `${y}px`, '--ray-angle': `${index * 45}deg`, '--ray-delay': `${index % 2 * 30}ms` } as CSSProperties} />)}
      <span className={styles.sparkle}>✦</span>
    </span> : null}
  </button>;
}
