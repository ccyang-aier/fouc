import { expect, test } from "bun:test";
import type { DatabaseColumnInfo, RelationalProvider } from "@fouc/shared";
import type { ForeignKeyEditInput } from "@fouc/shared/foreign-key-edit";
import type {
  DriverStructure,
  RelationalDriver,
} from "./drivers/relational-driver";
import { ForeignKeyEditPlans } from "./foreign-key-edit-plans";

const column = (name: string): DatabaseColumnInfo => ({
  name,
  dataType: "integer",
  isNullable: false,
  columnDefault: null,
  isPrimaryKey: false,
  isUnique: false,
  extra: null,
  comment: null,
  numericPrecision: null,
  numericScale: null,
  characterMaximumLength: null,
});
const create: ForeignKeyEditInput = {
  kind: "create",
  name: "fk_pair",
  referencedSchema: "app",
  referencedTable: "parent",
  columns: [
    { local: "a", referenced: "a" },
    { local: "b", referenced: "b" },
  ],
  onDelete: "RESTRICT",
  onUpdate: "CASCADE",
};

function fixture(provider: RelationalProvider = "postgres") {
  const parentColumns = [column("a"), column("b")],
    localColumns = [column("a"), column("b")];
  const parent: DriverStructure = {
    schema: "app",
    table: "parent",
    kind: "table",
    indexes: [
      {
        name: "parent_key",
        method: "btree",
        unique: true,
        primary: false,
        valid: true,
        visible: true,
        constraintBacked: false,
        predicate: null,
        definition: null,
        comment: null,
        parts: ["a", "b"].map((name, index) => ({
          position: index + 1,
          column: name,
          expression: null,
          role: "key",
          descending: false,
          nulls: null,
          prefixLength: null,
          collation: null,
        })),
      },
    ],
    foreignKeys: [],
    constraints: [],
    triggers: [],
    properties: { engine: "InnoDB" },
    definition: { sql: "", origin: "native", warnings: [] },
  };
  const local: DriverStructure = {
    ...structuredClone(parent),
    table: "child",
    indexes: [],
  };
  let writes = 0,
    failStatement = "",
    failCommit = false;
  const driver: RelationalDriver = {
    info: {},
    quoteIdentifier: (value) =>
      provider === "mysql"
        ? "`" + value.replaceAll("`", "``") + "`"
        : '"' + value.replaceAll('"', '""') + '"',
    schemas: async () => ["app"],
    tables: async () =>
      ["child", "parent"].map((name) => ({
        name,
        schema: "app",
        kind: "table",
        comment: null,
      })),
    columns: async (_schema, table) =>
      structuredClone(table === "parent" ? parentColumns : localColumns),
    structure: async (_schema, table) =>
      structuredClone(table === "parent" ? parent : local),
    assertEditable: async () => {},
    close: async () => {},
    read: async (sql) => ({
      columns: [],
      columnTypes: [],
      rows: sql.includes("attcollation")
        ? [
            ["a", "0"],
            ["b", "0"],
          ]
        : sql.includes("REFERENTIAL_CONSTRAINTS")
          ? []
          : [[true]],
      hasMore: false,
    }),
    transaction: async (_schema, run) => {
      const value = await run({
        query: async () => {
          writes++;
          if (failStatement)
            throw Object.assign(new Error("native rejection"), {
              code: failStatement,
            });
          return {
            columns: [],
            columnTypes: [],
            rows: [],
            hasMore: false,
            affectedRows: 0,
          };
        },
      });
      if (failCommit) throw new Error("commit acknowledgement lost");
      return value;
    },
  };
  return {
    driver,
    parent,
    local,
    parentColumns,
    localColumns,
    writes: () => writes,
    setFailure: (statement: string, commit = false) => {
      failStatement = statement;
      failCommit = commit;
    },
  };
}

test("readonly compound-key review creates controlled quoted DDL; stale or consumed plans cannot write", async () => {
  const value = fixture(),
    plans = new ForeignKeyEditPlans();
  const held = await plans.prepare(
    value.driver,
    "postgres",
    "app",
    "child",
    create,
    () => {},
  );
  expect(value.writes()).toBe(0);
  expect(held.review.sql).toBe(
    'ALTER TABLE "app"."child" ADD CONSTRAINT "fk_pair" FOREIGN KEY ("a", "b") REFERENCES "app"."parent" ("a", "b") ON DELETE RESTRICT ON UPDATE CASCADE;',
  );
  value.parent.properties.comment = "changed after review";
  expect(
    (await plans.commit(value.driver, held.planId, () => {})).outcome,
  ).toBe("rejected");
  expect(value.writes()).toBe(0);
  await expect(
    plans.commit(value.driver, held.planId, () => {}),
  ).rejects.toThrow("失效");
  const next = await plans.prepare(
    value.driver,
    "postgres",
    "app",
    "child",
    create,
    () => {},
  );
  plans.clear();
  await expect(
    plans.commit(value.driver, next.planId, () => {}),
  ).rejects.toThrow("失效");
});

test("reference order, type, generated, nullable and incomplete keys are checked against actual metadata", async () => {
  const scenarios: Array<(value: ReturnType<typeof fixture>) => unknown> = [
    () => ({
      ...create,
      columns: [
        { local: "a", referenced: "b" },
        { local: "b", referenced: "a" },
      ],
    }),
    (value) => {
      value.parentColumns[0]!.dataType = "bigint";
      return create;
    },
    (value) => {
      value.localColumns[0]!.extra = "generated";
      return create;
    },
    () => ({ ...create, onDelete: "SET NULL" }),
    (value) => {
      value.parent.indexes[0]!.predicate = "a > 0";
      return create;
    },
    (value) => {
      value.parent.indexes[0]!.parts[0]!.prefixLength = 3;
      return create;
    },
    () => ({ ...create, sql: "ALTER TABLE arbitrary" }),
  ];
  for (const change of scenarios) {
    const value = fixture();
    const input = change(value);
    await expect(
      new ForeignKeyEditPlans().prepare(
        value.driver,
        "postgres",
        "app",
        "child",
        input,
        () => {},
      ),
    ).rejects.toThrow();
    expect(value.writes()).toBe(0);
  }
  const valid = fixture();
  valid.localColumns[0]!.extra = "DEFAULT_GENERATED";
  valid.parentColumns[0]!.extra = "identity";
  expect(
    (
      await new ForeignKeyEditPlans().prepare(
        valid.driver,
        "postgres",
        "app",
        "child",
        create,
        () => {},
      )
    ).review.input.kind,
  ).toBe("create");
});

test("drop needs a real catalog FK; native rejection and lost commit acknowledgements have distinct outcomes", async () => {
  const value = fixture(),
    plans = new ForeignKeyEditPlans();
  await expect(
    plans.prepare(
      value.driver,
      "postgres",
      "app",
      "child",
      { kind: "drop", name: "made-up" },
      () => {},
    ),
  ).rejects.toThrow("不存在");
  value.local.foreignKeys.push({
    name: "existing",
    nameSource: "catalog",
    columns: ["a", "b"],
    referencedSchema: "app",
    referencedTable: "parent",
    referencedColumns: ["a", "b"],
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
    match: "SIMPLE",
    deferrable: false,
    initiallyDeferred: false,
    validated: true,
    definition: null,
  });
  const drop = await plans.prepare(
    value.driver,
    "postgres",
    "app",
    "child",
    { kind: "drop", name: "existing" },
    () => {},
  );
  expect(drop.review.sql).toBe(
    'ALTER TABLE "app"."child" DROP CONSTRAINT "existing";',
  );
  value.setFailure("23503");
  expect(
    (await plans.commit(value.driver, drop.planId, () => {})).outcome,
  ).toBe("rejected");
  value.setFailure("", true);
  const second = await plans.prepare(
    value.driver,
    "postgres",
    "app",
    "child",
    { kind: "drop", name: "existing" },
    () => {},
  );
  expect(
    (await plans.commit(value.driver, second.planId, () => {})).outcome,
  ).toBe("unknown");
  const mysql = fixture("mysql");
  const implicit = await new ForeignKeyEditPlans().prepare(
    mysql.driver,
    "mysql",
    "app",
    "child",
    create,
    () => {},
  );
  expect(implicit.review.transaction).toBe("implicit");
  expect(implicit.review.sql).toContain("ADD CONSTRAINT `fk_pair`");
  await expect(
    new ForeignKeyEditPlans().options(
      mysql.driver,
      "sqlite",
      "app",
      "child",
      () => {},
    ),
  ).rejects.toThrow("尚未实现");
});
