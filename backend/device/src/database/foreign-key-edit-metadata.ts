import { createHash } from "node:crypto";
import type { RelationalProvider, RelationalForeignKey } from "@fouc/shared";
import {
  FOREIGN_KEY_EDIT_LIMITS,
  type ForeignKeyEditOptions,
  type ForeignKeyTarget,
} from "@fouc/shared/foreign-key-edit";
import type {
  DriverStructure,
  RelationalDriver,
} from "./drivers/relational-driver";
import { DatabaseInputError } from "./input-error";

export function foreignKeyProvider(provider: RelationalProvider): void {
  if (provider !== "mysql" && provider !== "postgres")
    throw new DatabaseInputError("SQLite 外键变更需要重建表，当前入口尚未实现");
}
const check = (readable: () => void, signal?: AbortSignal) => {
  readable();
  signal?.throwIfAborted();
};

export async function foreignKeyTarget(
  driver: RelationalDriver,
  provider: RelationalProvider,
  schema: string,
  table: string,
  readable: () => void,
  signal?: AbortSignal,
) {
  foreignKeyProvider(provider);
  check(readable, signal);
  const schemas = await driver.schemas();
  check(readable, signal);
  if (!schemas.includes(schema))
    throw new DatabaseInputError("目标目录不属于当前连接的可见范围");
  const relations = await driver.tables(schema);
  check(readable, signal);
  const tables = relations
    .filter((item) => item.kind === "table")
    .map((item) => item.name);
  if (tables.length > FOREIGN_KEY_EDIT_LIMITS.tables)
    throw new DatabaseInputError(
      "目录超过1000张表，请缩小连接的可见范围后重试",
    );
  if (!table)
    return {
      schemas,
      target: {
        provider,
        schema,
        table,
        tables,
        columns: [],
        keys: [],
      } satisfies ForeignKeyTarget,
      structure: null,
      signature: "",
    };
  if (!tables.includes(table))
    throw new DatabaseInputError("只能修改当前连接中真实可读的普通表或分区表");
  await driver.assertEditable(schema, table);
  check(readable, signal);
  const columns = await driver.columns(schema, table);
  check(readable, signal);
  if (!columns.length || columns.length > FOREIGN_KEY_EDIT_LIMITS.columns)
    throw new DatabaseInputError("字段目录为空或超过1024字段范围");
  if (provider === "postgres") {
    const identity = await driver.read(
      `SELECT a.attname,a.attcollation::text FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped`,
      null,
      FOREIGN_KEY_EDIT_LIMITS.columns,
      [schema, table],
      signal,
    );
    check(readable, signal);
    for (const column of columns)
      column.collation = String(
        identity.rows.find((row) => row[0] === column.name)?.[1] ?? "unknown",
      );
  }
  const structure = await driver.structure(schema, table, columns);
  check(readable, signal);
  const keys = structure.indexes
    .filter((index) => {
      const parts = index.parts.filter((part) => part.role === "key");
      return (
        index.unique &&
        index.valid === true &&
        !index.predicate &&
        /^btree$/i.test(index.method) &&
        parts.length > 0 &&
        parts.length <= FOREIGN_KEY_EDIT_LIMITS.pairs &&
        parts.every(
          (part) =>
            part.column && !part.expression && part.prefixLength === null,
        ) &&
        !structure.constraints.some(
          (constraint) =>
            constraint.name === index.name && constraint.deferrable === true,
        )
      );
    })
    .map((index) => ({
      name: index.name,
      columns: index.parts
        .filter((part) => part.role === "key")
        .sort((a, b) => a.position - b.position)
        .map((part) => part.column!),
    }));
  const target: ForeignKeyTarget = {
    provider,
    schema,
    table,
    tables,
    columns,
    keys,
  };
  const signature = createHash("sha256")
    .update(
      JSON.stringify({
        kind: structure.kind,
        columns,
        indexes: structure.indexes,
        foreignKeys: structure.foreignKeys,
        constraints: structure.constraints,
        properties: structure.properties,
      }),
    )
    .digest("hex");
  return { schemas, target, structure, signature };
}

export async function foreignKeyOptions(
  driver: RelationalDriver,
  provider: RelationalProvider,
  schema: string,
  table: string,
  readable: () => void,
  signal?: AbortSignal,
): Promise<ForeignKeyEditOptions> {
  const snapshot = await foreignKeyTarget(
    driver,
    provider,
    schema,
    table,
    readable,
    signal,
  );
  if (!snapshot.structure) throw new DatabaseInputError("请选择实际数据表");
  return {
    ...snapshot.target,
    schemas: snapshot.schemas,
    foreignKeys: snapshot.structure.foreignKeys,
    warnings: [
      provider === "mysql"
        ? "MySQL只支持InnoDB；ALTER和REFERENCES权限由原生服务器最终校验。"
        : "PostgreSQL须拥有本表并具有引用字段的REFERENCES权限。",
      "当前要求对应字段类型、字符集和排序规则完全一致；引用完整、非延迟、非表达式唯一键，按目录顺序匹配。",
    ],
  };
}

export async function foreignKeyNativeRights(
  driver: RelationalDriver,
  provider: RelationalProvider,
  schema: string,
  table: string,
  foreign: { schema: string; table: string; columns: string[] } | null,
  readable: () => void,
  signal?: AbortSignal,
): Promise<void> {
  check(readable, signal);
  if (provider === "mysql") return; // SHOW GRANTS cannot prove the effective privileges of all active native roles.
  const owner = await driver.read(
    `SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`,
    null,
    1,
    [schema, table],
    signal,
  );
  check(readable, signal);
  if (owner.rows[0]?.[0] !== true)
    throw new DatabaseInputError(
      "当前PostgreSQL角色不是本表所有者，也未继承所有者权限",
    );
  if (!foreign) return;
  for (const column of foreign.columns) {
    const reference = await driver.read(
      `SELECT has_schema_privilege(current_user,n.oid,'USAGE') AND has_column_privilege(current_user,c.oid,$3,'REFERENCES')
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`,
      null,
      1,
      [foreign.schema, foreign.table, column],
      signal,
    );
    check(readable, signal);
    if (reference.rows[0]?.[0] !== true)
      throw new DatabaseInputError(
        `当前角色缺少引用字段 ${column} 的REFERENCES权限`,
      );
  }
}

export function requireCatalogForeignKey(
  structure: DriverStructure,
  name: string,
): RelationalForeignKey {
  const foreign = structure.foreignKeys.find(
    (item) => item.name === name && item.nameSource === "catalog",
  );
  if (!foreign)
    throw new DatabaseInputError("指定外键不存在或没有可执行的真实目录名称");
  return foreign;
}
