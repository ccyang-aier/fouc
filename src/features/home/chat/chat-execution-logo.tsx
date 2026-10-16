import type { CSSProperties } from 'react';
import { Brain, Code, Leaf, Sparkle } from '@phosphor-icons/react';
import type { ChatExecutionOption } from './chat-execution-options';
import styles from './chat-execution-logo.module.css';

export function ChatExecutionLogo({ option: { brand }, size = 18 }: { option: ChatExecutionOption; size?: number }) {
  const Icon = brand === 'codey' ? Code : brand === 'sage' ? Leaf : brand === 'model' ? Brain : Sparkle;
  return <span className={styles.logo} data-brand={brand} style={{ '--logo-size': `${size}px` } as CSSProperties} aria-hidden="true">
    {brand === 'auto' ? <svg viewBox="0 0 24 24" fill="none"><path d="M12 2.75C13.4 8.5 15.5 10.6 21.25 12C15.5 13.4 13.4 15.5 12 21.25C10.6 15.5 8.5 13.4 2.75 12C8.5 10.6 10.6 8.5 12 2.75Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" /></svg> :
    ['nova', 'codey', 'sage', 'model'].includes(brand) ? <Icon weight="fill" /> :
      <span className={styles.brandMask} style={{ '--brand-logo': `url(/agent-logos/ai-major/${brand}.svg)` } as CSSProperties} />}
  </span>;
}
