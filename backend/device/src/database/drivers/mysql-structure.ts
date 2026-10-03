import type {
  RelationalConstraint,
  RelationalForeignKey,
  RelationalIndex,
  RelationalTrigger,
} from '@fouc/shared';
import { DatabaseInputError } from '../input-error';
import type { DriverStructure, MetadataQuery } from './relational-driver';

const nullable = (value: unknown) => (value == null ? null : String(value));
const kind: Record<string, RelationalConstraint['kind']> = {
  'PRIMARY KEY': 'primary',
  UNIQUE: 'unique',
  'FOREIGN KEY': 'foreign',
  CHECK: 'check',
};

/** DBX mysql.rs: separate information_schema lookups, ordered composite keys and SHOW CREATE. */
export async function mysqlStructure(
  query: MetadataQuery,
  quote: (value: string) => string,
  schema: string,
  table: string,
): Promise<DriverStructure> {
  const values = [schema, table];
  const [relations, indexRows, keyRows, ruleRows, checkRows, triggerRows, ddlRows] =
    await Promise.all([
      query(
        `SELECT TABLE_TYPE,ENGINE,TABLE_COLLATION,TABLE_COMMENT,ROW_FORMAT,CREATE_OPTIONS
      FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
        values,
      ),
      query(
        `SELECT INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION,SUB_PART,INDEX_TYPE,
      INDEX_COMMENT,EXPRESSION,IS_VISIBLE FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY INDEX_NAME,SEQ_IN_INDEX`,
        values,
      ),
      query(
        `SELECT CONSTRAINT_NAME,COLUMN_NAME,ORDINAL_POSITION,REFERENCED_TABLE_SCHEMA,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=?
      ORDER BY CONSTRAINT_NAME,ORDINAL_POSITION`,
        values,
      ),
      query(
        `SELECT CONSTRAINT_NAME,UPDATE_RULE,DELETE_RULE,MATCH_OPTION
      FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=?`,
        values,
      ),
      query(
        `SELECT tc.CONSTRAINT_NAME,tc.CONSTRAINT_TYPE,tc.ENFORCED,cc.CHECK_CLAUSE
      FROM information_schema.TABLE_CONSTRAINTS tc LEFT JOIN information_schema.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA=? AND tc.TABLE_NAME=? ORDER BY tc.CONSTRAINT_NAME`,
        values,
      ),
      query(
        `SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,ACTION_ORIENTATION,ACTION_STATEMENT
      FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? AND EVENT_OBJECT_TABLE=? ORDER BY TRIGGER_NAME`,
        values,
      ),
      query(`SHOW CREATE TABLE ${quote(schema)}.${quote(table)}`),
    ]);
  const relation = relations[0];
  if (!relation || !ddlRows.length)
    throw new DatabaseInputError('对象不存在或当前账号无权读取结构');
  const indexes: RelationalIndex[] = [];
  for (const row of indexRows) {
    let index = indexes.find((item) => item.name === row.INDEX_NAME);
    if (!index) {
      index = {
        name: String(row.INDEX_NAME),
        method: String(row.INDEX_TYPE),
        unique: Number(row.NON_UNIQUE) === 0,
        primary: row.INDEX_NAME === 'PRIMARY',
        valid: true,
        visible: row.IS_VISIBLE === 'YES',
        constraintBacked: Number(row.NON_UNIQUE) === 0,
        parts: [],
        predicate: null,
        definition: null,
        comment: nullable(row.INDEX_COMMENT),
      };
      indexes.push(index);
    }
    index.parts.push({
      position: Number(row.SEQ_IN_INDEX),
      column: nullable(row.COLUMN_NAME),
      expression: nullable(row.EXPRESSION),
      role: 'key',
      descending: row.COLLATION == null ? null : row.COLLATION === 'D',
      nulls: null,
      prefixLength: row.SUB_PART == null ? null : Number(row.SUB_PART),
      collation: null,
    });
  }
  const foreignKeys: RelationalForeignKey[] = [];
  for (const row of keyRows.filter((row) => row.REFERENCED_TABLE_NAME != null)) {
    let foreign = foreignKeys.find((item) => item.name === row.CONSTRAINT_NAME);
    if (!foreign) {
      const rule = ruleRows.find((item) => item.CONSTRAINT_NAME === row.CONSTRAINT_NAME);
      foreign = {
        name: String(row.CONSTRAINT_NAME),
        nameSource: 'catalog',
        columns: [],
        referencedSchema: String(row.REFERENCED_TABLE_SCHEMA),
        referencedTable: String(row.REFERENCED_TABLE_NAME),
        referencedColumns: [],
        onUpdate: String(rule?.UPDATE_RULE ?? 'UNKNOWN'),
        onDelete: String(rule?.DELETE_RULE ?? 'UNKNOWN'),
        match: String(rule?.MATCH_OPTION ?? 'UNKNOWN'),
        deferrable: false,
        initiallyDeferred: false,
        validated: true,
        definition: null,
      };
      foreignKeys.push(foreign);
    }
    foreign.columns.push(String(row.COLUMN_NAME));
    foreign.referencedColumns.push(String(row.REFERENCED_COLUMN_NAME));
  }
  for (const foreign of foreignKeys) {
    foreign.definition = `FOREIGN KEY (${foreign.columns.map(quote).join(', ')}) REFERENCES ${quote(foreign.referencedSchema)}.${quote(foreign.referencedTable)} (${foreign.referencedColumns.map(quote).join(', ')}) ON DELETE ${foreign.onDelete} ON UPDATE ${foreign.onUpdate}`;
  }
  const constraints: RelationalConstraint[] = checkRows.map((row) => {
    const columns = keyRows
      .filter((item) => item.CONSTRAINT_NAME === row.CONSTRAINT_NAME)
      .map((item) => String(item.COLUMN_NAME));
    const type = kind[String(row.CONSTRAINT_TYPE)]!;
    return {
      name: String(row.CONSTRAINT_NAME),
      kind: type,
      columns,
      validated: row.ENFORCED === 'YES',
      deferrable: false,
      initiallyDeferred: false,
      definition:
        type === 'check'
          ? `CHECK (${row.CHECK_CLAUSE})`
          : type === 'foreign'
            ? (foreignKeys.find((item) => item.name === row.CONSTRAINT_NAME)?.definition ?? null)
            : `${row.CONSTRAINT_TYPE} (${columns.map(quote).join(', ')})`,
    };
  });
  const triggers: RelationalTrigger[] = await Promise.all(
    triggerRows.map(async (row) => {
      const source = await query(
        `SHOW CREATE TRIGGER ${quote(schema)}.${quote(String(row.TRIGGER_NAME))}`,
      );
      const definition = source[0]?.['SQL Original Statement'];
      if (typeof definition !== 'string')
        throw new DatabaseInputError(`无法读取触发器 ${row.TRIGGER_NAME} 的原始定义`);
      return {
        name: String(row.TRIGGER_NAME),
        timing: String(row.ACTION_TIMING),
        events: [String(row.EVENT_MANIPULATION)],
        orientation: String(row.ACTION_ORIENTATION),
        enabled: 'ENABLED',
        definition,
      };
    }),
  );
  const ddl = Object.entries(ddlRows[0]!).find(([name]) =>
    /^Create (Table|View)$/i.test(name),
  )?.[1];
  if (typeof ddl !== 'string') throw new DatabaseInputError('数据库未返回对象 DDL');
  return {
    schema,
    table,
    kind: relation.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
    indexes,
    foreignKeys,
    constraints,
    triggers,
    properties: {
      engine: nullable(relation.ENGINE),
      collation: nullable(relation.TABLE_COLLATION),
      comment: nullable(relation.TABLE_COMMENT),
      rowFormat: nullable(relation.ROW_FORMAT),
      options: nullable(relation.CREATE_OPTIONS),
    },
    definition: {
      sql: ddl.trim().replace(/;$/, '') + ';',
      origin: 'native',
      warnings: ['SHOW CREATE 返回当前对象定义；触发器在单独页签提供，不包含账户权限或完整备份。'],
    },
  };
}
