import { FolderSimple } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import styles from './connection-list.module.css'

export function ConnectionProjectLinks({ ids, names, onOpen }: {
  ids: readonly string[]
  names: ReadonlyMap<string, string>
  onOpen: (id: string) => void
}) {
  if (!ids.length) return <span className={`${styles.projectChip} ${styles.unassigned}`}>未关联</span>
  const first = ids[0], name = names.get(first)
  return <div className={styles.chips}>
    {name ? <button type="button" className={styles.projectChip} title={`打开项目：${name}`} onClick={() => onOpen(first)}>{name}</button>
      : <span className={styles.projectChip} title={first}>项目不可用</span>}
    {ids.length > 1 && <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className={styles.projectChip} aria-label="查看其它关联项目">+{ids.length - 1}</button></DropdownMenuTrigger>
      <DropdownMenuContent align="start">{ids.slice(1).map(id => <DropdownMenuItem key={id} disabled={!names.has(id)} onSelect={() => onOpen(id)}><FolderSimple weight="duotone" />{names.get(id) ?? '项目不可用'}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>}
  </div>
}
