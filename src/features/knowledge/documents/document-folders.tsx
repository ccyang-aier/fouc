import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DotsThree } from '@phosphor-icons/react';
import { FolderArtwork } from './document-visuals';
import type { DocumentFolder } from './types';
import styles from './documents-page.module.css';
export function DocumentFolders({ visibleFolders, allFolders, onOpenFolder, onCreateFolder, canEdit }: {
    visibleFolders: DocumentFolder[];
    allFolders: boolean;
    onOpenFolder: (id: string) => void;
    onCreateFolder?: () => void;
    canEdit: boolean;
}) { return (<div className={styles.folders}>{(allFolders ? visibleFolders : visibleFolders.slice(0, 4)).map((folder, index) => <div key={folder.id} className={styles.folder}><button className={styles.folderOpen} onClick={() => onOpenFolder(folder.id)}><FolderArtwork index={index}/><strong>{folder.name}</strong><small>{folder.count} 个项目{folder.updatedAt ? ` · ${folder.updatedAt.slice(0, 10)}` : ''}</small></button><DropdownMenu><DropdownMenuTrigger asChild><button className={styles.folderMore} aria-label={`${folder.name}文件夹操作`}><DotsThree size={18} weight="bold"/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onOpenFolder(folder.id)}>打开文件夹</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}{!visibleFolders.length ? <div className={styles.folderEmpty}>暂无文件夹{onCreateFolder ? <button onClick={onCreateFolder} disabled={!canEdit}>新建文件夹</button> : null}</div> : null}</div>); }
