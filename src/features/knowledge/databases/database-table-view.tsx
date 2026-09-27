'use client';

/**
 * 数据库表格视图（U06）——kind=database 页面的表格视图容器。
 *
 * 一次 `page.access` 授权（与编辑器共用缓存键）决定四态的第一刀：pending /
 * error / denied / granted。授予后列 schema 与行分页经 U01 缓存查询、写路径走
 * table-operations 的乐观回路；筛选排序状态驱动查询键、变化即服务端重取。
 * 行即页面：点击行名进入行正文（onOpenRow）。列结构变更需要 full 级，单元格
 * 编辑需要 edit 级；后端路由未装配时（Z03 前置）如实呈现 NOT_FOUND，不伪造。
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleNotch, Plus, Table } from '@phosphor-icons/react';
import type { DatabaseFilter, PageScope, PermissionLevel, Properties, PropertyDefinition } from '@fouc/shared/knowledge/contracts';
import { runKnowledgeCall } from '../data/trpc-client';
import { knowledgeErrorCodeOf } from '../entry-state';
import { CanvasError, CanvasForbidden, CanvasSpinner, CanvasState } from '../canvas-states';
import { organizationQueryKeys } from '../organization/keys';
import { organizationClient } from '@/features/workspaces/organization-client';
import { knowledgeDatabasesApi } from './database-api';
import { useDatabaseColumnsQuery, useDatabaseRowsQuery } from './database-queries';
import { pruneQueryState, toggleSort, type SortKey } from './query-state';
import { createDatabaseTableOperations } from './table-operations';
import { TableGrid } from './table-grid';
import { FilterSortBar } from './filter-sort-bar';
import { personNameOfFactory } from './table-cells';
import type { PersonOption } from './table-cells';
import { Button } from '@/components/ui/button';
import { appendColumn, columnsEditFailureText, removeColumn as removeColumnPure, renameColumn as renameColumnPure, setColumnOptions, validateColumnsReplacement } from './cell-model';
import { EditOptionsPanel } from './table-header';
import type { ColumnDraft } from './table-header';
import type { AnchorRect } from './anchored-panel';

const levelRank: Record<PermissionLevel, number> = { view: 0, comment: 1, edit: 2, full: 3 };
const levelSatisfies = (level: PermissionLevel, required: PermissionLevel) => levelRank[level] >= levelRank[required];

/** 与编辑器 page-access 同键共用缓存：同一页面的授权结论只问一次。 */
function databaseAccessQueryKey(workspaceId: string, pageId: string) {
  return [workspaceId, 'knowledge', 'pages', 'access', pageId] as const;
}

const accessErrorCopy: Record<string, string> = {
  UNAVAILABLE: '知识服务暂时不可用，请稍后重试。',
  NETWORK: '无法连接知识服务，请检查网络后重试。',
  TIMEOUT: '连接知识服务超时，请重试。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  ENDPOINT: '知识服务地址未配置，无法建立连接。',
  PAYMENT_REQUIRED: '该操作需要更高的访问权限。',
};

export function DatabaseTableView({
  scope,
  title,
  icon,
  onOpenRow,
}: {
  scope: PageScope;
  /** 页面元数据（挂载方从页面树提供；缺省时头部仅显示视图名）。 */
  title?: string;
  icon?: string | null;
  onOpenRow: (pageId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [sort, setSort] = useState<SortKey[]>([]);
  const [pendingRowIds, setPendingRowIds] = useState<ReadonlySet<string>>(new Set());
  const [creatingRow, setCreatingRow] = useState(false);
  const [failureText, setFailureText] = useState<string | null>(null);
  const [filterFocusColumnId, setFilterFocusColumnId] = useState<string | null>(null);
  const [optionsEditor, setOptionsEditor] = useState<{ column: PropertyDefinition; anchor: AnchorRect } | null>(null);

  // ── 授权门 ───────────────────────────────────────────────
  const accessQuery = useQuery({
    queryKey: databaseAccessQueryKey(scope.workspaceId, scope.pageId),
    queryFn: ({ signal }) => runKnowledgeCall(scope.workspaceId, signal, (client) =>
      client.page.access.query({ workspaceId: scope.workspaceId, pageId: scope.pageId, action: 'view' }, { signal })),
    enabled: scope.workspaceId.length > 0 && scope.pageId.length > 0,
  });
  const level: PermissionLevel | null = accessQuery.data?.authorized ? accessQuery.data.level : null;
  const canEditCells = level !== null && levelSatisfies(level, 'edit');
  const canEditColumns = level !== null && levelSatisfies(level, 'full');

  // ── 数据 ─────────────────────────────────────────────────
  const columnsQuery = useDatabaseColumnsQuery(scope.workspaceId, accessQuery.data?.authorized ? scope.pageId : null);
  const columns = useMemo(() => columnsQuery.data?.columns ?? [], [columnsQuery.data]);
  const rowsQuery = useDatabaseRowsQuery(scope.workspaceId, accessQuery.data?.authorized ? scope.pageId : null, filters, sort);
  const rows = useMemo(() => rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [], [rowsQuery.data]);
  const loadedCount = rows.length;

  // 列删除后摘除指向旧列的筛选/排序（服务端会拒绝陈旧查询）。这是「渲染期间
  // 对齐状态」：以 columns 身份为界一次性收敛，React 会丢弃未提交的渲染直接
  // 重渲，不引入 effect 级联。
  const [prunedForColumns, setPrunedForColumns] = useState(columns);
  if (prunedForColumns !== columns) {
    setPrunedForColumns(columns);
    const pruned = pruneQueryState(filters, sort, columns);
    if (pruned.filters.length !== filters.length || pruned.sort.length !== sort.length) {
      setFilters(pruned.filters);
      setSort(pruned.sort);
    }
  }

  const membersQuery = useQuery({
    queryKey: organizationQueryKeys.members(scope.workspaceId),
    queryFn: ({ signal }) => organizationClient.listMembers(scope.workspaceId, { limit: 100, signal }),
    enabled: accessQuery.data?.authorized === true,
    staleTime: 60_000,
  });
  const members: PersonOption[] = useMemo(
    () => (membersQuery.data?.items ?? []).map((member) => ({ userId: member.userId, name: member.name, email: member.email })),
    [membersQuery.data],
  );
  const personNameOf = useMemo(() => personNameOfFactory(members), [members]);

  const operations = useMemo(() => createDatabaseTableOperations({
    queryClient,
    api: knowledgeDatabasesApi,
    workspaceId: scope.workspaceId,
    databaseId: scope.pageId,
  }), [queryClient, scope.workspaceId, scope.pageId]);

  const trackFailure = (cause: unknown, what: string) => {
    const code = knowledgeErrorCodeOf(cause);
    const copy = code && accessErrorCopy[code] ? accessErrorCopy[code] : (cause instanceof Error && cause.message ? cause.message : '操作失败，请重试。');
    setFailureText(`${what}失败${code ? `（${code}）` : ''}：${copy}已恢复到操作前的值。`);
  };

  const editProperties = async (pageId: string, properties: Properties) => {
    setPendingRowIds((current) => new Set(current).add(pageId));
    try {
      await operations.editRowProperties(pageId, properties);
      setFailureText(null);
    } catch (cause) {
      trackFailure(cause, '编辑单元格');
    } finally {
      setPendingRowIds((current) => {
        const next = new Set(current);
        next.delete(pageId);
        return next;
      });
    }
  };

  const replaceColumns = async (nextColumns: PropertyDefinition[], what: string) => {
    const check = validateColumnsReplacement(columns, nextColumns);
    if (!check.ok) {
      setFailureText(`${what}失败：${columnsEditFailureText[check.failure.kind]}`);
      return;
    }
    try {
      await operations.replaceColumns(nextColumns);
      setFailureText(null);
    } catch (cause) {
      trackFailure(cause, what);
    }
  };

  const createRow = async () => {
    setCreatingRow(true);
    try {
      await operations.createRow({ title: '' });
      setFailureText(null);
    } catch (cause) {
      trackFailure(cause, '新建行');
    } finally {
      setCreatingRow(false);
    }
  };

  // ── 四态裁决 ─────────────────────────────────────────────
  if (accessQuery.isPending) {
    return <CanvasSpinner label="正在确认页面访问" />;
  }
  if (accessQuery.isError) {
    return (
      <CanvasError
        title="无法确认页面访问"
        detail={accessErrorCopy[knowledgeErrorCodeOf(accessQuery.error) ?? ''] ?? '确认页面访问时出现问题，请重试。'}
        onRetry={() => void accessQuery.refetch()}
      />
    );
  }
  if (!accessQuery.data?.authorized) {
    return (
      <CanvasForbidden
        title="没有该数据库的访问权限"
        detail="当前凭证对这个页面没有查看权限；如果最近权限有调整，请联系页面所有者。"
      />
    );
  }

  const loadError = columnsQuery.error ?? rowsQuery.error;
  if (loadError) {
    const code = knowledgeErrorCodeOf(loadError);
    if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') {
      return (
        <CanvasForbidden
          title="没有该数据库的访问权限"
          detail="当前凭证无法读取这个数据库；如果最近权限有调整，请联系页面所有者。"
        />
      );
    }
    return (
      <CanvasError
        title="数据库加载失败"
        detail={`${accessErrorCopy[code ?? ''] ?? '读取数据库时出现问题，请重试。'}${code === 'NOT_FOUND' ? '（数据库服务路由尚未装配）' : ''}`}
        onRetry={() => {
          void columnsQuery.refetch();
          void rowsQuery.refetch();
        }}
      />
    );
  }
  const loading = columnsQuery.isPending || rowsQuery.isPending;

  return (
    <section aria-label={`${title ?? '数据库'} · 表格视图`} className="flex h-full min-h-0 flex-col bg-[var(--panel)]">
      {/* 视图头部 */}
      <header className="mx-auto w-full max-w-[1080px] shrink-0 px-6 pt-6">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-[7px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
            {icon ? <span className="text-[15px] leading-none">{icon}</span> : <Table aria-hidden className="size-4" weight="regular" />}
          </span>
          <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title ?? '数据库'}</h1>
          {!canEditCells ? (
            <span className="ml-1 rounded-[5px] border border-[var(--line)] px-1.5 py-px text-[10.5px] text-[var(--muted-strong)]">只读</span>
          ) : null}
        </div>
      </header>

      {/* 筛选排序栏 */}
      <div className="mx-auto w-full max-w-[1080px] shrink-0 px-6">
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-t-[8px]">
          <FilterSortBar
            columns={columns}
            filters={filters}
            sort={sort}
            members={members}
            focusColumnId={filterFocusColumnId}
            onFocusColumnConsumed={() => setFilterFocusColumnId(null)}
            onAddFilter={(filter) => setFilters((current) => [...current, filter])}
            onUpdateFilter={(index, filter) => setFilters((current) => current.map((candidate, position) => (position === index ? filter : candidate)))}
            onRemoveFilter={(index) => setFilters((current) => current.filter((_, position) => position !== index))}
            onAddSort={(key) => setSort((current) => (current.some((candidate) => candidate.propertyId === key.propertyId)
              ? current.map((candidate) => (candidate.propertyId === key.propertyId ? key : candidate))
              : [...current, key]))}
            onToggleSortDirection={(propertyId) => setSort((current) => toggleSort(current, propertyId))}
            onRemoveSort={(propertyId) => setSort((current) => current.filter((candidate) => candidate.propertyId !== propertyId))}
          />
          {canEditCells ? (
            <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-[6px] px-2 text-[11.5px]" onClick={() => void createRow()} disabled={creatingRow}>
              <Plus aria-hidden className="size-3" />
              新行
            </Button>
          ) : null}
        </div>
      </div>

      {/* 操作失败横幅 */}
      {failureText ? (
        <div className="mx-auto w-full max-w-[1080px] shrink-0 px-6">
          <div role="status" className="flex items-start justify-between gap-2 rounded-[7px] border border-[color-mix(in_srgb,var(--err-ink)_28%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_7%,transparent)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--err-ink)]">
            <span className="min-w-0">{failureText}</span>
            <button type="button" aria-label="关闭提示" onClick={() => setFailureText(null)} className="shrink-0 rounded-[4px] px-1 text-[13px] leading-none outline-none hover:bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)]">×</button>
          </div>
        </div>
      ) : null}

      {/* 表格主体 */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col px-6 pb-8">
        {loading ? (
          <TableSkeleton columns={Math.max(3, columns.length)} />
        ) : loadedCount === 0 ? (
          <CanvasState
            tone="accent"
            icon={<Table aria-hidden className="size-5" weight="regular" />}
            title={filters.length > 0 ? '没有满足筛选的行' : '这个数据库还没有行'}
            hint={filters.length > 0 ? '调整或移除筛选条件后即可看到更多行。' : '每一行都是一个页面：创建第一行后，点击行名即可打开行正文。'}
            announce="polite"
            actions={filters.length === 0 && canEditCells ? (
              <Button onClick={() => void createRow()} disabled={creatingRow}>
                <Plus aria-hidden className="size-3.5" />
                新建第一行
              </Button>
            ) : undefined}
          />
        ) : (
          <TableGrid
            columns={columns}
            rows={rows}
            filters={filters}
            sort={sort}
            members={members}
            canEditCells={canEditCells}
            canEditColumns={canEditColumns}
            pendingRowPageIds={pendingRowIds}
            personNameOf={personNameOf}
            onOpenRow={onOpenRow}
            onEditProperties={(pageId, properties) => void editProperties(pageId, properties)}
            onToggleSort={(columnId) => setSort((current) => toggleSort(current, columnId))}
            onFilterColumn={(column) => setFilterFocusColumnId(column.id)}
            onRenameColumn={(columnId, name) => void replaceColumns(renameColumnPure(columns, columnId, name), '重命名列')}
            onEditOptions={(column, anchor) => setOptionsEditor({ column, anchor })}
            onDeleteColumn={(columnId) => void replaceColumns(removeColumnPure(columns, columnId), '删除列')}
            onAddColumn={(draft: ColumnDraft) => void replaceColumns(appendColumn(columns, draft), '新建列')}
            onCreateRow={() => void createRow()}
            creatingRow={creatingRow}
          />
        )}

        {/* 分页 */}
        {!loading && loadedCount > 0 && rowsQuery.hasNextPage ? (
          <div className="mt-2 flex shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={() => void rowsQuery.fetchNextPage()}
              disabled={rowsQuery.isFetchingNextPage}
              className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--line)] px-3 text-[11.5px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-subtle)] disabled:pointer-events-none disabled:opacity-45"
            >
              {rowsQuery.isFetchingNextPage ? <CircleNotch aria-hidden className="size-3 animate-spin" /> : null}
              加载更多（已加载 {loadedCount} 行）
            </button>
          </div>
        ) : null}
      </div>

      {/* 选项编辑器（列菜单转发） */}
      {optionsEditor ? (
        <EditOptionsPanel
          column={optionsEditor.column}
          anchor={optionsEditor.anchor}
          onClose={() => setOptionsEditor(null)}
          onSaveOptions={(columnId, options) => void replaceColumns(setColumnOptions(columns, columnId, options), '编辑选项')}
        />
      ) : null}
    </section>
  );
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="py-1" aria-hidden>
      <div className="grid border-b border-[var(--line-strong)]" style={{ gridTemplateColumns: `minmax(240px, 1.5fr) repeat(${Math.max(1, columns - 1)}, minmax(150px, 1fr))` }}>
        <div className="h-[32px] animate-pulse bg-[var(--raise)]" />
        {Array.from({ length: Math.max(1, columns - 1) }, (_, index) => (
          <div key={index} className="h-[32px] animate-pulse border-l border-[var(--line)] bg-[var(--raise)]" />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, rowIndex) => (
        <div key={rowIndex} className="grid border-b border-[var(--line)]" style={{ gridTemplateColumns: `minmax(240px, 1.5fr) repeat(${Math.max(1, columns - 1)}, minmax(150px, 1fr))` }}>
          <div className="h-[34px] animate-pulse" style={{ animationDelay: `${rowIndex * 80}ms`, background: rowIndex % 3 === 0 ? 'var(--raise)' : 'transparent' }} />
          {Array.from({ length: Math.max(1, columns - 1) }, (_, columnIndex) => (
            <div
              key={columnIndex}
              className="h-[34px] animate-pulse border-l border-[var(--line)]"
              style={{ animationDelay: `${rowIndex * 80 + columnIndex * 40}ms`, background: (rowIndex + columnIndex) % 3 === 0 ? 'var(--raise)' : 'transparent' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
