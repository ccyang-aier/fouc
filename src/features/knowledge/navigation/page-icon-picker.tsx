'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { decodePageIcon, encodePageIcon, PageIcon, pageIconColors, pageIcons, pageEmojis } from './page-icon';
import styles from './page-icon-picker.module.css';

export function PageIconPicker({ value, editable = true, onChange }: { value?: string | null; editable?: boolean; onChange: (icon: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'icons' | 'emoji'>('icons');
  const [query, setQuery] = useState('');
  const [color, setColor] = useState<string>(pageIconColors[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const selected = decodePageIcon(value);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => search.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  async function apply(next: string | null, close = true) {
    if (saving) return;
    setSaving(true); setError('');
    try { await onChange(next); if (close) setOpen(false); }
    catch { setError('图标保存失败，请重试'); }
    finally { setSaving(false); }
  }
  if (!editable) return value ? <span className={styles.trigger}><PageIcon value={value} size={32} /></span> : null;
  const match = query.trim().toLowerCase();
  const icons = pageIcons.filter(icon => `${icon.id} ${icon.label}`.toLowerCase().includes(match));
  const emojis = pageEmojis.filter(([emoji, label]) => `${emoji} ${label}`.toLowerCase().includes(match));
  return <DropdownMenu open={open} onOpenChange={next => {
    if (saving && !next) return;
    if (next) { setColor(selected?.color ?? pageIconColors[0]); setTab(value && !selected ? 'emoji' : 'icons'); setQuery(''); setError(''); }
    setOpen(next);
  }}>
    <DropdownMenuTrigger className={styles.trigger} data-empty={!value} aria-label={value ? '更改文档图标' : '添加文档图标'} title={value ? '更改图标' : '添加图标'}>
      {value ? <PageIcon value={value} size={32} /> : <Plus size={22} aria-hidden />}
    </DropdownMenuTrigger>
    <DropdownMenuContent role="dialog" aria-label="文档图标选择" aria-labelledby={undefined} align="start" collisionPadding={12} className={styles.panel}>
      <div onKeyDown={event => { if (event.key === 'Tab') event.stopPropagation(); }}>
        <div className={styles.tabs}>
          <div className={styles.tabList} role="tablist" aria-label="图标类型" onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault(); event.stopPropagation();
              const next = event.key === 'Home' ? 'icons' : event.key === 'End' ? 'emoji' : tab === 'icons' ? 'emoji' : 'icons';
              setTab(next);
              event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
            }
          }}>
          <button type="button" role="tab" data-tab="icons" tabIndex={tab === 'icons' ? 0 : -1} aria-selected={tab === 'icons'} onClick={() => setTab('icons')}>图标</button>
          <button type="button" role="tab" data-tab="emoji" tabIndex={tab === 'emoji' ? 0 : -1} aria-selected={tab === 'emoji'} onClick={() => setTab('emoji')}>表情</button>
          </div>
          <button type="button" className={styles.remove} disabled={!value || saving} onClick={() => void apply(null)}>移除</button>
        </div>
        <label className={styles.search}><MagnifyingGlass size={16} aria-hidden /><input ref={search} aria-label="搜索图标" placeholder={tab === 'icons' ? '搜索图标…' : '搜索表情…'} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }} /></label>
        {tab === 'icons' && <div className={styles.colors} role="group" aria-label="图标颜色">
          {pageIconColors.map(option => <button type="button" key={option} aria-label={`图标颜色 ${option}`} aria-pressed={color === option} disabled={saving} style={{ backgroundColor: option }} onClick={() => { setColor(option); if (selected) void apply(encodePageIcon(selected.id, option), false); }}>{color === option && <Check size={13} weight="bold" aria-hidden />}</button>)}
        </div>}
        <div className={styles.grid} role="group" aria-label={tab === 'icons' ? '全部图标' : '全部表情'}>
          {tab === 'icons' ? icons.map(({ id, label, glyph: Glyph }) => <DropdownMenuItem asChild key={id} disabled={saving} onSelect={event => { event.preventDefault(); void apply(encodePageIcon(id, color)); }}><button type="button" className={styles.choice} aria-label={label} title={label} data-selected={selected?.id === id}><Glyph size={24} weight="fill" style={{ color }} aria-hidden /></button></DropdownMenuItem>) : emojis.map(([emoji, label]) => <DropdownMenuItem asChild key={emoji} disabled={saving} onSelect={event => { event.preventDefault(); void apply(emoji); }}><button type="button" className={styles.choice} aria-label={label} title={label} data-selected={value === emoji}>{emoji}</button></DropdownMenuItem>)}
        </div>
        {!(tab === 'icons' ? icons.length : emojis.length) && <p className={styles.status}>没有匹配的图标</p>}
        {saving && <p role="status" className={styles.status}>正在保存…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </DropdownMenuContent>
  </DropdownMenu>;
}
