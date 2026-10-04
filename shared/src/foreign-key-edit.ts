import { z } from "zod";
import type { DatabaseColumnInfo } from "./database";
import type { RelationalForeignKey } from "./relational-structure";
import type { RelationalProvider } from "./relational";

export const FOREIGN_KEY_EDIT_LIMITS = {
  pairs: 16,
  plans: 4,
  lifetimeMs: 300_000,
  requestBytes: 64 * 1024,
  tables: 1000,
  columns: 1024,
} as const;
export const FOREIGN_KEY_ACTIONS = [
  "NO ACTION",
  "RESTRICT",
  "CASCADE",
  "SET NULL",
] as const;
const identifier = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !/[\u0000-\u001f]/.test(value), "标识符不能包含控制字符");
const create = z
  .object({
    kind: z.literal("create"),
    name: identifier,
    referencedSchema: identifier,
    referencedTable: identifier,
    columns: z
      .array(z.object({ local: identifier, referenced: identifier }).strict())
      .min(1)
      .max(FOREIGN_KEY_EDIT_LIMITS.pairs),
    onDelete: z.enum(FOREIGN_KEY_ACTIONS),
    onUpdate: z.enum(FOREIGN_KEY_ACTIONS),
  })
  .strict();
export const foreignKeyEditInputSchema = z.discriminatedUnion("kind", [
  create,
  z.object({ kind: z.literal("drop"), name: identifier }).strict(),
]);
export const foreignKeyEditRequestSchema = z
  .object({
    schema: identifier,
    table: identifier,
    input: foreignKeyEditInputSchema,
  })
  .strict();
export type ForeignKeyEditInput = z.infer<typeof foreignKeyEditInputSchema>;
export interface ForeignKeyReferenceKey {
  name: string;
  columns: string[];
}
export interface ForeignKeyTarget {
  provider: RelationalProvider;
  schema: string;
  table: string;
  tables: string[];
  columns: DatabaseColumnInfo[];
  keys: ForeignKeyReferenceKey[];
}
export interface ForeignKeyEditOptions extends ForeignKeyTarget {
  schemas: string[];
  foreignKeys: RelationalForeignKey[];
  warnings: string[];
}
export interface ForeignKeyEditReview {
  provider: RelationalProvider;
  schema: string;
  table: string;
  input: ForeignKeyEditInput;
  sql: string;
  transaction: "atomic" | "implicit";
  warnings: string[];
}
export interface ForeignKeyEditPrepared {
  planId: string;
  expiresAt: number;
  review: ForeignKeyEditReview;
}
export interface ForeignKeyEditCommitResult {
  outcome: "applied" | "rejected" | "unknown";
  message: string;
  schema: string;
  table: string;
  sql: string;
  executionTimeMs: number;
}
