'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight, Database, FileText, Kanban, MagnifyingGlass, Plus, Table } from '@phosphor-icons/react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import type { DatabaseRowSummary, PageScope, PropertyDefinition } from '@fouc/shared/knowledge/contracts';
import { DatabaseTableView } from '../../../databases';
import { knowledgeDatabasesApi } from '../../../databases/database-api';
import { useDatabaseColumnsQuery, useDatabaseRowsQuery } from '../../../databases/database-queries';
import { fetchKnowledgePages } from '../../../data/pages-api';
import { requestOpenPageBlock } from '../../open-target';
import styles from './database-view.module.css';

type View = 'table' | 'board' | 'calendar';
const VIEWS = [
  { value: 'table', label: '表格', icon: Table },
  { value: 'board', label: '看板', icon: Kanban },
  { value: 'calendar', label: '日历', icon: CalendarBlank },
] as const;

export function DatabaseViewNodeView({ scope, ...props }: NodeViewProps & { scope?: PageScope }) {
  const { node, editor, updateAttributes, HTMLAttributes } = props;
  const [open, setOpen] = useState(!node.attrs.databaseId);
  const [query, setQuery] = useState('');
  const [databases, setDatabases] = useState<readonly { id: string; title: string }[]>([]);
  const [listError, setListError] = useState(false);
  const [teamspaceId, setTeamspaceId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const databaseId = node.attrs.databaseId ? String(node.attrs.databaseId) : null;
  const view = node.attrs.view as View;

  useEffect(() => {
    if (!scope) return;
    const controller = new AbortController();
    fetchKnowledgePages(scope.workspaceId, {}, controller.signal)
      .then((pages) => { setDatabases(pages.filter((page) => page.kind === 'database').map((page) => ({ id: page.id, title: page.title }))); setTeamspaceId(pages.find((page) => page.id === scope.pageId)?.teamspaceId ?? null); setListError(false); })
      .catch(() => { if (!controller.signal.aborted) setListError(true); });
    return () => controller.abort();
  }, [scope]);

  const title = databases.find((item) => item.id === databaseId)?.title ?? '数据库';
  const matches = databases.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  const openRow = (pageId: string) => { if (scope) requestOpenPageBlock({ workspaceId: scope.workspaceId, pageId }); };
  const createDatabase = async () => {
    if (!scope || !teamspaceId) return;
    setCreating(true);
    setCreateError('');
    const id = crypto.randomUUID();
    try {
      await knowledgeDatabasesApi.createDatabase(scope.workspaceId, {
        id, workspaceId: scope.workspaceId, teamspaceId, parentId: scope.pageId,
        title: '新数据库', icon: null, cover: null, inheritsPermissions: true, afterPageId: null,
        columns: [
          { id: 'status', name: '状态', type: 'select', options: [{ id: 'todo', label: '待办', color: 'gray' }, { id: 'doing', label: '进行中', color: 'blue' }, { id: 'done', label: '已完成', color: 'green' }] },
          { id: 'date', name: '日期', type: 'date' },
        ],
      });
      setDatabases((items) => [...items, { id, title: '新数据库' }]);
      updateAttributes({ databaseId: id });
      setOpen(false);
    } catch (cause) { setCreateError(cause instanceof Error ? cause.message : '创建数据库失败'); }
    finally { setCreating(false); }
  };

  return <NodeViewWrapper as="div" {...HTMLAttributes} data-fouc-node="database-view" data-block-id={node.attrs.blockId} className={styles.root} contentEditable={false}>
    <div className={styles.header}><span className={styles.heading}><Database aria-hidden size={17} weight="duotone" />{title}</span>{databaseId && editor.isEditable ? <button type="button" className={styles.change} onClick={() => setOpen((value) => !value)}>更换数据库</button> : null}</div>
    {open || !databaseId ? <div className={styles.picker}>
      <p>选择此工作空间中的数据库</p>
      {scope ? <><div className={styles.search}><MagnifyingGlass aria-hidden size={15} /><input aria-label="搜索数据库" value={query} placeholder="搜索数据库…" onChange={(event) => setQuery(event.target.value)} /></div>
        <div className={styles.choices}>{listError ? <span>数据库列表暂不可用</span> : matches.length ? matches.map((item) => <button type="button" key={item.id} onClick={() => { updateAttributes({ databaseId: item.id }); setOpen(false); }}><Database aria-hidden size={16} />{item.title}</button>) : <span>{query ? '没有匹配的数据库' : '此工作空间暂无数据库'}</span>}</div>
        {editor.isEditable && teamspaceId ? <button type="button" className={styles.create} disabled={creating} onClick={() => void createDatabase()}><Plus aria-hidden size={15} />{creating ? '正在创建…' : '创建数据库'}</button> : null}
        {createError ? <p className={styles.createError} role="alert">{createError}</p> : null}
      </> : <div className={styles.empty}>本机知识库尚无数据库资源；团队数据库可在连接服务后引用。</div>}
      {databaseId ? <button type="button" className={styles.change} onClick={() => setOpen(false)}>取消</button> : null}
    </div> : scope ? <>
      <div className={styles.views} role="tablist" aria-label="数据库视图">{VIEWS.map((item) => <button key={item.value} type="button" role="tab" aria-selected={view === item.value} onClick={() => updateAttributes({ view: item.value })}><item.icon aria-hidden size={15} />{item.label}</button>)}</div>
      <div className={styles.content}>{view === 'table' ? <DatabaseTableView scope={{ workspaceId: scope.workspaceId, pageId: databaseId }} title={title} onOpenRow={openRow} /> : <DatabaseAlternateView workspaceId={scope.workspaceId} databaseId={databaseId} view={view} onOpenRow={openRow} />}</div>
    </> : null}
  </NodeViewWrapper>;
}

function DatabaseAlternateView({ workspaceId, databaseId, view, onOpenRow }: { workspaceId: string; databaseId: string; view: 'board' | 'calendar'; onOpenRow: (pageId: string) => void }) {
  const columnsQuery = useDatabaseColumnsQuery(workspaceId, databaseId);
  const rowsQuery = useDatabaseRowsQuery(workspaceId, databaseId, [], []);
  const rows = useMemo(() => rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [], [rowsQuery.data]);
  const columns = columnsQuery.data?.columns ?? [];
  if (columnsQuery.isPending || rowsQuery.isPending) return <div className={styles.empty}>正在加载数据库…</div>;
  if (columnsQuery.isError || rowsQuery.isError) return <div className={styles.empty} role="alert">无法读取数据库视图，请稍后重试。</div>;
  return <>{view === 'board' ? <BoardView columns={columns} rows={rows} onOpenRow={onOpenRow} /> : <CalendarView columns={columns} rows={rows} onOpenRow={onOpenRow} />}{rowsQuery.hasNextPage ? <button type="button" className={styles.more} disabled={rowsQuery.isFetchingNextPage} onClick={() => void rowsQuery.fetchNextPage()}>{rowsQuery.isFetchingNextPage ? '加载中…' : '加载更多记录'}</button> : null}</>;
}

function BoardView({ columns, rows, onOpenRow }: { columns: readonly PropertyDefinition[]; rows: readonly DatabaseRowSummary[]; onOpenRow: (id: string) => void }) {
  const property = columns.find((column) => column.type === 'select');
  const groups = property ? [{ id: '', label: '未分类' }, ...(property.options ?? []).map((item) => ({ id: item.id, label: item.label }))] : [{ id: '', label: '全部记录' }];
  return <div className={styles.board}>{groups.map((group) => {
    const items = rows.filter((row) => !property || String(row.properties[property.id] ?? '') === group.id);
    return <section key={group.id} className={styles.boardColumn}><h3>{group.label}<span>{items.length}</span></h3>{items.map((row) => <button type="button" key={row.pageId} onClick={() => onOpenRow(row.pageId)}><FileText aria-hidden size={15} />{row.title || '无标题'}</button>)}</section>;
  })}</div>;
}

function CalendarView({ columns, rows, onOpenRow }: { columns: readonly PropertyDefinition[]; rows: readonly DatabaseRowSummary[]; onOpenRow: (id: string) => void }) {
  const dateProperty = columns.find((column) => column.type === 'date');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  if (!dateProperty) return <div className={styles.empty}>为数据库添加日期属性后，即可在日历中查看记录。</div>;
  const firstDay = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + count }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  return <div className={styles.calendar}>
    <div className={styles.calendarHead}><button type="button" aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CaretLeft aria-hidden size={16} /></button><strong>{month.getFullYear()} 年 {month.getMonth() + 1} 月</strong><button type="button" aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CaretRight aria-hidden size={16} /></button></div>
    <div className={styles.calendarGrid}>{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day} className={styles.weekday}>{day}</span>)}{cells.map((day, index) => <div key={index} className={styles.day}>{day ? <><span>{day}</span>{rows.filter((row) => String(row.properties[dateProperty.id] ?? '').slice(0, 10) === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`).map((row) => <button type="button" key={row.pageId} onClick={() => onOpenRow(row.pageId)}>{row.title || '无标题'}</button>)}</> : null}</div>)}</div>
  </div>;
}
