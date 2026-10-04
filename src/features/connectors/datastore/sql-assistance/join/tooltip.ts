import type { RelationalProvider } from '@fouc/shared';
import type { SqlJoinRelationship } from '@fouc/shared/sql-join';
import './theme.css';

export function sqlJoinInformation(relation: SqlJoinRelationship, sql: string, provider: RelationalProvider, coverage: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'fouc-sql-join-info';
  root.setAttribute('role', 'tooltip');
  root.setAttribute('aria-label', '外键 JOIN 来源');
  const heading = document.createElement('div');
  heading.className = 'fouc-sql-join-heading';
  heading.textContent = `${provider === 'postgres' ? 'PostgreSQL' : provider === 'sqlite' ? 'SQLite' : 'MySQL'} · ${relation.pairs.length > 1 ? '复合外键' : '外键'}`;
  const title = document.createElement('strong');
  title.textContent = relation.constraint;
  const source = document.createElement('p');
  source.textContent = `${relation.owner.schema}.${relation.owner.table} → ${relation.referenced.schema}.${relation.referenced.table}`;
  const pairs = document.createElement('div');
  pairs.className = 'fouc-sql-join-pairs';
  for (const pair of relation.pairs) {
    const row = document.createElement('code');
    row.textContent = `${pair.owner} → ${pair.referenced}`;
    pairs.append(row);
  }
  const preview = document.createElement('pre');
  preview.textContent = sql;
  const footer = document.createElement('p');
  footer.className = 'fouc-sql-join-coverage';
  footer.textContent = `${relation.nameSource === 'synthetic' ? '关系来自原生目录；约束名称为设备生成标签。' : '来源：原生数据库外键目录。'} ${coverage}`;
  root.append(heading, title, source, pairs, preview, footer);
  return root;
}
