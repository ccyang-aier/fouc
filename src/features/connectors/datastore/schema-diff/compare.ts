import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './compare.messages';
import {
  tokenizeSqlSemantic,
  type DatabaseColumnInfo,
  type RelationalConstraint,
  type RelationalForeignKey,
  type RelationalIndex,
  type RelationalProvider,
  type RelationalTableStructure,
  type RelationalTrigger,
} from '@fouc/shared';
import {
  generatedColumn,
  generationSignature,
  normalizeSchemaSql,
  parseTableDdl,
} from './ddl-source';
import { rewriteSchemaReferences } from './ddl';
import {
  schemaChangeId,
  schemaObjectKey,
  type SchemaDiffChange,
  type SchemaDiffComparison,
  type SchemaDiffField,
  type SchemaDiffInput,
  type SchemaDiffKind,
  type SchemaDiffOptions,
  type SchemaDiffTable,
  type SchemaDiffValue,
} from './model';
const connectorUiMessages = createUiMessages(connectorMessages);
function inputTables(input: SchemaDiffInput): readonly RelationalTableStructure[] {
  return input === null ? [] : Array.isArray(input) ? input : [input as RelationalTableStructure];
}
function print(value: unknown): string {
  return value === null || value === undefined
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
}
function field(
  fields: SchemaDiffField[],
  key: string,
  label: string,
  before: unknown,
  after: unknown,
  equal = before === after,
) {
  if (!equal) fields.push({ key, label, before: print(before), after: print(after) });
}
function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function canonicalType(type: string, provider: RelationalProvider) {
  let value = type.trim().toLowerCase().replace(/\s+/g, ' ');
  if (provider === 'mysql')
    value = value
      .replace(/\b(tinyint|smallint|mediumint|int|integer|bigint)\(\d+\)/g, '$1')
      .replace(/^integer\b/, 'int');
  if (provider === 'postgres')
    value = value.replace(
      /^(int2|int4|int8|float4|float8|bool|character varying)\b/,
      (name) =>
        ({
          int2: 'smallint',
          int4: 'integer',
          int8: 'bigint',
          float4: 'real',
          float8: 'double precision',
          bool: 'boolean',
          'character varying': 'varchar',
        })[name]!,
    );
  return value;
}
function addChange(
  table: SchemaDiffTable,
  kind: SchemaDiffKind,
  name: string,
  source: SchemaDiffValue,
  target: SchemaDiffValue,
  fields: SchemaDiffField[] = [],
) {
  if (source !== null && target !== null && !fields.length) return;
  const operation = source === null ? 'remove' : target === null ? 'add' : 'modify';
  const change: SchemaDiffChange = {
    id: schemaChangeId(table.id, kind, name),
    tableId: table.id,
    kind,
    name,
    source,
    target,
    fields,
    operation,
    risk:
      operation === 'remove' && (kind === 'column' || kind === 'table')
        ? 'destructive'
        : kind === 'column' && fields.some((entry) => entry.key === 'type')
          ? 'review'
          : kind === 'foreign' || kind === 'constraint' || kind === 'trigger'
            ? 'review'
            : 'low',
  };
  table.changes.push(change);
}
function columnFields(
  source: DatabaseColumnInfo,
  target: DatabaseColumnInfo,
  sourceIndex: number,
  targetIndex: number,
  comparison: SchemaDiffComparison,
  sourceNative: string | null,
  targetNative: string | null,
  locale?: Locale,
): SchemaDiffField[] {
  const tConnector = createTranslator(connectorMessages, locale);
  const fields: SchemaDiffField[] = [],
    provider = comparison.provider;
  const srcGenerated = generatedColumn(source, sourceNative),
    dstGenerated = generatedColumn(target, targetNative);
  field(
    fields,
    'type',
    tConnector('type'),
    target.dataType,
    source.dataType,
    canonicalType(source.dataType, provider) === canonicalType(target.dataType, provider),
  );
  field(fields, 'nullable', tConnector('allowsNull'), target.isNullable, source.isNullable);
  field(
    fields,
    'default',
    tConnector('defaultValue'),
    target.columnDefault,
    source.columnDefault,
    normalizeSchemaSql(source.columnDefault, provider) ===
      normalizeSchemaSql(target.columnDefault, provider),
  );
  field(
    fields,
    'extra',
    tConnector('autoIncrementIdentity'),
    target.extra,
    source.extra,
    (target.extra ?? '').toLowerCase() === (source.extra ?? '').toLowerCase(),
  );
  const srcIdentity = /identity/i.test(source.extra ?? ''),
    dstIdentity = /identity/i.test(target.extra ?? '');
  if (srcIdentity || dstIdentity)
    field(
      fields,
      'identity',
      tConnector('identityConfiguration'),
      dstIdentity ? targetNative : null,
      srcIdentity ? sourceNative : null,
      srcIdentity === dstIdentity &&
        normalizeSchemaSql(sourceNative?.match(/GENERATED\s+[\s\S]+/i)?.[0], provider) ===
          normalizeSchemaSql(targetNative?.match(/GENERATED\s+[\s\S]+/i)?.[0], provider),
    );
  field(
    fields,
    'generated',
    tConnector('generatedExpression'),
    dstGenerated ? (targetNative ?? target.columnDefault) : null,
    srcGenerated ? (sourceNative ?? source.columnDefault) : null,
    srcGenerated === dstGenerated &&
      generationSignature(source, sourceNative, provider) ===
        generationSignature(target, targetNative, provider),
  );
  for (const [key, label] of [
    ['characterSet', tConnector('characterSet')],
    ['collation', tConnector('collation')],
    ['enumValues', tConnector('enumValues')],
  ] as const)
    field(
      fields,
      key,
      label,
      target[key],
      source[key],
      same(source[key] ?? null, target[key] ?? null),
    );
  if (!comparison.options.ignoreComments)
    field(fields, 'comment', tConnector('comment'), target.comment ?? '', source.comment ?? '');
  if (comparison.options.compareColumnOrder)
    field(fields, 'order', tConnector('columnOrder'), targetIndex + 1, sourceIndex + 1);
  return fields;
}
type NamedDiffValue =
  | DatabaseColumnInfo
  | RelationalIndex
  | RelationalForeignKey
  | RelationalConstraint
  | RelationalTrigger;
function compareNamed<T extends NamedDiffValue>(
  table: SchemaDiffTable,
  kind: SchemaDiffKind,
  source: T[],
  target: T[],
  compare: (source: T, target: T) => SchemaDiffField[],
) {
  const targets = new Map(target.map((entry) => [entry.name, entry])),
    sources = new Set(source.map((entry) => entry.name));
  for (const entry of source) {
    const previous = targets.get(entry.name);
    addChange(
      table,
      kind,
      entry.name,
      entry,
      previous ?? null,
      previous ? compare(entry, previous) : [],
    );
  }
  for (const entry of target)
    if (!sources.has(entry.name)) addChange(table, kind, entry.name, null, entry);
}
function indexFields(
  source: RelationalIndex,
  target: RelationalIndex,
  provider: RelationalProvider,
  locale?: Locale,
) {
  const tConnector = createTranslator(connectorMessages, locale);
  const fields: SchemaDiffField[] = [];
  for (const [key, label] of [
    ['unique', tConnector('unique')],
    ['method', tConnector('indexMethod')],
    ['visible', tConnector('visible')],
    ['valid', tConnector('valid')],
    ['comment', tConnector('comment')],
  ] as const)
    field(fields, key, label, target[key], source[key]);
  field(
    fields,
    'parts',
    tConnector('keyIncludeOrderPrefixCollation'),
    target.parts,
    source.parts,
    same(source.parts, target.parts),
  );
  field(
    fields,
    'predicate',
    tConnector('indexPredicate'),
    target.predicate,
    source.predicate,
    normalizeSchemaSql(source.predicate, provider) ===
      normalizeSchemaSql(target.predicate, provider),
  );
  const nativeSignature = (sql: string | null) => {
    if (!sql) return '';
    const tokens = tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment');
    const on = tokens.findIndex(
      (token) => token.kind === 'word' && token.text.toUpperCase() === 'ON',
    );
    const table = tokens[on + 1]?.text.toUpperCase() === 'ONLY' ? on + 2 : on + 1;
    if (on < 0 || !tokens[table]) return normalizeSchemaSql(sql, provider);
    const end =
      tokens[table + 1]?.text === '.' ? tokens[table + 2].span.end : tokens[table].span.end;
    return normalizeSchemaSql(sql.slice(end).replace(/;+\s*$/, ''), provider);
  };
  if (source.definition && target.definition)
    field(
      fields,
      'definition',
      tConnector('nativeIndexExpressionOpclass'),
      target.definition,
      source.definition,
      nativeSignature(source.definition) === nativeSignature(target.definition),
    );
  return fields;
}
function mappedReference(
  foreign: RelationalForeignKey,
  table: SchemaDiffTable,
  tables: SchemaDiffTable[],
) {
  const mapped = tables.find(
    (candidate) =>
      candidate.source?.schema === foreign.referencedSchema &&
      candidate.source?.table === foreign.referencedTable,
  );
  const referenced = mapped?.target ?? mapped?.source;
  return {
    ...foreign,
    referencedSchema: referenced?.schema ?? foreign.referencedSchema,
    referencedTable: referenced?.table ?? foreign.referencedTable,
  };
}
function foreignFields(
  source: RelationalForeignKey,
  target: RelationalForeignKey,
  table: SchemaDiffTable,
  tables: SchemaDiffTable[],
  locale?: Locale,
) {
  const tConnector = createTranslator(connectorMessages, locale);
  const desired = mappedReference(source, table, tables),
    fields: SchemaDiffField[] = [];
  for (const [key, label] of [
    ['columns', tConnector('localColumns')],
    ['referencedSchema', tConnector('referencedSchema')],
    ['referencedTable', tConnector('referencedTable')],
    ['referencedColumns', tConnector('referencedColumns')],
    ['match', 'MATCH'],
    ['deferrable', tConnector('deferrable')],
    ['initiallyDeferred', tConnector('initiallyDeferred')],
    ['validated', tConnector('validated')],
  ] as const)
    field(fields, key, label, target[key], desired[key], same(target[key], desired[key]));
  for (const [key, label] of [
    ['onDelete', tConnector('deleteAction')],
    ['onUpdate', tConnector('updateAction')],
  ] as const)
    field(
      fields,
      key,
      label,
      target[key],
      desired[key],
      target[key].trim().toUpperCase() === desired[key].trim().toUpperCase(),
    );
  return fields;
}
function constraints(table: RelationalTableStructure, checks: boolean): RelationalConstraint[] {
  const result = table.constraints
    .filter(
      (entry) =>
        entry.kind !== 'foreign' && entry.kind !== 'not-null' && (checks || entry.kind !== 'check'),
    )
    .map((entry) => ({
      ...entry,
      name:
        entry.kind === 'primary'
          ? 'PRIMARY KEY'
          : table.provider === 'sqlite' && entry.kind === 'unique'
            ? `UNIQUE (${entry.columns.join(', ')})`
            : entry.name,
    }));
  if (!result.some((entry) => entry.kind === 'primary')) {
    const primary = table.indexes.find((entry) => entry.primary);
    const columns =
      primary?.parts
        .filter((entry) => entry.role === 'key' && entry.column)
        .map((entry) => entry.column!) ??
      table.columns.filter((entry) => entry.isPrimaryKey).map((entry) => entry.name);
    if (columns.length)
      result.push({
        name: 'PRIMARY KEY',
        kind: 'primary',
        columns,
        definition: null,
        validated: true,
        deferrable: null,
        initiallyDeferred: null,
      });
  }
  return result;
}
/** Native metadata comparison adapted from DBX diff_columns/indexes/foreign_keys. */
export function buildSchemaDiff(
  provider: RelationalProvider,
  sourceInput: SchemaDiffInput,
  targetInput: SchemaDiffInput,
  options: SchemaDiffOptions = {},
  locale?: Locale,
): SchemaDiffComparison {
  const tConnector = createTranslator(connectorMessages, locale);
  if (!['mysql', 'postgres', 'sqlite'].includes(provider))
    throw connectorUiMessages.error('structureComparisonIsUnavailableForTheCurrentDatabase');
  const sources = inputTables(sourceInput),
    targets = inputTables(targetInput);
  if ([...sources, ...targets].some((entry) => entry.provider !== provider))
    throw connectorUiMessages.error('structureComparisonRequiresMatchingNativeDatabaseTypes');
  const comparison: SchemaDiffComparison = {
    provider,
    tables: [],
    changes: [],
    options: {
      ignoreComments: false,
      compareColumnOrder: false,
      indexes: true,
      foreignKeys: true,
      checks: true,
      triggers: true,
      ...options,
    },
    issues: [],
  };
  const used = new Set<RelationalTableStructure>();
  for (const source of sources) {
    const mapping = options.tableMappings?.find(
      (entry) =>
        entry.sourceTable === source.table &&
        (!entry.sourceSchema || entry.sourceSchema === source.schema),
    );
    const exact = targets.find(
      (entry) =>
        entry.table === (mapping?.targetTable ?? source.table) &&
        entry.schema === (mapping?.targetSchema ?? source.schema),
    );
    const sameName = targets.filter(
      (entry) => entry.table === (mapping?.targetTable ?? source.table),
    );
    const target =
      sources.length === 1 && targets.length === 1 && !mapping
        ? targets[0]
        : (exact ?? (sameName.length === 1 ? sameName[0] : undefined));
    if (target && used.has(target))
      throw connectorUiMessages.error('multipleSourceObjectsMapToTheSameTargetTableAdjust');
    if (target) used.add(target);
    const physical = target ?? source;
    comparison.tables.push({
      id: schemaObjectKey(physical.schema, physical.table),
      name: `${physical.schema}.${physical.table}`,
      source,
      target: target ?? null,
      changes: [],
    });
  }
  for (const target of targets)
    if (!used.has(target))
      comparison.tables.push({
        id: schemaObjectKey(target.schema, target.table),
        name: `${target.schema}.${target.table}`,
        source: null,
        target,
        changes: [],
      });
  for (const table of comparison.tables) {
    const { source, target } = table;
    for (const object of [source, target])
      if (object)
        comparison.issues.push(
          ...object.definition.warnings.map((message) => ({
            severity: 'info' as const,
            message,
            tableId: table.id,
          })),
        );
    if (!source || !target) {
      addChange(table, 'table', table.name, source, target);
      continue;
    }
    if (source.kind !== 'table' || target.kind !== 'table') {
      comparison.issues.push({
        severity: 'unsupported',
        message: tConnector('isNotAnOrdinaryTableThisBatchReviewsTableStructure', {
          p0: String(table.name),
        }),
        tableId: table.id,
      });
      continue;
    }
    const sourceDdl = parseTableDdl(source.definition.sql, provider),
      targetDdl = parseTableDdl(target.definition.sql, provider);
    compareNamed(table, 'column', source.columns, target.columns, (a, b) =>
      columnFields(
        a,
        b,
        source.columns.indexOf(a),
        target.columns.indexOf(b),
        comparison,
        sourceDdl?.columns.get(a.name) ?? null,
        targetDdl?.columns.get(b.name) ?? null,
        locale,
      ),
    );
    if (comparison.options.indexes)
      compareNamed(
        table,
        'index',
        source.indexes.filter((entry) => !entry.primary && !entry.constraintBacked),
        target.indexes.filter((entry) => !entry.primary && !entry.constraintBacked),
        (a, b) => indexFields(a, b, provider, locale),
      );
    compareNamed(
      table,
      'constraint',
      constraints(source, comparison.options.checks),
      constraints(target, comparison.options.checks),
      (a, b) => {
        const fields: SchemaDiffField[] = [];
        for (const [key, label] of [
          ['kind', tConnector('constraintType')],
          ['columns', tConnector('field')],
          ['validated', tConnector('validated')],
          ['deferrable', tConnector('deferrable')],
          ['initiallyDeferred', tConnector('initiallyDeferred')],
        ] as const)
          field(fields, key, label, b[key], a[key], same(a[key], b[key]));
        field(
          fields,
          'definition',
          tConnector('definition'),
          b.definition,
          a.definition,
          a.kind === 'primary' && b.kind === 'primary'
            ? true
            : normalizeSchemaSql(a.definition, provider) ===
                normalizeSchemaSql(b.definition, provider),
        );
        return fields;
      },
    );
    if (comparison.options.foreignKeys)
      compareNamed(table, 'foreign', source.foreignKeys, target.foreignKeys, (a, b) =>
        foreignFields(a, b, table, comparison.tables, locale),
      );
    if (comparison.options.triggers)
      compareNamed(table, 'trigger', source.triggers, target.triggers, (a, b) => {
        const fields: SchemaDiffField[] = [];
        field(
          fields,
          'definition',
          tConnector('definition'),
          b.definition,
          a.definition,
          normalizeSchemaSql(a.definition, provider) === normalizeSchemaSql(b.definition, provider),
        );
        field(fields, 'enabled', tConnector('enabledStatus'), b.enabled, a.enabled);
        return fields;
      });
    const keys = new Set([...Object.keys(source.properties), ...Object.keys(target.properties)]);
    for (const key of keys) {
      if (key === 'generatedColumns' || (comparison.options.ignoreComments && key === 'comment'))
        continue;
      if ((source.properties[key] ?? null) !== (target.properties[key] ?? null))
        addChange(
          table,
          'property',
          key,
          source.properties[key] ?? null,
          target.properties[key] ?? null,
          [
            {
              key,
              label: key,
              before: print(target.properties[key]),
              after: print(source.properties[key]),
            },
          ],
        );
    }
    if (provider === 'sqlite') {
      const src = parseTableDdl(
          rewriteSchemaReferences(source.definition.sql, table, comparison.tables),
          provider,
        ),
        dst = parseTableDdl(target.definition.sql, provider);
      if (!src || !dst)
        comparison.issues.push({
          severity: 'unsupported',
          message: tConnector('lacksAParseableOriginalCreateTableSoCheckAndDeclared', {
            p0: String(table.name),
          }),
          tableId: table.id,
        });
      else {
        const inline = (columns: Map<string, string>) =>
          [...columns.values()].flatMap((clause) => {
            const marker = tokenizeSqlSemantic(clause, provider).find(
              (token) => token.kind === 'word' && /^(?:CHECK|REFERENCES)$/i.test(token.text),
            );
            return marker ? [clause.slice(marker.span.start)] : [];
          });
        const sourceClauses = [...src.clauses, ...inline(src.columns)]
          .map((clause) => normalizeSchemaSql(clause, provider))
          .sort();
        const targetClauses = [...dst.clauses, ...inline(dst.columns)]
          .map((clause) => normalizeSchemaSql(clause, provider))
          .sort();
        if (!same(sourceClauses, targetClauses))
          addChange(
            table,
            'constraint',
            'native-ddl-constraints',
            source.definition.sql,
            target.definition.sql,
            [
              {
                key: 'native',
                label: tConnector('checkInlineConstraints'),
                before: dst.clauses.join('\n'),
                after: src.clauses.join('\n'),
              },
            ],
          );
      }
    }
  }
  comparison.changes = comparison.tables.flatMap((table) => table.changes);
  return comparison;
}
export { mappedReference };
