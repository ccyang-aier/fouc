'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { SqlDialog } from '../sql-library-dialog';
import { appendConnectionTags } from './batch';
import common from '../relational.module.css';
import styles from './tag-dialog.module.css';

export function ConnectionTagsDialog({ initialTags, title = '管理标签', additive = false, onSave, onClose }: {
  initialTags: string[];
  title?: string;
  additive?: boolean;
  onSave: (tags: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');

  function withDraft() {
    return appendConnectionTags(tags, draft.split(/[,，]/));
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

  return <SqlDialog title={title} busy={busy} onClose={onClose} className={styles.dialog}>
    <form onSubmit={event => void submit(event)}>
      <div className={styles.body}>
        <fieldset disabled={busy} className={styles.fieldset} aria-label="连接标签">
          <div className={styles.tags}>{tags.map(tag => <span key={tag}>{tag}<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => setTags(previous => previous.filter(value => value !== tag))}><X size={12} /></button></span>)}</div>
          <div className={styles.add}><input aria-label="添加连接标签" placeholder="输入标签，Enter 添加" value={draft} maxLength={400} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); addTags(); } }} /><button type="button" aria-label="添加标签" disabled={!draft.trim()} onClick={addTags}><Plus size={15} /></button></div>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}><button type="button" className={common.secondary} disabled={busy} onClick={onClose}>取消</button><button type="submit" className={common.primary} disabled={busy || (additive && !tags.length && !draft.trim())}>{busy ? '保存中…' : additive ? '添加标签' : '保存'}</button></footer>
    </form>
  </SqlDialog>;
}
