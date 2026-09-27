import type { ReactNode } from 'react';
import { ArrowDown, CheckCircle, Desktop } from '@phosphor-icons/react';
import { FileBadge, formatOf } from './document-visuals';
import type { DocumentItem } from './types';
import styles from './documents-page.module.css';
export function DocumentCollection({ layout, shown, selected, selectedCount, setSelected, toggle, ascending, setAscending, onOpen, renderMenu }: {
    layout: 'table' | 'grid';
    shown: DocumentItem[];
    selected: Set<string>;
    selectedCount: number;
    setSelected: (ids: Set<string>) => void;
    toggle: (id: string) => void;
    ascending: boolean;
    setAscending: (value: boolean) => void;
    onOpen: (id: string) => void;
    renderMenu: (id: string) => ReactNode;
}) { return (layout === 'table' ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th><input type="checkbox" aria-label="选择全部文档" checked={shown.length > 0 && selectedCount === shown.length} ref={(node) => { if (node)
    node.indeterminate = selectedCount > 0 && selectedCount < shown.length; }} onChange={(event) => setSelected(event.target.checked ? new Set(shown.map((doc) => doc.id)) : new Set())}/></th><th>名称</th><th>格式</th><th>创建者</th><th><button onClick={() => setAscending(!ascending)}>更新时间 <ArrowDown size={14} style={{ transform: ascending ? 'rotate(180deg)' : undefined }}/></button></th><th>来源</th><th>已索引</th><th /></tr></thead><tbody>{shown.map((doc) => <tr key={doc.id} data-selected={selected.has(doc.id)}><td><input type="checkbox" aria-label={`选择${doc.title}`} checked={selected.has(doc.id)} onChange={() => toggle(doc.id)}/></td><td><button className={styles.documentName} onClick={() => onOpen(doc.id)}><FileBadge title={doc.title}/><span>{doc.title || '无标题文档'}</span></button></td><td>{formatOf(doc.title)}</td><td><span className={styles.creator}><span>{doc.creator.slice(0, 1)}</span>{doc.creator}</span></td><td>{doc.updatedAt.slice(0, 16).replace('T', ' ')}</td><td><span className={styles.source}><Desktop size={16}/>{doc.source}</span></td><td><span className={styles.status}>{doc.status === '已索引' ? <CheckCircle size={17} weight="fill"/> : <span className={styles.statusDot}/>}{doc.status}</span></td><td>{renderMenu(doc.id)}</td></tr>)}</tbody></table></div> : <div className={styles.fileGrid}>{shown.map((doc) => <article key={doc.id}><button onClick={() => onOpen(doc.id)}><FileBadge title={doc.title}/><strong>{doc.title}</strong><small>{doc.updatedAt.slice(0, 10)} · {doc.source}</small></button>{renderMenu(doc.id)}</article>)}</div>); }
