'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { SqlDialog } from '../sql-library-dialog';
import type { SavedDatastoreConnection } from './provider-model';
import common from '../relational.module.css';
import styles from './directory-dialog.module.css';

export function ConnectionTagsDialog({ connection, onSave, onClose }: {
  connection: SavedDatastoreConnection;
  onSave: (tags: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [tags, setTags] = useState(connection.directory?.tags ?? []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');

  function withDraft() {
    const next = [...new Set([...tags, ...draft.split(/[,，]/).map(tag => tag.trim()).filter(Boolean)])];
    if (next.length > 12) throw new Error('最多添加 12 个标签');
    if (next.some(tag => tag.length > 32)) throw new Error('每个标签最多 32 个字符');
    return next;
  }
  function addTags() {
    try { setTags(withDraft()); setDraft(''); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '标签无效'); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    try { const next = withDraft(); setBusy(true); await onSave(next); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }

  return <SqlDialog title="管理标签" busy={busy} onClose={onClose} className={styles.dialog}>
    <form onSubmit={event => void submit(event)}>
      <div className={styles.body}>
        <fieldset disabled={busy} className={styles.fieldset} aria-label="连接标签">
          <div className={styles.tags}>{tags.map(tag => <span key={tag}>{tag}<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => setTags(previous => previous.filter(value => value !== tag))}><X size={12} /></button></span>)}</div>
          <div className={styles.add}><input aria-label="添加连接标签" placeholder="输入标签，Enter 添加" value={draft} maxLength={400} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); addTags(); } }} /><button type="button" aria-label="添加标签" disabled={!draft.trim()} onClick={addTags}><Plus size={15} /></button></div>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={busy} onClick={onClose}>取消</button><span /><button type="submit" className={common.primary} disabled={busy}>{busy ? '保存中…' : '保存'}</button></footer>
    </form>
  </SqlDialog>;
}
