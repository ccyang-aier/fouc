'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowsDownUp } from '@phosphor-icons/react/dist/csr/ArrowsDownUp';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { MongoDocumentExportView } from './export';
import { MongoDocumentImportView } from './import';
import styles from './transfer.module.css';

export type MongoDocumentTransferProps = {
  base: string; database: string; collection: string; filter: string; sort: string; writable: boolean;
  onUnlock: () => Promise<void>; onApplied: () => void;
};

export function MongoDocumentTransfer(props: MongoDocumentTransferProps) {
  const [open, setOpen] = useState(false);
  return <><button className={styles.action} onClick={() => setOpen(true)}><ArrowsDownUp size={14} />文档导入 / 导出</button>{open && <TransferDialog {...props} onClose={() => setOpen(false)} />}</>;
}

function TransferDialog({ onClose, ...props }: MongoDocumentTransferProps & { onClose: () => void }) {
  const [tab, setTab] = useState<'export' | 'import'>('export'), [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-label="MongoDB 文档导入与导出" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.header}><div><span className={styles.eyebrow}>MONGODB · DOCUMENT TRANSFER</span><h2>文档导入与导出</h2></div><button aria-label="关闭文档传输" disabled={busy} onClick={onClose}><X size={19} /></button></header>
    <nav className={styles.tabs} aria-label="文档传输模式"><button data-active={tab === 'export'} disabled={busy} onClick={() => setTab('export')}>导出文档</button><button data-active={tab === 'import'} disabled={busy} onClick={() => setTab('import')}>导入文档</button><span>{props.database}.{props.collection}</span></nav>
    <div className={styles.body}>{tab === 'export' ? <MongoDocumentExportView {...props} onBusyChange={setBusy} /> : <MongoDocumentImportView {...props} onBusyChange={setBusy} />}</div>
  </dialog>;
}
