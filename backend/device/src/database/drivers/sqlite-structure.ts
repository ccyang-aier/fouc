import type {
  DatabaseColumnInfo,
  RelationalConstraint,
  RelationalForeignKey,
  RelationalIndex,
  RelationalTrigger,
} from '@fouc/shared';
import { DatabaseInputError } from '../input-error';
import { quoteRelationalIdentifier as quote } from '../relational-sql';
import type { DriverStructure } from './relational-driver';

type SqliteCatalog = {
  all(sql: string, ...values: string[]): Record<string, unknown>[];
};
const nullable = (value: unknown) => (value == null ? null : String(value));

/** DBX sqlite.rs: native schema source, PRAGMA keys and grouped FK ordinals. */
export function sqliteStructure(
  catalog: SqliteCatalog,
  schema: string,
  table: string,
  columns: DatabaseColumnInfo[],
): DriverStructure {
  if (schema !== 'main') throw new DatabaseInputError('SQLite 会话仅支持 main');
  const relation = catalog.all(
    "SELECT type,sql FROM sqlite_schema WHERE name=? AND type IN ('table','view')",
    table,
  )[0];
  if (!relation) throw new DatabaseInputError('对象不存在或当前账号无权读取结构');
  const rows = catalog.all(`PRAGMA main.index_list(${quote(table)})`);
  const indexes: RelationalIndex[] = rows.map((row) => ({
    name: String(row.name),
    method: 'btree',
    unique: Number(row.unique) === 1,
    primary: row.origin === 'pk',
    valid: true,
    visible: null,
    constraintBacked: row.origin !== 'c',
    predicate: null,
    comment: null,
    definition: nullable(
      catalog.all(
        "SELECT sql FROM sqlite_schema WHERE type='index' AND name=?",
        String(row.name),
      )[0]?.sql,
    ),
    parts: catalog.all(`PRAGMA main.index_xinfo(${quote(String(row.name))})`).map((part) => ({
      position: Number(part.seqno) + 1,
      column: nullable(part.name),
      expression: null,
      role: Number(part.key) === 1 ? 'key' : 'auxiliary',
      descending: Number(part.desc) === 1,
      nulls: null,
      prefixLength: null,
      collation: nullable(part.coll),
    })),
  }));
  const foreignKeys: RelationalForeignKey[] = [];
  const foreignRows = catalog
    .all(`PRAGMA main.foreign_key_list(${quote(table)})`)
    .sort((a, b) => Number(a.id) - Number(b.id) || Number(a.seq) - Number(b.seq));
  for (const row of foreignRows) {
    const name = `fk_${row.id}`;
    let foreign = foreignKeys.find((item) => item.name === name);
    if (!foreign) {
      foreign = {
        name,
        nameSource: 'synthetic',
        columns: [],
        referencedSchema: 'main',
        referencedTable: String(row.table),
        referencedColumns: [],
        onUpdate: String(row.on_update),
        onDelete: String(row.on_delete),
        match: String(row.match),
        deferrable: null,
        initiallyDeferred: null,
        validated: null,
        definition: null,
      };
      foreignKeys.push(foreign);
    }
    const primary =
      row.to == null
        ? catalog
            .all(`PRAGMA main.table_xinfo(${quote(String(row.table))})`)
            .filter((part) => Number(part.pk) > 0)
            .sort((a, b) => Number(a.pk) - Number(b.pk))
        : [];
    foreign.columns.push(String(row.from));
    foreign.referencedColumns.push(
      row.to == null ? String(primary[Number(row.seq)]?.name ?? '(隐式主键)') : String(row.to),
    );
  }
  const primary = catalog
    .all(`PRAGMA main.table_xinfo(${quote(table)})`)
    .filter((part) => Number(part.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk));
  const constraints: RelationalConstraint[] = [];
  if (primary.length)
    constraints.push({
      name: 'PRIMARY KEY',
      kind: 'primary',
      columns: primary.map((part) => String(part.name)),
      definition: null,
      validated: true,
      deferrable: null,
      initiallyDeferred: null,
    });
  for (const index of indexes.filter(
    (index) => index.constraintBacked && index.unique && !index.primary,
  ))
    constraints.push({
      name: index.name,
      kind: 'unique',
      columns: index.parts
        .filter((part) => part.role === 'key' && part.column !== null)
        .map((part) => part.column!),
      definition: index.definition,
      validated: true,
      deferrable: null,
      initiallyDeferred: null,
    });
  for (const foreign of foreignKeys)
    constraints.push({
      name: foreign.name,
      kind: 'foreign',
      columns: foreign.columns,
      definition: null,
      validated: null,
      deferrable: null,
      initiallyDeferred: null,
    });
  const triggers: RelationalTrigger[] = catalog
    .all(
      "SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=? ORDER BY name",
      table,
    )
    .map((row) => ({
      name: String(row.name),
      timing: '见原始 DDL',
      events: [],
      orientation: 'ROW',
      enabled: 'ENABLED',
      definition: String(row.sql),
    }));
  const info = catalog.all(`PRAGMA main.table_list`).find((row) => row.name === table);
  const warnings = [
    'SQLite 不提供完整约束目录：CHECK、声明约束名、表达式键、部分索引条件及延期属性以原始 DDL 为准；fk_N 是 PRAGMA 编号。',
  ];
  return {
    schema,
    table,
    kind: relation.type === 'view' ? 'view' : 'table',
    indexes,
    foreignKeys,
    constraints,
    triggers,
    properties: {
      withoutRowid: info == null ? null : String(Number(info.wr) === 1),
      strict: info == null ? null : String(Number(info.strict) === 1),
      generatedColumns: String(columns.filter((column) => column.extra === 'generated').length),
    },
    definition: {
      sql: String(relation.sql).trim().replace(/;$/, '') + ';',
      origin: 'native',
      warnings,
    },
  };
}
