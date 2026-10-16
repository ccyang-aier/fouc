import type { CSSProperties } from 'react';
import { Brain, Code, Leaf, Sparkle, StarFour } from '@phosphor-icons/react';
import type { ChatExecutionOption } from './chat-execution-options';
import styles from './chat-execution-logo.module.css';

export function ChatExecutionLogo({ option: { brand }, size = 18 }: { option: ChatExecutionOption; size?: number }) {
  const Icon = brand === 'auto' ? StarFour : brand === 'codey' ? Code : brand === 'sage' ? Leaf : brand === 'model' ? Brain : Sparkle;
  return <span className={styles.logo} data-brand={brand} style={{ '--logo-size': `${size}px` } as CSSProperties} aria-hidden="true">
    {['auto', 'nova', 'codey', 'sage', 'model'].includes(brand) ? <Icon weight={brand === 'auto' ? 'regular' : 'fill'} /> :
      <span className={styles.brandMask} style={{ '--brand-logo': `url(/agent-logos/ai-major/${brand}.svg)` } as CSSProperties} />}
  </span>;
}
