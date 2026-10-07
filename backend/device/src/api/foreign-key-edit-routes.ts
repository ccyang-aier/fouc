import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  FOREIGN_KEY_EDIT_LIMITS,
  foreignKeyEditRequestSchema,
  type ForeignKeyEditOptions,
  type ForeignKeyTarget,
  type ForeignKeyEditPrepared,
  type ForeignKeyEditCommitResult,
} from "@fouc/shared/foreign-key-edit";
import { DatabaseInputError } from "../database/input-error";

export interface ForeignKeyEditRouteService {
  foreignKeyEditOptions(
    id: string,
    schema: string,
    table: string,
    signal?: AbortSignal,
  ): Promise<ForeignKeyEditOptions>;
  foreignKeyEditTarget(
    id: string,
    schema: string,
    table: string,
    signal?: AbortSignal,
  ): Promise<ForeignKeyTarget>;
  prepareForeignKeyEdit(
    id: string,
    value: unknown,
    signal?: AbortSignal,
  ): Promise<ForeignKeyEditPrepared>;
  commitForeignKeyEdit(
    id: string,
    planId: string,
    signal?: AbortSignal,
  ): Promise<ForeignKeyEditCommitResult>;
  discardForeignKeyEdit(id: string, planId: string): void;
}
export function foreignKeyEditRoutes(service: ForeignKeyEditRouteService) {
  const app = new Hono();
  const base =
    "/api/database/relational/sessions/:id/foreign-key-edit";
  app.use(
    `${base}/*`,
    bodyLimit({
      maxSize: FOREIGN_KEY_EDIT_LIMITS.requestBytes,
      onError: () => {
        throw new DatabaseInputError("外键请求超过64KiB范围");
      },
    }),
  );
  for (const facet of ["options", "target"] as const)
    app.get(`${base}/${facet}`, async (c) => {
      const query = c.req.query();
      if (
        Object.keys(query).some((key) => key !== "schema" && key !== "table") ||
        !query.schema ||
        query.schema.length > 256 ||
        (query.table?.length ?? 0) > 256 ||
        (facet === "options" && !query.table)
      )
        throw new DatabaseInputError("请提供实际目录和数据表，不接受客户端SQL");
      const method =
        facet === "options"
          ? service.foreignKeyEditOptions.bind(service)
          : service.foreignKeyEditTarget.bind(service);
      return c.json({
        ok: true,
        data: await method(
          c.req.param("id")!,
          query.schema,
          query.table ?? "",
          c.req.raw.signal,
        ),
      });
    });
  app.post(`${base}/plans`, async (c) => {
    const input = foreignKeyEditRequestSchema.safeParse(await c.req.json());
    if (!input.success)
      throw new DatabaseInputError(
        input.error.issues[0]?.message ?? "外键审查请求无效",
      );
    return c.json({
      ok: true,
      data: await service.prepareForeignKeyEdit(
        c.req.param("id")!,
        input.data,
        c.req.raw.signal,
      ),
    });
  });
  app.post(`${base}/plans/:planId/commit`, async (c) => {
    const input: unknown = await c.req.json();
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      (input as Record<string, unknown>).confirm !== true
    )
      throw new DatabaseInputError("请明确确认已审查的外键DDL");
    return c.json({
      ok: true,
      data: await service.commitForeignKeyEdit(
        c.req.param("id")!,
        c.req.param("planId")!,
        c.req.raw.signal,
      ),
    });
  });
  app.delete(`${base}/plans/:planId`, (c) => {
    service.discardForeignKeyEdit(
      c.req.param("id")!,
      c.req.param("planId")!,
    );
    return c.json({ ok: true, data: null });
  });
  return app;
}
