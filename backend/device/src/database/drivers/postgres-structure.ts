import type {
  DatabaseColumnInfo,
  RelationalIndex,
  RelationalForeignKey,
  RelationalConstraint,
  RelationalTrigger,
} from '@fouc/shared';
import { DatabaseInputError } from '../input-error';
import { quoteRelationalIdentifier as quote } from '../relational-sql';
import type { DriverStructure, MetadataQuery } from './relational-driver';

const actions: Record<string, string> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};
const constraintKinds: Record<string, RelationalConstraint['kind']> = {
  p: 'primary',
  u: 'unique',
  f: 'foreign',
  c: 'check',
  x: 'exclusion',
  n: 'not-null',
};
const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const terminate = (sql: string) => sql.trim().replace(/;$/, '') + ';';

/** DBX postgres.rs: catalog constraints, ordinal FK pairs, INCLUDE/expression index keys. */
export async function postgresStructure(
  query: MetadataQuery,
  schema: string,
  table: string,
  columns: DatabaseColumnInfo[],
): Promise<DriverStructure> {
  const target = [schema, table];
  const [relations, indexRows, constraintRows, foreignRows, triggerRows, columnDefinitions] =
    await Promise.all([
      query(
        `SELECT c.oid, c.relkind, c.relpersistence, c.reloptions, c.relispartition,
      obj_description(c.oid) AS comment, pg_get_userbyid(c.relowner) AS owner,
      am.amname AS access_method, ts.spcname AS tablespace,
      CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END AS view_definition,
      CASE WHEN c.relkind='p' THEN pg_get_partkeydef(c.oid) END AS partition_key
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_am am ON am.oid=c.relam LEFT JOIN pg_tablespace ts ON ts.oid=c.reltablespace
      WHERE n.nspname=$1 AND c.relname=$2 AND c.relkind IN ('r','p','v','m','f')
      AND has_table_privilege(c.oid,'SELECT')`,
        target,
      ),
      query(
        `SELECT ix.relname AS name, i.indisunique, i.indisprimary, i.indisvalid, am.amname,
      i.indnkeyatts, pg_get_expr(i.indpred,i.indrelid) AS predicate,
      pg_get_indexdef(i.indexrelid) AS definition, obj_description(i.indexrelid) AS comment,
      EXISTS(SELECT 1 FROM pg_constraint con WHERE con.conindid=i.indexrelid) AS constraint_backed,
      json_agg(json_build_object('position', k.pos+1, 'column',a.attname,
        'expression',CASE WHEN k.attnum=0 THEN pg_get_indexdef(i.indexrelid,k.pos+1,true) END,
        'option',COALESCE(i.indoption[k.pos],0), 'included',k.pos>=i.indnkeyatts,
        'collation',CASE WHEN co.oid<>0 THEN co.collname END) ORDER BY k.pos) AS parts
      FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_class ix ON ix.oid=i.indexrelid JOIN pg_am am ON am.oid=ix.relam
      CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS raw(attnum,ord)
      CROSS JOIN LATERAL (SELECT raw.attnum, (raw.ord-1)::int AS pos) k
      LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum
      LEFT JOIN pg_collation co ON co.oid=i.indcollation[k.pos]
      WHERE n.nspname=$1 AND t.relname=$2
      GROUP BY ix.relname,i.indexrelid,i.indrelid,i.indisunique,i.indisprimary,i.indisvalid,
        am.amname,i.indnkeyatts,i.indpred ORDER BY ix.relname`,
        target,
      ),
      query(
        `SELECT con.conname, con.contype, con.convalidated, con.condeferrable, con.condeferred,
      pg_get_constraintdef(con.oid,true) AS definition,
      ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(attnum,ord)
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum ORDER BY k.ord) AS columns
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=$2 AND con.contype IN ('p','u','f','c','x','n') ORDER BY con.conname`,
        target,
      ),
      query(
        `SELECT con.conname, con.confupdtype,con.confdeltype,con.confmatchtype,
      con.convalidated,con.condeferrable,con.condeferred, rn.nspname AS ref_schema,r.relname AS ref_table,
      pg_get_constraintdef(con.oid,true) AS definition,
      ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(attnum,ord)
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum ORDER BY k.ord) AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(attnum,ord)
        JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=k.attnum ORDER BY k.ord) AS ref_columns
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_class r ON r.oid=con.confrelid JOIN pg_namespace rn ON rn.oid=r.relnamespace
      WHERE n.nspname=$1 AND c.relname=$2 AND con.contype='f' ORDER BY con.conname`,
        target,
      ),
      query(
        `SELECT tr.tgname,tr.tgtype,tr.tgenabled,pg_get_triggerdef(tr.oid,true) AS definition,
      tr.tgparentid FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2
      AND NOT tr.tgisinternal ORDER BY tr.tgname`,
        target,
      ),
      query(
        `SELECT a.attname,a.attidentity,a.attgenerated,co.collname,cn.nspname AS collation_schema,
        a.attcollation<>ty.typcollation AS custom_collation,
        seq.seqstart::text,seq.seqincrement::text,seq.seqmin::text,seq.seqmax::text,seq.seqcache::text,seq.seqcycle
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_type ty ON ty.oid=a.atttypid LEFT JOIN pg_collation co ON co.oid=a.attcollation
        LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace
        LEFT JOIN pg_depend dep ON dep.refobjid=c.oid AND dep.refobjsubid=a.attnum
          AND dep.classid='pg_class'::regclass AND dep.deptype='i'
        LEFT JOIN pg_sequence seq ON seq.seqrelid=dep.objid
        WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
        target,
      ),
    ]);
  const relation = relations[0];
  if (!relation) throw new DatabaseInputError('对象不存在或当前账号无权读取结构');
  const indexes: RelationalIndex[] = indexRows.map((row) => ({
    name: String(row.name),
    method: String(row.amname),
    unique: Boolean(row.indisunique),
    primary: Boolean(row.indisprimary),
    valid: Boolean(row.indisvalid),
    visible: null,
    constraintBacked: Boolean(row.constraint_backed),
    predicate: row.predicate == null ? null : String(row.predicate),
    definition: String(row.definition),
    comment: row.comment == null ? null : String(row.comment),
    parts: (row.parts as Record<string, unknown>[]).map((part) => ({
      position: Number(part.position),
      column: part.column == null ? null : String(part.column),
      expression: part.expression == null ? null : String(part.expression),
      role: part.included ? 'include' : 'key',
      descending: row.amname === 'btree' && !part.included ? (Number(part.option) & 1) !== 0 : null,
      nulls:
        row.amname === 'btree' && !part.included
          ? (Number(part.option) & 2) !== 0
            ? 'first'
            : 'last'
          : null,
      prefixLength: null,
      collation: part.collation == null ? null : String(part.collation),
    })),
  }));
  const constraints: RelationalConstraint[] = constraintRows.map((row) => ({
    name: String(row.conname),
    kind: constraintKinds[String(row.contype)]!,
    columns: strings(row.columns),
    definition: String(row.definition),
    validated: Boolean(row.convalidated),
    deferrable: Boolean(row.condeferrable),
    initiallyDeferred: Boolean(row.condeferred),
  }));
  const foreignKeys: RelationalForeignKey[] = foreignRows.map((row) => ({
    name: String(row.conname),
    nameSource: 'catalog',
    columns: strings(row.columns),
    referencedSchema: String(row.ref_schema),
    referencedTable: String(row.ref_table),
    referencedColumns: strings(row.ref_columns),
    onUpdate: actions[String(row.confupdtype)]!,
    onDelete: actions[String(row.confdeltype)]!,
    match: { s: 'SIMPLE', f: 'FULL', p: 'PARTIAL' }[String(row.confmatchtype)] ?? 'UNKNOWN',
    deferrable: Boolean(row.condeferrable),
    initiallyDeferred: Boolean(row.condeferred),
    validated: Boolean(row.convalidated),
    definition: String(row.definition),
  }));
  const triggers: RelationalTrigger[] = triggerRows.map((row) => ({
    name: String(row.tgname),
    timing: Number(row.tgtype) & 64 ? 'INSTEAD OF' : Number(row.tgtype) & 2 ? 'BEFORE' : 'AFTER',
    events: [
      [4, 'INSERT'],
      [8, 'DELETE'],
      [16, 'UPDATE'],
      [32, 'TRUNCATE'],
    ]
      .filter(([bit]) => Number(row.tgtype) & Number(bit))
      .map(([, event]) => String(event)),
    orientation: Number(row.tgtype) & 1 ? 'ROW' : 'STATEMENT',
    enabled:
      { O: 'ORIGIN', D: 'DISABLED', R: 'REPLICA', A: 'ALWAYS' }[String(row.tgenabled)] ??
      String(row.tgenabled),
    definition: String(row.definition),
  }));
  const qualified = `${quote(schema)}.${quote(table)}`;
  const warnings = [
    '目录重建脚本用于结构查看；不包含权限、所有权、完整存储选项、外部依赖或备份恢复顺序。',
  ];
  let sql: string;
  if (relation.relkind === 'v' || relation.relkind === 'm') {
    sql = `CREATE ${relation.relkind === 'm' ? 'MATERIALIZED ' : 'OR REPLACE '}VIEW ${qualified} AS\n${terminate(String(relation.view_definition))}`;
  } else {
    const fields = columns.map((column) => {
      const facts = columnDefinitions.find((row) => row.attname === column.name)!;
      const generated = column.extra === 'generated';
      const identity = column.extra === 'identity';
      const collation = facts.custom_collation
        ? ` COLLATE ${quote(String(facts.collation_schema))}.${quote(String(facts.collname))}`
        : '';
      const sequence =
        facts.seqstart == null
          ? ''
          : ` (START WITH ${facts.seqstart} INCREMENT BY ${facts.seqincrement} MINVALUE ${facts.seqmin} MAXVALUE ${facts.seqmax} CACHE ${facts.seqcache} ${facts.seqcycle ? 'CYCLE' : 'NO CYCLE'})`;
      return `  ${quote(column.name)} ${column.dataType}${collation}${generated ? ` GENERATED ALWAYS AS (${column.columnDefault}) ${facts.attgenerated === 'v' ? 'VIRTUAL' : 'STORED'}` : identity ? ` GENERATED ${facts.attidentity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY${sequence}` : column.columnDefault !== null ? ` DEFAULT ${column.columnDefault}` : ''}${column.isNullable ? '' : ' NOT NULL'}`;
    });
    fields.push(...constraints.map((con) => `  CONSTRAINT ${quote(con.name)} ${con.definition}`));
    sql = `CREATE ${relation.relpersistence === 'u' ? 'UNLOGGED ' : ''}TABLE ${qualified} (\n${fields.join(',\n')}\n)${relation.partition_key ? ' PARTITION BY ' + relation.partition_key : ''};`;
    if (relation.relispartition || relation.relkind === 'f')
      warnings.push('分区归属或外部表服务器选项未重建，此脚本不能直接恢复该对象。');
  }
  sql += indexes
    .filter((index) => !index.constraintBacked)
    .map((index) => '\n\n' + terminate(index.definition!))
    .join('');
  sql += triggerRows
    .filter((row) => Number(row.tgparentid) === 0)
    .map((row) => {
      const enable =
        row.tgenabled === 'D'
          ? 'DISABLE'
          : row.tgenabled === 'R'
            ? 'ENABLE REPLICA'
            : row.tgenabled === 'A'
              ? 'ENABLE ALWAYS'
              : null;
      return (
        '\n\n' +
        terminate(String(row.definition)) +
        (enable ? `\nALTER TABLE ${qualified} ${enable} TRIGGER ${quote(String(row.tgname))};` : '')
      );
    })
    .join('');
  if (relation.comment != null)
    sql += `\n\nCOMMENT ON ${relation.relkind === 'm' ? 'MATERIALIZED VIEW' : relation.relkind === 'v' ? 'VIEW' : 'TABLE'} ${qualified} IS ${literal(String(relation.comment))};`;
  for (const column of columns)
    if (column.comment !== null)
      sql += `\nCOMMENT ON COLUMN ${qualified}.${quote(column.name)} IS ${literal(column.comment)};`;
  return {
    schema,
    table,
    kind:
      relation.relkind === 'v' ? 'view' : relation.relkind === 'm' ? 'materialized_view' : 'table',
    indexes,
    foreignKeys,
    constraints,
    triggers,
    properties: {
      owner: String(relation.owner),
      comment: relation.comment == null ? null : String(relation.comment),
      persistence: String(relation.relpersistence),
      accessMethod: relation.access_method == null ? null : String(relation.access_method),
      tablespace: relation.tablespace == null ? null : String(relation.tablespace),
      options: strings(relation.reloptions).join(', ') || null,
    },
    definition: { sql, origin: 'reconstructed', warnings },
  };
}
