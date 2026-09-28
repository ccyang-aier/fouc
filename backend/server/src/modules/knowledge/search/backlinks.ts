import * as Y from 'yjs';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { blockIdSchema, entityIdSchema, pageScopeSchema, principalSchema } from '@fouc/shared/knowledge/contracts';
import type { PageScope, Principal } from '@fouc/shared/knowledge/contracts';
import { backlink, docState, page } from '../../../platform/database/workspace/schema';
import type { WorkspaceTenantTransaction } from '../../../platform/database/workspace/tenant';
import { withWorkspaceTenant } from '../../../platform/database/workspace/tenant';
import { effectivePageAccessCondition } from '../permissions/queries';
import { KnowledgePermissionError } from '../permissions/errors';
import type { KnowledgeConsumer } from '../workers/types';

/**
 * 页面正文在 Y.Doc 中的权威承载碎片名（Tiptap Collaboration / y-prosemirror 的
 * 默认约定）。L01 的出链派生与后续 H01 块索引都以该碎片为正文边界。
 */
export const PAGE_BODY_FRAGMENT = 'default';

/** 一条正文中的出链（wiki 链接或块级 blockReference 节点），按写入原文提取，不做任何解析。 */
export interface PageBodyReference {
  /** 承载该链接的最近祖先块；无可用 blockId 的链接不产生反向引用（blockReference 用自身 blockId）。 */
  readonly srcBlockId: string;
  /** `[[target]]` 的目标文本；显式 pageId 存在时仅作展示，不参与解析（blockReference 恒为空）。 */
  readonly target: string;
  /** `[[target#^block]]` 的块锚点；非空时该链接是块引用。 */
  readonly targetBlockId: string | null;
  /** 编辑器已解析并写入节点属性的稳定 pageId（wikiLink.attrs.pageId / blockReference.attrs.pageId）。 */
  readonly explicitPageId: string | null;
}

export type ResolvedPageReference =
  | { status: 'linked'; srcBlockId: string; dstPageId: string; dstBlockId: string | null }
  /** 目标无法解析为当前工作区的稳定页面：悬链，不落 backlink 表、不参与入链查询。 */
  | { status: 'dangling'; srcBlockId: string; target: string; targetBlockId: string | null };

/**
 * 遍历 Y.Doc 正文碎片，收集全部 wikiLink 与块级 blockReference 节点。节点名与属性即
 * y-prosemirror 对 ProseMirror 文档的编码（块上的 blockId、wikiLink 上的 pageId/
 * target/targetBlockId、blockReference 上的 pageId/targetBlockId），因此无需在
 * backend 引入编辑器依赖即可获得与权威文档一致的视图。属性取值全部先经契约校验：
 * 损坏的锚点降级为页面链接，损坏的 blockId 忽略。
 */
export function extractPageBodyReferences(document: Y.Doc): PageBodyReference[] {
  const references: PageBodyReference[] = [];
  const visit = (node: Y.XmlElement | Y.XmlText | Y.XmlHook, carrier: string | null) => {
    if (!(node instanceof Y.XmlElement)) return;
    const attributes = node.getAttributes();
    const blockId = typeof attributes.blockId === 'string' && blockIdSchema.safeParse(attributes.blockId).success
      ? attributes.blockId
      : carrier;
    if (node.nodeName === 'wikiLink') {
      if (blockId === null) return;
      references.push({
        srcBlockId: blockId,
        target: typeof attributes.target === 'string' ? attributes.target : '',
        targetBlockId: typeof attributes.targetBlockId === 'string' && blockIdSchema.safeParse(attributes.targetBlockId).success
          ? attributes.targetBlockId
          : null,
        explicitPageId: typeof attributes.pageId === 'string' && entityIdSchema.safeParse(attributes.pageId).success
          ? attributes.pageId
          : null,
      });
      return;
    }
    if (node.nodeName === 'blockReference') {
      // 块级引用（atom，无子节点）：反向引用落在引用节点自身的 blockId 上；
      // 自身 blockId 无效时不产生反向引用，也不回退最近祖先——引用节点就是块本身。
      const ownBlockId = typeof attributes.blockId === 'string' && blockIdSchema.safeParse(attributes.blockId).success
        ? attributes.blockId
        : null;
      if (ownBlockId === null) return;
      references.push({
        srcBlockId: ownBlockId,
        target: '',
        targetBlockId: typeof attributes.targetBlockId === 'string' && blockIdSchema.safeParse(attributes.targetBlockId).success
          ? attributes.targetBlockId
          : null,
        explicitPageId: typeof attributes.pageId === 'string' && entityIdSchema.safeParse(attributes.pageId).success
          ? attributes.pageId
          : null,
      });
      return;
    }
    for (const child of node.toArray()) visit(child, blockId);
  };
  for (const child of document.getXmlFragment(PAGE_BODY_FRAGMENT).toArray()) visit(child, null);
  return references;
}

/**
 * 解析策略（设计文档 §4.6 / §7.1：`[[页面]]` 为标题链接，块引用附加 `#^blockId`）：
 * 1. 编辑器写入的显式 pageId 优先；它指向本工作区的一个未回收页面时解析成功。
 *    显式 ID 失效（页面被删、跨工作区）即悬链，不回退标题——避免把链接静默改指
 *    另一个同标题页面。
 * 2. 否则按标题在本工作区全部未回收页面中精确匹配；标题在本工作区不唯一时同样
 *    悬链，由编辑器通过显式 pageId 消歧。
 * 块引用的 dstBlockId 只记录锚点文本；该块是否仍存在由渲染时的来源页定位（L02）。
 */
export async function resolvePageReferences(db: WorkspaceTenantTransaction, scope: PageScope, references: readonly PageBodyReference[]): Promise<ResolvedPageReference[]> {
  if (!pageScopeSchema.safeParse(scope).success) throw new TypeError('Invalid page scope');
  const explicitIds = [...new Set(references.flatMap((reference) => (reference.explicitPageId ? [reference.explicitPageId] : [])))];
  const titles = [...new Set(references.filter((reference) => !reference.explicitPageId && reference.target).map((reference) => reference.target))];
  const matches = explicitIds.length || titles.length
    ? await db.select({ id: page.id, title: page.title }).from(page)
      .where(and(
        eq(page.workspaceId, scope.workspaceId),
        isNull(page.deletedAt),
        or(explicitIds.length ? inArray(page.id, explicitIds) : undefined, titles.length ? inArray(page.title, titles) : undefined),
      ))
    : [];
  const byId = new Map(matches.map((row) => [row.id, row]));
  const byTitle = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const row of matches) {
    if (byTitle.has(row.title)) ambiguous.add(row.title);
    else byTitle.set(row.title, row.id);
  }
  return references.map((reference) => {
    if (reference.explicitPageId) {
      const found = byId.get(reference.explicitPageId);
      return found
        ? { status: 'linked', srcBlockId: reference.srcBlockId, dstPageId: found.id, dstBlockId: reference.targetBlockId }
        : { status: 'dangling', srcBlockId: reference.srcBlockId, target: reference.target, targetBlockId: reference.targetBlockId };
    }
    const unique = reference.target && !ambiguous.has(reference.target) ? byTitle.get(reference.target) : undefined;
    return unique
      ? { status: 'linked', srcBlockId: reference.srcBlockId, dstPageId: unique, dstBlockId: reference.targetBlockId }
      : { status: 'dangling', srcBlockId: reference.srcBlockId, target: reference.target, targetBlockId: reference.targetBlockId };
  });
}

export interface PageBacklinkRefresh {
  /** 本次写入 backlink 表的去重后行数。 */
  linked: number;
  /** 解析为悬链的引用数。 */
  dangling: number;
}

/**
 * 以 doc_state 为唯一权威重算某页的全部出链并整页替换 backlink 行。
 * doc_state 行 FOR UPDATE 串行化同页并发重算；无 doc_state（正文从未持久化或页面
 * 已删除）时清空该页出链。删除+插入同事务提交，重跑结果恒等（幂等）。
 */
export async function refreshPageBacklinks(db: WorkspaceTenantTransaction, scope: PageScope, signal?: AbortSignal): Promise<PageBacklinkRefresh> {
  if (!pageScopeSchema.safeParse(scope).success) throw new TypeError('Invalid page scope');
  signal?.throwIfAborted();
  const [stored] = await db.select({ state: docState.state }).from(docState)
    .where(and(eq(docState.workspaceId, scope.workspaceId), eq(docState.pageId, scope.pageId))).for('update');
  let resolved: ResolvedPageReference[] = [];
  if (stored) {
    const document = new Y.Doc();
    Y.applyUpdate(document, new Uint8Array(stored.state));
    resolved = await resolvePageReferences(db, scope, extractPageBodyReferences(document));
  }
  signal?.throwIfAborted();
  const rows = new Map(resolved.flatMap((reference) => reference.status === 'linked'
    ? [[`${reference.srcBlockId}\0${reference.dstPageId}\0${reference.dstBlockId ?? ''}`,
      { workspaceId: scope.workspaceId, srcPageId: scope.pageId, srcBlockId: reference.srcBlockId, dstPageId: reference.dstPageId, dstBlockId: reference.dstBlockId }]]
    : []));
  await db.delete(backlink).where(and(eq(backlink.workspaceId, scope.workspaceId), eq(backlink.srcPageId, scope.pageId)));
  if (rows.size) await db.insert(backlink).values([...rows.values()]).onConflictDoNothing();
  // 同块内的重复出链按唯一约束去重,因此悬链数不能由总数相减得出。
  return { linked: rows.size, dangling: resolved.filter((reference) => reference.status === 'dangling').length };
}

/** L01 的 doc.changed 消费者：正文每次权威持久化后重算该页反向引用。 */
export function createBacklinkConsumer(pool: Pool): KnowledgeConsumer {
  return {
    name: 'update_backlinks',
    topic: 'doc.changed',
    async handle(event, context) {
      if (event.topic !== 'doc.changed') throw new TypeError('Unexpected event topic');
      await withWorkspaceTenant(pool, event.workspaceId, (db) =>
        refreshPageBacklinks(db, { workspaceId: event.workspaceId, pageId: event.pageId }, context.signal));
    },
  };
}

/** 某页当前的出链视图（含悬链状态），从 doc_state 即时计算，不读缓存表。 */
export async function readPageOutgoingReferences(db: WorkspaceTenantTransaction, scope: PageScope, signal?: AbortSignal): Promise<ResolvedPageReference[]> {
  if (!pageScopeSchema.safeParse(scope).success) throw new TypeError('Invalid page scope');
  signal?.throwIfAborted();
  const [stored] = await db.select({ state: docState.state }).from(docState)
    .where(and(eq(docState.workspaceId, scope.workspaceId), eq(docState.pageId, scope.pageId)));
  if (!stored) return [];
  const document = new Y.Doc();
  Y.applyUpdate(document, new Uint8Array(stored.state));
  return resolvePageReferences(db, scope, extractPageBodyReferences(document));
}

export interface PageBacklink {
  readonly srcPageId: string;
  readonly srcTitle: string;
  readonly srcBlockId: string;
  readonly dstBlockId: string | null;
}

/**
 * 某页的入链列表：backlink 表按目标命中后，来源页必须通过 P03 的
 * effectivePageAccessCondition(view) 过滤——请求者无 view 权限或已回收的来源页
 * 不可见；悬链不落表，因此也从不泄漏目标存在性。调用方自行完成对目标页本身的
 * 授权（本查询不是目标页的访问判断）。principals 必须来自服务端已验证身份展开。
 */
export async function readPageBacklinks(db: WorkspaceTenantTransaction, input: { workspaceId: string; pageId: string; principals: readonly Principal[] }): Promise<PageBacklink[]> {
  const scope = pageScopeSchema.safeParse({ workspaceId: input.workspaceId, pageId: input.pageId });
  if (!scope.success || !input.principals.every((value) => principalSchema.safeParse(value).success)) {
    throw new KnowledgePermissionError('INVALID_PERMISSION_INPUT');
  }
  const rows = await db.select({
    srcPageId: backlink.srcPageId, srcBlockId: backlink.srcBlockId, dstBlockId: backlink.dstBlockId, srcTitle: page.title,
  }).from(backlink)
    .innerJoin(page, and(eq(page.workspaceId, backlink.workspaceId), eq(page.id, backlink.srcPageId)))
    .where(and(
      eq(backlink.workspaceId, input.workspaceId),
      eq(backlink.dstPageId, input.pageId),
      effectivePageAccessCondition({ workspaceId: input.workspaceId, principals: [...input.principals], required: 'view' }),
    ))
    .orderBy(asc(page.title), asc(backlink.srcPageId), asc(backlink.srcBlockId), asc(backlink.dstBlockId));
  return rows;
}

/** 测试与验收脚本使用的行级观察口；生产读取一律走上方权限过滤查询。 */
export async function countPageBacklinkRows(db: WorkspaceTenantTransaction, workspaceId: string): Promise<number> {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(backlink).where(eq(backlink.workspaceId, workspaceId));
  return row?.total ?? 0;
}
