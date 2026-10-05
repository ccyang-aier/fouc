'use client';

import { useState, type FormEvent } from 'react';
import { SqlDialog } from '../sql-library-dialog';
import type { DirectoryProject } from './types';
import type { SavedDatastoreConnection } from './provider-model';
import common from '../relational.module.css';
import styles from './directory-dialog.module.css';

export function ConnectionProjectsDialog({ connection, projects, projectNotice, onSave, onClose }: {
  connection: SavedDatastoreConnection;
  projects: DirectoryProject[];
  projectNotice?: string;
  onSave: (projectIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [projectIds, setProjectIds] = useState(connection.directory?.projectIds ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const missing = projectIds.filter(id => !projects.some(project => project.id === id));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (projectIds.length > 20) { setError('最多关联 20 个项目'); return; }
    setBusy(true);
    try { await onSave(projectIds); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  }

  return <SqlDialog title="关联项目" busy={busy} onClose={onClose} className={styles.dialog}>
    <form onSubmit={event => void submit(event)}>
      <div className={styles.body}>
        {projectNotice && <p className={styles.hint} role="status">{projectNotice}</p>}
        <fieldset disabled={busy} className={styles.fieldset} aria-label="选择关联项目">
          <div className={styles.projects}>{projects.map(project => <label key={project.id}>
            <input type="checkbox" checked={projectIds.includes(project.id)} onChange={event => setProjectIds(previous => event.target.checked ? [...previous, project.id] : previous.filter(id => id !== project.id))} />
            <span>{project.name}</span>
          </label>)}
          {!projects.length && !projectNotice && <span className={styles.hint}>暂无项目</span>}
          {missing.map(id => <label key={id} title={id}><input type="checkbox" checked onChange={() => setProjectIds(previous => previous.filter(value => value !== id))} /><span className={styles.hint}>项目暂不可用</span></label>)}</div>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={busy} onClick={onClose}>取消</button><span /><button type="submit" className={common.primary} disabled={busy}>{busy ? '保存中…' : '保存'}</button></footer>
    </form>
  </SqlDialog>;
}
