import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './project-links.messages';
import { FolderSimple } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './connection-list.module.css';
export function ConnectionProjectLinks({
  ids,
  names,
  onOpen,
}: {
  ids: readonly string[];
  names: ReadonlyMap<string, string>;
  onOpen: (id: string) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  if (!ids.length)
    return (
      <span className={`${styles.projectChip} ${styles.unassigned}`}>
        {tConnector('notLinked')}
      </span>
    );
  const first = ids[0],
    name = names.get(first);
  return (
    <div className={styles.chips}>
      {name ? (
        <button
          type="button"
          className={styles.projectChip}
          title={tConnector('openProject', { p0: String(name) })}
          onClick={() => onOpen(first)}
        >
          {name}
        </button>
      ) : (
        <span className={styles.projectChip} title={first}>
          {tConnector('projectUnavailable')}
        </span>
      )}
      {ids.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={styles.projectChip}
              aria-label={tConnector('viewOtherLinkedProjects')}
            >
              +{ids.length - 1}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ids.slice(1).map((id) => (
              <DropdownMenuItem key={id} disabled={!names.has(id)} onSelect={() => onOpen(id)}>
                <FolderSimple weight="duotone" />
                {names.get(id) ?? tConnector('projectUnavailable')}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
