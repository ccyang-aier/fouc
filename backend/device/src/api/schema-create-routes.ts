import { Hono } from 'hono';
import type { SchemaCreateCommitResult, SchemaCreateOptions, SchemaCreatePrepared } from '@fouc/shared/schema-create';
import { DatabaseInputError } from '../database/input-error';

async function boundedInput(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 4096) throw new DatabaseInputError('创建请求超过 4 KiB 上限。');
  const reader = request.body?.getReader();
  if (!reader) throw new DatabaseInputError('缺少创建参数。');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.length;
      if (bytes > 4096) { await reader.cancel(); throw new DatabaseInputError('创建请求超过 4 KiB 上限。'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
  catch { throw new DatabaseInputError('创建参数不是有效的 UTF-8 JSON。'); }
}

export interface SchemaCreateRouteService {
  schemaCreateOptions(id: string, signal?: AbortSignal): Promise<SchemaCreateOptions>;
  prepareSchemaCreate(id: string, value: unknown, signal?: AbortSignal): Promise<SchemaCreatePrepared>;
  commitSchemaCreate(id: string, planId: string, signal?: AbortSignal): Promise<SchemaCreateCommitResult>;
  discardSchemaCreate(id: string, planId: string): void;
}

export function schemaCreateRoutes(service: SchemaCreateRouteService) {
  const app = new Hono();
  const base = '/api/database/relational/sessions/:id/schema-create';
  app.get(`${base}/options`, async c => {
    if (Object.keys(c.req.query()).length) throw new DatabaseInputError('创建选项不接受客户端 SQL。');
    return c.json({ ok: true, data: await service.schemaCreateOptions(c.req.param('id')!, c.req.raw.signal) });
  });
  app.post(`${base}/plans`, async c => {
    const value = await boundedInput(c.req.raw);
    return c.json({ ok: true, data: await service.prepareSchemaCreate(c.req.param('id')!, value, c.req.raw.signal) });
  });
  app.post(`${base}/plans/:planId/commit`, async c => {
    const value = await boundedInput(c.req.raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || (value as Record<string, unknown>).confirm !== true) throw new DatabaseInputError('请显式确认已审查的创建计划。');
    return c.json({ ok: true, data: await service.commitSchemaCreate(c.req.param('id')!, c.req.param('planId')!, c.req.raw.signal) });
  });
  app.delete(`${base}/plans/:planId`, c => {
    service.discardSchemaCreate(c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: null });
  });
  return app;
}
