import { uiText } from '../../i18n/ui-message';
import { createTranslator, type Locale, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './sqlite-rebuild.messages';
import {
  tokenizeSqlSemantic,
  type DatabaseColumnInfo,
  type RelationalIndex,
  type RelationalTrigger,
} from '@fouc/shared';
import {
  createIndexDdl,
  ddlLiteral,
  qualifiedTable,
  quoteSchemaId,
  rewriteSchemaReferences,
  rewriteTriggerTarget,
  terminateDdl,
} from './ddl';
import { generatedColumn, parseTableDdl } from './ddl-source';
import type { SchemaDiffChange, SchemaDiffIssue, SchemaDiffStep, SchemaDiffTable } from './model';
export interface SqliteRebuildResult {
  steps: SchemaDiffStep[];
  issues: SchemaDiffIssue[];
}
function applyNamed<T extends RelationalIndex | RelationalTrigger>(
  initial: T[],
  changes: SchemaDiffChange[],
  kind: 'index' | 'trigger',
): T[] {
  const entries = new Map(initial.map((entry) => [entry.name, entry]));
  for (const change of changes.filter((entry) => entry.kind === kind)) {
    if (change.operation === 'remove') entries.delete(change.name);
    // Comparison emits the same metadata type for the selected index/trigger kind.
    else entries.set(change.name, change.source as unknown as T);
  }
  return [...entries.values()];
}
/** SQLite's documented create-copy-drop-rename procedure, with explicit data and commit review. */
export function buildSqliteRebuild(
  table: SchemaDiffTable,
  chosen: SchemaDiffChange[],
  tables: SchemaDiffTable[],
  locale?: Locale,
): SqliteRebuildResult {
  const tConnector = createTranslator(connectorMessages, locale);
  const issues: SchemaDiffIssue[] = [],
    steps: SchemaDiffStep[] = [];
  const source = table.source!,
    target = table.target!;
  const src = parseTableDdl(source.definition.sql, 'sqlite'),
    dst = parseTableDdl(target.definition.sql, 'sqlite');
  const structural = chosen.filter((change) =>
    ['column', 'foreign', 'constraint', 'property'].includes(change.kind),
  );
  const ids = structural.map((change) => change.id);
  const issue = (severity: SchemaDiffIssue['severity'], message: string) =>
    issues.push({ severity, message, tableId: table.id });
  if (
    !src ||
    !dst ||
    source.definition.origin !== 'native' ||
    target.definition.origin !== 'native'
  ) {
    issue(
      'unsupported',
      tConnector('rebuildingRequiresActualCreateTableDefinitionsFromBothSidesCheck', {
        p0: String(table.name),
      }),
    );
    return { steps, issues };
  }
  const complete = table.changes
    .filter((change) => ['column', 'foreign', 'constraint', 'property'].includes(change.kind))
    .every((change) => ids.includes(change.id));
  const desired = new Map<string, DatabaseColumnInfo>(
    target.columns.map((column) => [column.name, column]),
  );
  const definitions = new Map(dst.columns);
  for (const change of structural.filter((entry) => entry.kind === 'column')) {
    if (change.operation === 'remove') {
      desired.delete(change.name);
      definitions.delete(change.name);
    } else {
      const column = change.source as DatabaseColumnInfo,
        definition = src.columns.get(column.name);
      if (!definition) {
        issue(
          'unsupported',
          tConnector('columnLacksItsOriginalDefinitionAndCannotBeRebuilt', {
            p0: String(column.name),
          }),
        );
        return { steps, issues };
      }
      desired.set(column.name, column);
      definitions.set(column.name, definition);
    }
  }
  if (!desired.size) {
    issue('unsupported', tConnector('sqliteTablesRequireAtLeastOneColumnARebuildDropping'));
    return { steps, issues };
  }
  const ordered = complete
    ? source.columns.filter((column) => desired.has(column.name)).map((column) => column.name)
    : [...desired.keys()];
  const constraints = complete ? src.clauses : dst.clauses;
  const suffix = complete ? src.suffix : dst.suffix;
  if (
    /\bSTRICT\b/i.test(suffix) &&
    [...desired.values()].some(
      (column) => !/^(?:INT|INTEGER|REAL|TEXT|BLOB|ANY)$/i.test(column.dataType.trim()),
    )
  ) {
    issue('unsupported', tConnector('selectedTypesViolateTheTargetStrictTableRulesSelectThe'));
    return { steps, issues };
  }
  const writable = ordered.filter(
    (name) => !generatedColumn(desired.get(name)!, definitions.get(name) ?? null),
  );
  for (const name of writable) {
    const column = desired.get(name)!;
    if (
      !target.columns.some((entry) => entry.name === name) &&
      !column.isNullable &&
      (column.columnDefault === null || /^\(?\s*NULL\s*\)?$/i.test(column.columnDefault))
    ) {
      issue(
        'unsupported',
        tConnector('newNotNullColumnLacksAValidDefaultAndA', { p0: String(name) }),
      );
      return { steps, issues };
    }
  }
  const tempName = `__fouc_diff_${target.table}`;
  const temp = qualifiedTable({ schema: target.schema, table: tempName }, 'sqlite'),
    physical = qualifiedTable(target, 'sqlite');
  const raw = complete ? src : dst;
  const create = rewriteSchemaReferences(
    terminateDdl(
      raw.sql.slice(0, raw.nameStart) +
        temp +
        raw.sql.slice(raw.nameEnd, raw.bodyStart) +
        '\n  ' +
        [...ordered.map((name) => definitions.get(name)!), ...constraints].join(',\n  ') +
        '\n)' +
        (suffix ? ' ' + suffix : ''),
    ),
    table,
    tables,
  );
  const step = (key: string, phase: number, label: string, sql: string) => {
    const id = `${table.id}:rebuild:${key}`;
    steps.push({
      id,
      tableId: table.id,
      changeIds: ids,
      phase,
      label,
      sql,
      risk: 'review',
      dependsOn: steps.length ? [steps.at(-1)!.id] : [],
    });
  };
  step('create', 30, tConnector('createATemporaryTableWithTheTargetDefinition'), create);
  const oldAuto = tokenizeSqlSemantic(dst.sql.slice(0, dst.end), 'sqlite').some(
    (token) => token.kind === 'word' && token.text.toUpperCase() === 'AUTOINCREMENT',
  );
  const newAuto = tokenizeSqlSemantic(create, 'sqlite').some(
    (token) => token.kind === 'word' && token.text.toUpperCase() === 'AUTOINCREMENT',
  );
  const sequenceTemp = quoteSchemaId(`${tempName}_sequence`, 'sqlite');
  if (oldAuto && newAuto)
    step(
      'sequence-save',
      32,
      tConnector('saveTheAutoincrementHighWaterMark'),
      `CREATE TEMP TABLE ${sequenceTemp} AS SELECT seq FROM ${quoteSchemaId(target.schema, 'sqlite')}.sqlite_sequence WHERE name=${ddlLiteral(target.table, 'sqlite')};`,
    );
  const common = writable.filter((name) => target.columns.some((entry) => entry.name === name));
  const names = common.map((name) => quoteSchemaId(name, 'sqlite')),
    expressions = [...names];
  const rowidAliases = new Set(['rowid', '_rowid_', 'oid']);
  const hasRowid = target.properties.withoutRowid !== 'true' && !/WITHOUT\s+ROWID/i.test(suffix);
  const aliasesHidden = [...target.columns, ...desired.values()].some((column) =>
    rowidAliases.has(column.name.toLowerCase()),
  );
  if (hasRowid && !aliasesHidden) {
    names.unshift('"_rowid_"');
    expressions.unshift('"_rowid_"');
  }
  if (!names.length) {
    const fallback = writable.find(
      (name) => desired.get(name)!.isNullable || desired.get(name)!.columnDefault !== null,
    );
    if (!fallback) {
      issue('unsupported', tConnector('noWritableCopyColumnsExistHowToPreserveExistingRows'));
      return { steps: [], issues };
    }
    names.push(quoteSchemaId(fallback, 'sqlite'));
    expressions.push(desired.get(fallback)!.columnDefault ?? 'NULL');
  }
  step(
    'copy',
    35,
    tConnector('copyOriginalDataByColumnNameExcludingGeneratedColumns'),
    `INSERT INTO ${temp} (${names.join(', ')})\nSELECT ${expressions.join(', ')} FROM ${physical};`,
  );
  if (structural.some((change) => change.kind === 'column' && change.operation === 'remove'))
    issue('warning', tConnector('columnsSelectedForDeletionAreNotCopiedTheirDataIs'));
  if (
    structural.some(
      (change) =>
        change.kind === 'column' &&
        change.fields.some((entry) => entry.key === 'nullable' && entry.after === 'false'),
    )
  )
    issue('warning', tConnector('existingNullValuesMayCauseCopyingToFailRollbackOn'));
  if (!hasRowid || aliasesHidden)
    issue('info', tConnector('declaredColumnsAreCopiedImplicitRowidHasNoUniversalMapping'));
  step(
    'drop',
    40,
    tConnector('dropTheOldTableDataCopiedInsideTheTransaction'),
    `DROP TABLE ${physical};`,
  );
  step(
    'rename',
    45,
    tConnector('renameTheTemporaryTableToTheOriginalTargetName'),
    `ALTER TABLE ${temp} RENAME TO ${quoteSchemaId(target.table, 'sqlite')};`,
  );
  if (oldAuto && newAuto) {
    step(
      'sequence-restore',
      47,
      tConnector('restoreTheAutoincrementHighWaterMark'),
      `UPDATE ${quoteSchemaId(target.schema, 'sqlite')}.sqlite_sequence SET seq=MAX(seq, COALESCE((SELECT seq FROM ${sequenceTemp}), seq)) WHERE name=${ddlLiteral(target.table, 'sqlite')};\nDROP TABLE ${sequenceTemp};`,
    );
  }
  const indexes = applyNamed<RelationalIndex>(
    target.indexes.filter((index) => !index.constraintBacked && !index.primary),
    chosen,
    'index',
  );
  for (const index of indexes) {
    try {
      step(
        `index:${index.name}`,
        50,
        tConnector('recreateIndex', { p0: String(index.name) }),
        createIndexDdl(index, target),
      );
    } catch (error) {
      issue(
        'unsupported',
        error instanceof Error ? uiText(error, locale ?? getLocale()) : String(error),
      );
    }
  }
  const triggers = applyNamed<RelationalTrigger>(target.triggers, chosen, 'trigger');
  for (const trigger of triggers) {
    try {
      step(
        `trigger:${trigger.name}`,
        55,
        tConnector('restoreTrigger', { p0: String(trigger.name) }),
        rewriteTriggerTarget(trigger.definition, target),
      );
    } catch (error) {
      issue(
        'unsupported',
        error instanceof Error ? uiText(error, locale ?? getLocale()) : String(error),
      );
    }
  }
  issue('warning', tConnector('rebuildingAffectsExternalViewsForeignKeysTriggersAndVirtualTables'));
  issue(
    'info',
    tConnector('temporaryTableMustNotExistTheScriptDoesNotUse', { p0: String(tempName) }),
  );
  return { steps, issues };
}
