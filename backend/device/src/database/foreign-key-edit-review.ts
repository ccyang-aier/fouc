import type { RelationalProvider } from "@fouc/shared";
import {
  foreignKeyEditInputSchema,
  type ForeignKeyEditReview,
} from "@fouc/shared/foreign-key-edit";
import type { RelationalDriver } from "./drivers/relational-driver";
import { DatabaseInputError } from "./input-error";
import {
  foreignKeyTarget,
  foreignKeyNativeRights,
  requireCatalogForeignKey,
} from "./foreign-key-edit-metadata";

export async function reviewForeignKey(
  driver: RelationalDriver,
  provider: RelationalProvider,
  schema: string,
  table: string,
  value: unknown,
  readable: () => void,
  signal?: AbortSignal,
) {
  const parsed = foreignKeyEditInputSchema.safeParse(value);
  if (!parsed.success)
    throw new DatabaseInputError(
      parsed.error.issues[0]?.message ?? "外键输入无效",
    );
  const input = parsed.data;
  const bytes = Buffer.byteLength(input.name, "utf8");
  if (!input.name.trim() || bytes > (provider === "postgres" ? 63 : 64))
    throw new DatabaseInputError("外键名称为空或超过当前原生名称长度上限");
  const local = await foreignKeyTarget(
    driver,
    provider,
    schema,
    table,
    readable,
    signal,
  );
  if (!local.structure) throw new DatabaseInputError("本表结构不可用");
  const quote = driver.quoteIdentifier;
  const target = `${quote(schema)}.${quote(table)}`;
  let referenceSignature: string | null = null;
  let sql: string;
  const warnings = [
    provider === "mysql"
      ? "MySQL DDL会隐式提交，无法通过ROLLBACK撤销；删除外键可能保留服务器自动创建的索引。"
      : "PostgreSQL使用原生事务；DDL会锁定涉及的数据表，现有行不符合约束时创建会被拒绝。",
    "提交前重新核对两表目录和权限；外部DDL可并发发生，不能保证跨外部操作的原子排他。",
  ];
  if (input.kind === "drop") {
    requireCatalogForeignKey(local.structure, input.name);
    await foreignKeyNativeRights(
      driver,
      provider,
      schema,
      table,
      null,
      readable,
      signal,
    );
    sql = `ALTER TABLE ${target} DROP ${provider === "mysql" ? "FOREIGN KEY" : "CONSTRAINT"} ${quote(input.name)};`;
    warnings.push(
      "删除外键后数据库不再阻止本关系的孤立记录；不会删除表或现有数据。",
    );
  } else {
    const reference = await foreignKeyTarget(
      driver,
      provider,
      input.referencedSchema,
      input.referencedTable,
      readable,
      signal,
    );
    if (!reference.structure) throw new DatabaseInputError("引用表结构不可用");
    if (
      local.structure.constraints.some((item) => item.name === input.name) ||
      local.structure.foreignKeys.some((item) => item.name === input.name)
    )
      throw new DatabaseInputError("本表已有同名约束，请更换外键名称");
    if (provider === "mysql") {
      const duplicate = await driver.read(
        "SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND CONSTRAINT_NAME=?",
        null,
        1,
        [schema, input.name],
        signal,
      );
      readable();
      signal?.throwIfAborted();
      if (duplicate.rows.length)
        throw new DatabaseInputError("当前MySQL数据库已有同名外键");
    }
    const localNames = input.columns.map((pair) => pair.local),
      referenceNames = input.columns.map((pair) => pair.referenced);
    if (
      new Set(localNames).size !== localNames.length ||
      new Set(referenceNames).size !== referenceNames.length
    )
      throw new DatabaseInputError("外键的本地字段和引用字段不能重复");
    if (
      !reference.target.keys.some(
        (key) => JSON.stringify(key.columns) === JSON.stringify(referenceNames),
      )
    )
      throw new DatabaseInputError(
        "引用字段必须按目录顺序对应一个完整、有效、非延迟唯一键",
      );
    for (const pair of input.columns) {
      const left = local.target.columns.find(
          (column) => column.name === pair.local,
        ),
        right = reference.target.columns.find(
          (column) => column.name === pair.referenced,
        );
      if (!left || !right)
        throw new DatabaseInputError("选定字段不存在，请重新读取两表目录");
      if (
        /\bgenerated\b/i.test(left.extra ?? "") ||
        /\bgenerated\b/i.test(right.extra ?? "")
      )
        throw new DatabaseInputError("当前外键入口不支持计算生成字段");
      if (
        left.dataType.toLowerCase() !== right.dataType.toLowerCase() ||
        (left.characterSet ?? null) !== (right.characterSet ?? null) ||
        (left.collation ?? null) !== (right.collation ?? null)
      )
        throw new DatabaseInputError(
          `字段 ${pair.local} 与 ${pair.referenced} 的原生类型、字符集或排序规则不一致`,
        );
      if (
        (input.onDelete === "SET NULL" || input.onUpdate === "SET NULL") &&
        !left.isNullable
      )
        throw new DatabaseInputError("SET NULL要求全部本地外键字段允许NULL");
    }
    await foreignKeyNativeRights(
      driver,
      provider,
      schema,
      table,
      {
        schema: input.referencedSchema,
        table: input.referencedTable,
        columns: referenceNames,
      },
      readable,
      signal,
    );
    referenceSignature = reference.signature;
    sql = `ALTER TABLE ${target} ADD CONSTRAINT ${quote(input.name)} FOREIGN KEY (${localNames.map(quote).join(", ")}) REFERENCES ${quote(input.referencedSchema)}.${quote(input.referencedTable)} (${referenceNames.map(quote).join(", ")}) ON DELETE ${input.onDelete} ON UPDATE ${input.onUpdate};`;
    if (input.onDelete === "CASCADE" || input.onUpdate === "CASCADE")
      warnings.push(
        "CASCADE会在后续引用行删除或更新时修改关联记录，请审查关系方向。",
      );
  }
  const review: ForeignKeyEditReview = {
    provider,
    schema,
    table,
    input,
    sql,
    transaction: provider === "mysql" ? "implicit" : "atomic",
    warnings,
  };
  return {
    review,
    signature: `${local.signature}:${referenceSignature ?? ""}`,
  };
}
