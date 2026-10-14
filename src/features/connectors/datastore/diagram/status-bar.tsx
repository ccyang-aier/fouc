'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './status-bar.messages';
import { Warning } from '@phosphor-icons/react';
import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ErDiagramModel } from '@fouc/shared/er-diagram';
import styles from './diagram.module.css';
export function DiagramStatusBar({
  model,
  loading,
  dense,
  matches,
  onLocate,
}: {
  model: ErDiagramModel;
  loading: boolean;
  dense: boolean;
  matches?: number;
  onLocate: (id: string) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const nodes = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  return (
    <footer className={styles.status}>
      <span role="status">
        {loading
          ? tConnector('readingStructure')
          : matches !== undefined
            ? tConnector('objectsMatch', { p0: String(matches), p1: String(model.nodes.length) })
            : dense
              ? tConnector('simplifiedConnectionsFullRelationshipsRemainInDetails')
              : tConnector('nativeTableStructure')}
        <span className={styles.statDivider}>·</span>
        {model.nodes.reduce((count, node) => count + node.columns.length, 0)}
        {tConnector('field')}
      </span>
      {model.issues.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="fouc-action"
            aria-label={tConnector('diagramStructureInformation')}
          >
            <Warning size={14} />
            <span>{tConnector('structureInformation')}</span>
            <span className={styles.issueCount}>{model.issues.length}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            density="compact"
            className={styles.issuesMenu}
          >
            <DropdownMenuGroup>
              {model.issues.slice(0, 100).map((issue, index) => {
                const node = issue.nodeId ? nodes.get(issue.nodeId) : undefined;
                return issue.nodeId ? (
                  <DropdownMenuItem
                    key={index}
                    onSelect={() => onLocate(issue.nodeId!)}
                    className={styles.issueItem}
                  >
                    {node && (
                      <strong>
                        {node.schema}.{node.table}
                      </strong>
                    )}
                    <span>{issue.message}</span>
                  </DropdownMenuItem>
                ) : (
                  <div key={index} className={styles.issueText}>
                    {issue.message}
                  </div>
                );
              })}
              {model.issues.length > 100 && (
                <div className={styles.issueText}>
                  {tConnector('remaining')}
                  {model.issues.length - 100}
                  {tConnector('itemsAreIncludedInTheJsonExport')}
                </div>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </footer>
  );
}
