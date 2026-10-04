'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import type { ConnectionDirectoryMetadata } from '@fouc/shared/connection-directory';
import { SqlDialog } from '../sql-library-dialog';
import type { DirectoryProject } from './types';
import type { SavedDatastoreConnection } from './provider-model';
import common from '../relational.module.css';
import styles from './organize-dialog.module.css';

export function OrganizeConnectionDialog({ connection, projects, projectNotice, onSave, onClose }: {
  connection: SavedDatastoreConnection; projects: DirectoryProject[]; projectNotice?: string;
  onSave: (metadata: Partial<ConnectionDirectoryMetadata>) => Promise<void>; onClose: () => void;
}) {
  const [projectIds, setProjectIds] = useState(connection.directory?.projectIds ?? []);
  const [tags, setTags] = useState(connection.directory?.tags ?? []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const missing = projectIds.filter(id => !projects.some(project => project.id === id));
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
    try {
      const nextTags = withDraft();
      if (projectIds.length > 20) throw new Error('最多关联 20 个项目');
      setBusy(true);
      await onSave({ projectIds, tags: nextTags });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }
  return <SqlDialog title="管理项目与标签" busy={busy} onClose={onClose} className={styles.dialog}>
    <form onSubmit={event => void submit(event)}>
      <div className={styles.body}>
        <div className={styles.identity}><strong>{connection.name}</strong><span>为当前工作空间的连接整理项目引用与标签。</span></div>
        <fieldset disabled={busy} className={styles.fieldset}><legend>关联项目</legend>
          <p className={styles.hint}>同一连接可供多个项目引用；关联不会授予数据库访问权限。</p>
          {projectNotice && <p className={styles.hint} role="status">{projectNotice}</p>}
          <div className={styles.projects}>{projects.map(project => <label key={project.id}>
            <input type="checkbox" checked={projectIds.includes(project.id)} onChange={event => setProjectIds(previous => event.target.checked ? [...previous, project.id] : previous.filter(id => id !== project.id))} />
            <span>{project.name}</span>
          </label>)}{!projects.length && !projectNotice && <span className={styles.hint}>当前工作空间还没有项目。</span>}
          {missing.map(id => <label key={id} title={id}><input type="checkbox" checked onChange={() => setProjectIds(previous => previous.filter(value => value !== id))} /><span className={styles.hint}>项目暂不可用</span></label>)}</div>
        </fieldset>
        <fieldset disabled={busy} className={styles.fieldset}><legend>标签</legend>
          <div className={styles.tags}>{tags.map(tag => <span key={tag}>{tag}<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => setTags(previous => previous.filter(value => value !== tag))}><X size={12} /></button></span>)}</div>
          <div className={styles.add}><input aria-label="添加连接标签" placeholder="输入标签，按 Enter 添加" value={draft} maxLength={400} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); addTags(); } }} /><button type="button" aria-label="添加标签" disabled={!draft.trim()} onClick={addTags}><Plus size={15} /></button></div>
          <p className={styles.hint}>最多 12 个标签，可使用逗号分隔。</p>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={busy} onClick={onClose}>取消</button><span /><button type="submit" className={common.primary} disabled={busy}>{busy ? '保存中…' : '保存'}</button></footer>
    </form>
  </SqlDialog>;
}
