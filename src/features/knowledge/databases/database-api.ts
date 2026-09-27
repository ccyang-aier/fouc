'use client';

/**
 * 数据库客户端数据面（U06）——与 data/pages-api.ts 同一模式（U01）。
 *
 * T02 服务（backend/src/knowledge/databases/service.ts）已有领域实现，但 tRPC
 * 路由由 Z03 装配；因此这里经非类型化 tRPC 客户端动态调用
 * `database.getColumns / listRows / createRow / updateRowProperties /
 * updateColumns`（与 T02 服务函数一一对应），输入先过共享 zod 契约镜像（非法
 * 输入零请求快速失败），响应逐个过契约校验——契约不符归一 UNAVAILABLE，未装配
 * 路由归一 NOT_FOUND，绝不伪造数据。
 */

import {
  createRowInputSchema,
  databaseColumnsStateSchema,
  databaseRowsPageSchema,
  pagePlacementSchema,
  queryDatabaseInputSchema,
  rowPropertiesStateSchema,
  updateDatabaseColumnsInputSchema,
  updatePropertiesInputSchema,
} from '@fouc/shared/knowledge/contracts';
import type {
  CreateRowInput,
  DatabaseColumnsState,
  DatabaseRowsPage,
  DatabaseQuery,
  PagePlacement,
  RowPropertiesState,
  UpdateDatabaseColumnsInput,
} from '@fouc/shared/knowledge/contracts';
import { getKnowledgeApiOrigin } from '../data/endpoint';
import { KnowledgeDataError, normalizeKnowledgeError } from '../data/errors';
import { createKnowledgeUntypedClientCache, type KnowledgeFetch, type KnowledgeUntypedTrpcClient } from '../data/trpc-client';

function parsePayload<T>(schema: { safeParse(payload: unknown): { success: true; data: T } | { success: false } }, payload: unknown, procedure: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new KnowledgeDataError('UNAVAILABLE', { message: `数据库服务 ${procedure} 返回的数据不符合契约。` });
  }
  return parsed.data;
}

function assertInput(schema: { safeParse(payload: unknown): { success: true } | { success: false } }, input: unknown, procedure: string): void {
  if (!schema.safeParse(input).success) {
    throw new KnowledgeDataError('INVALID_REQUEST', { message: `${procedure} 的输入不符合数据库契约。` });
  }
}

/** 页面作用域之外的输入体：workspaceId 由方法首参注入，不经调用方重复传递。 */
export type UpdateRowPropertiesInput = { pageId: string; properties: RowPropertiesState['properties']; operationId: string };
export type UpdateColumnsInput = Omit<UpdateDatabaseColumnsInput, 'workspaceId'>;

export type KnowledgeDatabasesApi = {
  getColumns(workspaceId: string, input: { pageId: string }, signal?: AbortSignal): Promise<DatabaseColumnsState>;
  listRows(workspaceId: string, input: Omit<DatabaseQuery, 'workspaceId'>, signal?: AbortSignal): Promise<DatabaseRowsPage>;
  createRow(workspaceId: string, input: CreateRowInput, signal?: AbortSignal): Promise<PagePlacement>;
  updateRowProperties(workspaceId: string, input: UpdateRowPropertiesInput, signal?: AbortSignal): Promise<RowPropertiesState>;
  updateColumns(workspaceId: string, input: UpdateColumnsInput, signal?: AbortSignal): Promise<DatabaseColumnsState>;
};

/** 构建一个传输之上的数据库面：origin 解析器 + 可注入 fetch（测试假传输入口）。 */
export function createKnowledgeDatabasesApi(deps: { resolveOrigin: () => Promise<string> | string; fetchImpl?: KnowledgeFetch }): KnowledgeDatabasesApi {
  const cache = createKnowledgeUntypedClientCache(deps.fetchImpl);
  const run = async <T,>(workspaceId: string, signal: AbortSignal | undefined, invoke: (client: KnowledgeUntypedTrpcClient) => Promise<T>): Promise<T> => {
    try {
      const origin = await deps.resolveOrigin();
      return await invoke(cache.get(origin, workspaceId));
    } catch (cause) {
      throw normalizeKnowledgeError(cause, signal);
    }
  };

  return {
    async getColumns(workspaceId, input, signal) {
      const payload = await run(workspaceId, signal, (client) =>
        client.query('database.getColumns', { workspaceId, ...input }, { signal }),
      );
      return parsePayload(databaseColumnsStateSchema, payload, 'database.getColumns');
    },
    async listRows(workspaceId, input, signal) {
      const query = { workspaceId, ...input };
      assertInput(queryDatabaseInputSchema, query, 'database.listRows');
      const payload = await run(workspaceId, signal, (client) => client.query('database.listRows', query, { signal }));
      return parsePayload(databaseRowsPageSchema, payload, 'database.listRows');
    },
    async createRow(workspaceId, input, signal) {
      assertInput(createRowInputSchema, input, 'database.createRow');
      const payload = await run(workspaceId, signal, (client) => client.mutation('database.createRow', input, { signal }));
      return parsePayload(pagePlacementSchema, payload, 'database.createRow');
    },
    async updateRowProperties(workspaceId, input, signal) {
      assertInput(updatePropertiesInputSchema, { workspaceId, ...input }, 'database.updateRowProperties');
      const payload = await run(workspaceId, signal, (client) => client.mutation('database.updateRowProperties', { workspaceId, ...input }, { signal }));
      return parsePayload(rowPropertiesStateSchema, payload, 'database.updateRowProperties');
    },
    async updateColumns(workspaceId, input, signal) {
      assertInput(updateDatabaseColumnsInputSchema, { workspaceId, ...input }, 'database.updateColumns');
      const payload = await run(workspaceId, signal, (client) => client.mutation('database.updateColumns', { workspaceId, ...input }, { signal }));
      return parsePayload(databaseColumnsStateSchema, payload, 'database.updateColumns');
    },
  };
}

/** 浏览器绑定：U01 端点解析器 + 全局 fetch。 */
export const knowledgeDatabasesApi = createKnowledgeDatabasesApi({
  resolveOrigin: async () => (await getKnowledgeApiOrigin()).origin,
});
