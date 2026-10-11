'use client';

import { Warning } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ErDiagramModel } from '@fouc/shared/er-diagram';
import styles from './diagram.module.css';

export function DiagramStatusBar({ model, loading, dense, matches, onLocate }: { model: ErDiagramModel; loading: boolean; dense: boolean; matches?: number; onLocate: (id: string) => void }) {
  const nodes = useMemo(() => new Map(model.nodes.map(node => [node.id, node])), [model.nodes]);
  return <footer className={styles.status}>
    <span role="status">{loading ? '正在读取结构…' : matches !== undefined ? `匹配 ${matches} / ${model.nodes.length} 个对象` : dense ? '简化连线 · 完整关系保留在详情中' : '原生表结构'}<span className={styles.statDivider}>·</span>{model.nodes.reduce((count, node) => count + node.columns.length, 0)} 字段</span>
    {model.issues.length > 0 && <DropdownMenu><DropdownMenuTrigger className="fouc-action" aria-label="关系图结构说明"><Warning size={14} /><span>结构说明</span><span className={styles.issueCount}>{model.issues.length}</span></DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" density="compact" className={styles.issuesMenu}><DropdownMenuGroup>
        {model.issues.slice(0, 100).map((issue, index) => {
          const node = issue.nodeId ? nodes.get(issue.nodeId) : undefined;
          return issue.nodeId ? <DropdownMenuItem key={index} onSelect={() => onLocate(issue.nodeId!)} className={styles.issueItem}>{node && <strong>{node.schema}.{node.table}</strong>}<span>{issue.message}</span></DropdownMenuItem> : <div key={index} className={styles.issueText}>{issue.message}</div>;
        })}
        {model.issues.length > 100 && <div className={styles.issueText}>其余 {model.issues.length - 100} 项见 JSON 导出。</div>}
      </DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>}
  </footer>;
}
