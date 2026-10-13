'use client';

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { dashboardPeople, type DashboardPersonId } from './dashboard-model';
import styles from './dashboard-ui.module.css';

export function ReferenceIcon({ name, size = 20 }: { name: 'dashboard' | 'invoice' | 'proposal' | 'contract' | 'form' | 'project'; size?: number }) {
  // Original artwork from the supplied video keeps its distinctive icon geometry.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.referenceIcon} src={`/project-dashboard/icons/${name}.webp`} alt="" width={size} height={size} />;
}

export function Avatar({ id, size = 28 }: { id: DashboardPersonId; size?: number }) {
  const person = dashboardPeople[id];
  // The portraits are cropped from the user-supplied reference, not remote accounts.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.avatar} src={person.avatar} alt={person.name} width={size} height={size} style={{ width: size, height: size }} />;
}

export function AvatarGroup({ ids, size = 28, extra }: { ids: readonly DashboardPersonId[]; size?: number; extra?: number }) {
  return <span className={styles.avatarGroup} style={{ '--avatar-size': `${size}px`, '--avatar-border': `${size <= 20 ? 1 : 2}px` } as CSSProperties}>
    {ids.map(id => <Avatar key={id} id={id} size={size} />)}
    {extra ? <span className={styles.avatarExtra}>+{extra}</span> : null}
  </span>;
}

export function IconButton({ label, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} className={`fouc-action ${styles.iconButton} ${className}`} {...props}>{children}</button>;
}

export function DashboardButton({ children, className = '', tone = 'primary', ...props }: React.ComponentProps<typeof Button> & { tone?: 'primary' | 'neutral' }) {
  return <Button variant={tone === 'neutral' ? 'outline' : 'default'} className={`${styles.button} ${tone === 'primary' ? styles.primary : styles.neutral} ${className}`} {...props}>{children}</Button>;
}

export function SegmentedControl<T extends string>({ items, value, onChange, label }: { items: readonly T[]; value: T; onChange: (value: T) => void; label: string }) {
  return <div className={styles.segments} role="group" aria-label={label}>
    {items.map(item => <button type="button" className="fouc-action" key={item} aria-pressed={item === value} onClick={() => onChange(item)}>{item}</button>)}
  </div>;
}
