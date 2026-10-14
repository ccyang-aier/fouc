import { createUiMessages, uiText } from '../../i18n/ui-message';
import { createTranslator, type Locale, getLocale } from '@/lib/i18n';
import { messages as connectorMessages } from './script.messages';
import {
  tokenizeSqlSemantic,
  unquoteSqlSemanticIdentifier,
  type DatabaseColumnInfo,
  type RelationalConstraint,
  type RelationalForeignKey,
  type RelationalIndex,
  type RelationalTableStructure,
  type RelationalTrigger,
} from '@fouc/shared';
import { mappedReference } from './compare';
import { buildSqliteRebuild } from './sqlite-rebuild';
import {
  columnDefinition,
  constraintDefinition,
  createIndexDdl,
  ddlLiteral,
  dropConstraintDdl,
  dropIndexDdl,
  foreignKeyDefinition,
  qualifiedTable,
  quoteSchemaId,
  rewriteCreateTable,
  rewriteTriggerTarget,
  terminateDdl,
} from './ddl';
import { generatedColumn, parseTableDdl } from './ddl-source';
import type {
  SchemaDiffChange,
  SchemaDiffComparison,
  SchemaDiffIssue,
  SchemaDiffScript,
  SchemaDiffStep,
  SchemaDiffTable,
} from './model';
const connectorUiMessages = createUiMessages(connectorMessages);
function objectColumns(change: SchemaDiffChange, side: 'source' | 'target'): string[] {
  const value = change[side];
  if (!value || typeof value === 'string') return [];
  if (change.kind === 'column') return [(value as DatabaseColumnInfo).name];
  if (change.kind === 'index')
    return (value as RelationalIndex).parts.flatMap((part) => (part.column ? [part.column] : []));
  if (change.kind === 'foreign' || change.kind === 'constraint')
    return (value as RelationalForeignKey | RelationalConstraint).columns;
  return [];
}
function structural(change: SchemaDiffChange) {
  return ['column', 'constraint', 'foreign', 'property'].includes(change.kind);
}
/** DBX parent/child selection adapted to explicit, necessary native DDL dependencies. */
export function expandSchemaDiffSelection(
  comparison: SchemaDiffComparison,
  ids: readonly string[],
): Set<string> {
  const selected = new Set(ids);
  for (const id of selected)
    if (!comparison.changes.some((change) => change.id === id))
      throw connectorUiMessages.error('selectedStructureDifferencesChangedSelectAgain');
  let expanded = true;
  while (expanded) {
    expanded = false;
    const include = (id: string) => {
      if (!selected.has(id)) {
        selected.add(id);
        expanded = true;
      }
    };
    for (const table of comparison.tables) {
      const chosen = table.changes.filter((change) => selected.has(change.id));
      if (
        comparison.provider === 'sqlite' &&
        chosen.some(
          (change) =>
            change.kind === 'constraint' || change.kind === 'foreign' || change.kind === 'property',
        )
      ) {
        for (const change of table.changes.filter(structural)) include(change.id);
      }
      for (const change of chosen) {
        const sourceColumns = objectColumns(change, 'source');
        if (change.kind !== 'column')
          for (const added of table.changes.filter(
            (entry) =>
              entry.kind === 'column' &&
              entry.operation === 'add' &&
              sourceColumns.includes(entry.name),
          ))
            include(added.id);
        if (change.kind === 'column' && change.operation === 'remove')
          for (const dependent of table.changes.filter(
            (entry) =>
              entry.kind !== 'column' && objectColumns(entry, 'target').includes(change.name),
          ))
            include(dependent.id);
        if (comparison.provider === 'sqlite' && change.kind === 'column')
          for (const native of table.changes.filter(
            (entry) =>
              entry.kind === 'constraint' && entry.fields.some((field) => field.key === 'native'),
          ))
            include(native.id);
      }
    }
  }
  return selected;
}
function actualConstraint(
  value: RelationalConstraint,
  table: RelationalTableStructure,
): RelationalConstraint {
  return value.kind === 'primary'
    ? (table.constraints.find((constraint) => constraint.kind === 'primary') ?? {
        ...value,
        name: `${table.table}_pkey`,
      })
    : value;
}
function topologicalSteps(
  steps: SchemaDiffStep[],
  issues: SchemaDiffIssue[],
  locale?: Locale,
): SchemaDiffStep[] {
  const tConnector = createTranslator(connectorMessages, locale);
  const remaining = new Map(steps.map((step) => [step.id, step])),
    emitted = new Set<string>(),
    ordered: SchemaDiffStep[] = [];
  while (remaining.size) {
    const ready = [...remaining.values()]
      .filter((step) => step.dependsOn.every((id) => emitted.has(id) || !remaining.has(id)))
      .sort((a, b) => a.phase - b.phase);
    if (!ready.length) {
      issues.push({
        severity: 'unsupported',
        message: tConnector('changesContainADependencyCycleSplitTheDdlManually'),
      });
      ordered.push(...remaining.values());
      break;
    }
    const next = ready[0];
    ordered.push(next);
    emitted.add(next.id);
    remaining.delete(next.id);
  }
  return ordered;
}
export function buildSchemaDiffScript(
  comparison: SchemaDiffComparison,
  selectedIds: readonly string[] = comparison.changes.map((change) => change.id),
  locale?: Locale,
): SchemaDiffScript {
  const tConnector = createTranslator(connectorMessages, locale);
  const selected = expandSchemaDiffSelection(comparison, selectedIds),
    provider = comparison.provider;
  const issues = [...comparison.issues],
    steps: SchemaDiffStep[] = [];
  const quote = (value: string) => quoteSchemaId(value, provider);
  const issue = (
    change: SchemaDiffChange | null,
    severity: SchemaDiffIssue['severity'],
    message: string,
    tableId?: string,
  ) =>
    issues.push({
      severity,
      message,
      ...(change ? { changeId: change.id, tableId: change.tableId } : tableId ? { tableId } : {}),
    });
  const add = (
    table: SchemaDiffTable,
    change: SchemaDiffChange | null,
    suffix: string,
    phase: number,
    label: string,
    sql: string,
    dependsOn: string[] = [],
  ) => {
    const id = `${change?.id ?? table.id}:${suffix}`;
    steps.push({
      id,
      tableId: table.id,
      changeIds: change ? [change.id] : [],
      phase,
      label,
      sql,
      risk: change?.risk ?? 'review',
      dependsOn,
    });
    return id;
  };
  let sqliteRebuild = false;
  for (const table of comparison.tables) {
    const chosen = table.changes.filter((change) => selected.has(change.id));
    if (!chosen.length) continue;
    const target = table.target ?? table.source!,
      source = table.source;
    const physical = qualifiedTable(target, provider);
    const rebuild = provider === 'sqlite' && source && table.target && chosen.some(structural);
    if (rebuild) {
      const plan = buildSqliteRebuild(table, chosen, comparison.tables, locale);
      issues.push(...plan.issues);
      steps.push(...plan.steps);
      if (plan.steps.length) sqliteRebuild = true;
      continue;
    }
    for (const change of chosen) {
      const stepStart = steps.length;
      try {
        switch (change.kind) {
          case 'table': {
            if (target.kind !== 'table')
              throw connectorUiMessages.error(
                'thisBatchGeneratesOrdinaryTableDdlOnlyViewsAndMaterialized',
              );
            if (change.operation === 'remove') {
              add(
                table,
                change,
                'drop',
                80,
                tConnector('dropTable', { p0: String(table.name) }),
                `DROP TABLE ${physical};`,
              );
              issue(change, 'warning', tConnector('dropTableDeletesEveryRow'));
            } else {
              let sql = rewriteCreateTable(source!, target);
              if (provider !== 'sqlite') {
                const parts = parseTableDdl(sql, provider)!;
                const clauses = parts.clauses.filter((clause) => {
                  const tokens = tokenizeSqlSemantic(clause, provider).filter(
                    (token) => token.kind !== 'comment',
                  );
                  const foreign = tokens.some(
                    (token, index) =>
                      token.kind === 'word' &&
                      token.text.toUpperCase() === 'FOREIGN' &&
                      tokens[index + 1]?.text.toUpperCase() === 'KEY',
                  );
                  const regularIndex =
                    provider === 'mysql' &&
                    /^(?:KEY|INDEX|FULLTEXT|SPATIAL)$/i.test(tokens[0]?.text ?? '');
                  return !foreign && !regularIndex;
                });
                sql = terminateDdl(
                  sql.slice(0, parts.bodyStart) +
                    '\n  ' +
                    [...parts.columns.values(), ...clauses].join(',\n  ') +
                    '\n)' +
                    (parts.suffix ? ' ' + parts.suffix : ''),
                );
              }
              const create = add(
                table,
                change,
                'create',
                20,
                tConnector('createTable', { p0: String(table.name) }),
                sql,
              );
              for (const index of source!.indexes.filter(
                (entry) => !entry.primary && !entry.constraintBacked,
              ))
                add(
                  table,
                  change,
                  `index:${index.name}`,
                  50,
                  tConnector('createIndex', { p0: String(index.name) }),
                  createIndexDdl(index, target),
                  [create],
                );
              if (provider !== 'sqlite')
                for (const foreign of source!.foreignKeys)
                  add(
                    table,
                    change,
                    `foreign:${foreign.name}`,
                    70,
                    tConnector('addForeignKey', { p0: String(foreign.name) }),
                    `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(foreign.name)} ${foreignKeyDefinition(mappedReference(foreign, table, comparison.tables), provider)};`,
                    [create],
                  );
              for (const trigger of source!.triggers)
                add(
                  table,
                  change,
                  `trigger:${trigger.name}`,
                  75,
                  tConnector('createTrigger', { p0: String(trigger.name) }),
                  rewriteTriggerTarget(trigger.definition, target),
                  [create],
                );
            }
            break;
          }
          case 'column': {
            const column = change.source as DatabaseColumnInfo | null,
              previous = change.target as DatabaseColumnInfo | null;
            if (change.operation === 'remove') {
              add(
                table,
                change,
                'drop',
                generatedColumn(previous!, null) ? 25 : 40,
                tConnector('dropColumn', { p0: String(change.name) }),
                `ALTER TABLE ${physical} DROP COLUMN ${quote(change.name)};`,
              );
              issue(
                change,
                'warning',
                tConnector('existingDataInColumnWillBeDeletedExternalDependenciesAre', {
                  p0: String(change.name),
                }),
              );
            } else if (change.operation === 'add') {
              // A new generated field must follow type changes of fields it references.
              add(
                table,
                change,
                'add',
                generatedColumn(column!, null) ? 45 : 30,
                tConnector('addColumn', { p0: String(change.name) }),
                `ALTER TABLE ${physical} ADD COLUMN ${columnDefinition(column!, source!)};`,
              );
              if (
                !column!.isNullable &&
                column!.columnDefault === null &&
                !generatedColumn(column!, null)
              )
                issue(change, 'warning', tConnector('aNewNonNullColumnHasNoDefaultExistingRows'));
              if (provider === 'postgres' && column!.comment !== null)
                add(
                  table,
                  change,
                  'comment',
                  60,
                  tConnector('columnComment', { p0: String(change.name) }),
                  `COMMENT ON COLUMN ${physical}.${quote(change.name)} IS ${ddlLiteral(column!.comment, provider)};`,
                );
            } else if (provider === 'mysql') {
              let position = '';
              if (change.fields.some((field) => field.key === 'order')) {
                const index = source!.columns.findIndex((entry) => entry.name === change.name);
                position =
                  index === 0 ? ' FIRST' : ` AFTER ${quote(source!.columns[index - 1].name)}`;
              }
              add(
                table,
                change,
                'modify',
                35,
                tConnector('modifyColumn', { p0: String(change.name) }),
                `ALTER TABLE ${physical} MODIFY COLUMN ${columnDefinition(column!, source!)}${position};`,
              );
              issue(
                change,
                'warning',
                tConnector('mysqlModifyRestatesTheColumnDefinitionAndMayRebuildOr'),
              );
            } else {
              const keys = new Set(change.fields.map((field) => field.key));
              if (
                keys.has('generated') ||
                keys.has('identity') ||
                keys.has('extra') ||
                keys.has('characterSet') ||
                keys.has('enumValues')
              )
                throw connectorUiMessages.error(
                  'generatedColumnIdentityOrEnumChangesForRequireManualReview',
                  { p0: String(change.name) },
                );
              if (keys.has('order'))
                issue(
                  change,
                  'unsupported',
                  tConnector('postgresqlCannotChangePhysicalColumnOrderThroughAlterNoFabricated'),
                );
              if (keys.has('type') || keys.has('collation')) {
                const dependency = target.columns.find(
                  (candidate) =>
                    candidate.name !== change.name &&
                    generatedColumn(candidate, null) &&
                    tokenizeSqlSemantic(candidate.columnDefault ?? '', provider).some(
                      (token, index, tokens) =>
                        token.kind === 'quoted_identifier'
                          ? unquoteSqlSemanticIdentifier(token) === change.name
                          : token.kind === 'word' &&
                            token.normalized === change.name.toLowerCase() &&
                            tokens[index + 1]?.text !== '(',
                    ) &&
                    !chosen.some(
                      (entry) =>
                        entry.kind === 'column' &&
                        entry.name === candidate.name &&
                        entry.operation === 'remove',
                    ),
                );
                if (dependency)
                  throw connectorUiMessages.error(
                    'generatedColumnDependsOnColumnReviewRemovalAndRecreationOf',
                    { p0: String(change.name), p1: String(dependency.name) },
                  );
                const collation = column!.collation ? ` COLLATE ${quote(column!.collation)}` : '';
                add(
                  table,
                  change,
                  'type',
                  35,
                  tConnector('columnType', { p0: String(change.name) }),
                  `ALTER TABLE ${physical} ALTER COLUMN ${quote(change.name)} TYPE ${column!.dataType}${collation} USING ${quote(change.name)}::${column!.dataType};`,
                );
                issue(
                  change,
                  'warning',
                  tConnector('explicitNativeConversionWithUsingMayFailOrLosePrecision'),
                );
              }
              if (keys.has('default'))
                add(
                  table,
                  change,
                  'default',
                  36,
                  tConnector('columnDefault', { p0: String(change.name) }),
                  `ALTER TABLE ${physical} ALTER COLUMN ${quote(change.name)} ${column!.columnDefault === null ? 'DROP DEFAULT' : `SET DEFAULT ${column!.columnDefault}`};`,
                );
              if (keys.has('nullable'))
                add(
                  table,
                  change,
                  'nullability',
                  37,
                  tConnector('columnNullConstraint', { p0: String(change.name) }),
                  `ALTER TABLE ${physical} ALTER COLUMN ${quote(change.name)} ${column!.isNullable ? 'DROP' : 'SET'} NOT NULL;`,
                );
              if (keys.has('comment'))
                add(
                  table,
                  change,
                  'comment',
                  60,
                  tConnector('columnComment', { p0: String(change.name) }),
                  `COMMENT ON COLUMN ${physical}.${quote(change.name)} IS ${ddlLiteral(column!.comment, provider)};`,
                );
              if (previous && !column!.isNullable && previous.isNullable)
                issue(
                  change,
                  'warning',
                  tConnector('beforeSetNotNullEnsureExistingRowsContainNoNull'),
                );
            }
            break;
          }
          case 'index': {
            let drop: string | undefined;
            if (change.target)
              drop = add(
                table,
                change,
                'drop',
                15,
                tConnector('removeOldIndex', { p0: String(change.name) }),
                dropIndexDdl(change.target as RelationalIndex, target),
              );
            if (change.source)
              add(
                table,
                change,
                'create',
                50,
                tConnector('addIndex', { p0: String(change.name) }),
                createIndexDdl(change.source as RelationalIndex, target),
                drop ? [drop] : [],
              );
            break;
          }
          case 'constraint': {
            if (typeof change.source === 'string' || typeof change.target === 'string')
              throw connectorUiMessages.error(
                'thisOriginalDdlConstraintRequiresTheSqliteRebuildFlow',
              );
            let drop: string | undefined;
            if (change.target)
              drop = add(
                table,
                change,
                'drop',
                10,
                tConnector('removeOldConstraint', { p0: String(change.name) }),
                dropConstraintDdl(
                  actualConstraint(change.target as RelationalConstraint, target),
                  target,
                ),
              );
            if (change.source) {
              const constraint = actualConstraint(change.source as RelationalConstraint, source!);
              add(
                table,
                change,
                'add',
                55,
                tConnector('addConstraint', { p0: String(change.name) }),
                `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(constraint.name)} ${constraintDefinition(constraint, provider)};`,
                drop ? [drop] : [],
              );
              issue(
                change,
                'warning',
                tConnector('newPkUniqueCheckConstraintsRequireExistingDataToComply'),
              );
            }
            break;
          }
          case 'foreign': {
            let drop: string | undefined;
            if (change.target) {
              const foreign = change.target as RelationalForeignKey;
              if (foreign.nameSource !== 'catalog')
                throw connectorUiMessages.error('theForeignKeyNameIsInferredFromASequenceNumber');
              drop = add(
                table,
                change,
                'drop',
                5,
                tConnector('removeOldForeignKey', { p0: String(change.name) }),
                `ALTER TABLE ${physical} DROP ${provider === 'mysql' ? 'FOREIGN KEY' : 'CONSTRAINT'} ${quote(foreign.name)};`,
              );
            }
            if (change.source)
              add(
                table,
                change,
                'add',
                70,
                tConnector('addForeignKey', { p0: String(change.name) }),
                `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(change.name)} ${foreignKeyDefinition(mappedReference(change.source as RelationalForeignKey, table, comparison.tables), provider)};`,
                drop ? [drop] : [],
              );
            issue(
              change,
              'warning',
              tConnector('foreignKeysRequireAnExistingTargetTableAndUsableUnique'),
            );
            break;
          }
          case 'trigger': {
            if (provider === 'postgres')
              throw connectorUiMessages.error(
                'postgresqlTriggersDependOnFunctionsAndEnabledStatusThisBatch',
              );
            let drop: string | undefined;
            if (change.target)
              drop = add(
                table,
                change,
                'drop',
                5,
                tConnector('removeTrigger', { p0: String(change.name) }),
                `DROP TRIGGER ${quote(target.schema)}.${quote(change.name)};`,
              );
            if (change.source)
              add(
                table,
                change,
                'add',
                75,
                tConnector('addTrigger', { p0: String(change.name) }),
                rewriteTriggerTarget((change.source as RelationalTrigger).definition, target),
                drop ? [drop] : [],
              );
            issue(
              change,
              'warning',
              tConnector('triggerBodiesMayReferenceSourceObjectsOrUseDifferentPermissions'),
            );
            break;
          }
          case 'property': {
            const value = typeof change.source === 'string' ? change.source : null;
            if (change.name === 'comment')
              add(
                table,
                change,
                'comment',
                60,
                tConnector('tableComment'),
                provider === 'mysql'
                  ? `ALTER TABLE ${physical} COMMENT=${ddlLiteral(value ?? '', provider)};`
                  : `COMMENT ON TABLE ${physical} IS ${ddlLiteral(value, provider)};`,
              );
            else if (
              provider === 'mysql' &&
              ['engine', 'collation', 'rowFormat'].includes(change.name) &&
              value
            ) {
              const keyword =
                change.name === 'engine'
                  ? 'ENGINE'
                  : change.name === 'collation'
                    ? 'COLLATE'
                    : 'ROW_FORMAT';
              if (!/^[A-Za-z0-9_]+$/.test(value))
                throw connectorUiMessages.error('theTablePropertyIsNotAValidNativeName');
              add(
                table,
                change,
                'option',
                60,
                tConnector('tableProperty', { p0: String(change.name) }),
                `ALTER TABLE ${physical} ${keyword}=${value};`,
              );
              issue(
                change,
                'warning',
                tConnector('tablePropertyChangesMayRebuildOrLockTheTableOr'),
              );
            } else if (provider === 'postgres' && change.name === 'owner' && value)
              add(
                table,
                change,
                'owner',
                60,
                tConnector('tableOwner'),
                `ALTER TABLE ${physical} OWNER TO ${quote(value)};`,
              );
            else if (
              provider === 'postgres' &&
              change.name === 'persistence' &&
              ['p', 'u'].includes(value ?? '')
            )
              add(
                table,
                change,
                'persistence',
                60,
                tConnector('tablePersistence'),
                `ALTER TABLE ${physical} SET ${value === 'u' ? 'UNLOGGED' : 'LOGGED'};`,
              );
            else if (provider === 'postgres' && change.name === 'tablespace')
              add(
                table,
                change,
                'tablespace',
                60,
                tConnector('tablespace'),
                `ALTER TABLE ${physical} SET TABLESPACE ${quote(value ?? 'pg_default')};`,
              );
            else
              throw connectorUiMessages.error(
                'tablePropertyLacksAReliableNativeChangeRuleAndRequires',
                { p0: String(change.name) },
              );
            break;
          }
        }
      } catch (error) {
        steps.splice(stepStart);
        issue(
          change,
          'unsupported',
          error instanceof Error ? uiText(error, locale ?? getLocale()) : String(error),
        );
      }
    }
  }
  if (provider !== 'sqlite') {
    for (const owner of comparison.tables) {
      if (!owner.target) continue;
      for (const foreign of owner.target.foreignKeys) {
        const already = owner.changes.find(
          (change) =>
            change.kind === 'foreign' && change.name === foreign.name && selected.has(change.id),
        );
        if (already) continue;
        const affected = comparison.tables.some(
          (table) =>
            table.target &&
            table.changes.some(
              (change) =>
                selected.has(change.id) &&
                ((change.kind === 'constraint' &&
                  (change.target as RelationalConstraint | null)?.kind === 'primary' &&
                  table.target!.schema === foreign.referencedSchema &&
                  table.target!.table === foreign.referencedTable) ||
                  (change.kind === 'column' &&
                    (change.operation === 'remove' ||
                      change.fields.some((field) => field.key === 'type')) &&
                    ((owner.id === table.id && foreign.columns.includes(change.name)) ||
                      (table.target!.schema === foreign.referencedSchema &&
                        table.target!.table === foreign.referencedTable &&
                        foreign.referencedColumns.includes(change.name))))),
            ),
        );
        if (!affected) continue;
        if (foreign.nameSource !== 'catalog') {
          issue(
            null,
            'unsupported',
            tConnector('dependentForeignKeyLacksItsActualCatalogNameAndCannot', {
              p0: String(foreign.name),
            }),
            owner.id,
          );
          continue;
        }
        const physical = qualifiedTable(owner.target, provider);
        const drop = add(
          owner,
          null,
          `dependency:${foreign.name}:drop`,
          1,
          tConnector('temporarilyRemoveDependentForeignKey', { p0: String(foreign.name) }),
          `ALTER TABLE ${physical} DROP ${provider === 'mysql' ? 'FOREIGN KEY' : 'CONSTRAINT'} ${quote(foreign.name)};`,
        );
        const desired = owner.source?.foreignKeys.find((entry) => entry.name === foreign.name);
        if (desired)
          add(
            owner,
            null,
            `dependency:${foreign.name}:restore`,
            70,
            tConnector('restoreDependentForeignKey', { p0: String(foreign.name) }),
            `ALTER TABLE ${physical} ADD CONSTRAINT ${quote(foreign.name)} ${foreignKeyDefinition(mappedReference(desired, owner, comparison.tables), provider)};`,
            [drop],
          );
      }
    }
  }
  if (sqliteRebuild) {
    steps.unshift({
      id: 'sqlite:begin',
      tableId: '',
      changeIds: [],
      phase: 0,
      label: tConnector('recordForeignKeySettingsAndBeginTheRebuildTransaction'),
      sql: tConnector('sqliteBegin'),
      risk: 'review',
      dependsOn: [],
    });
    for (const step of steps) if (step.id !== 'sqlite:begin') step.dependsOn.push('sqlite:begin');
    steps.push({
      id: 'sqlite:check',
      tableId: '',
      changeIds: [],
      phase: 95,
      label: tConnector('verifyForeignKeysAndManuallyConfirmCommit'),
      sql: tConnector('sqliteCheck'),
      risk: 'review',
      dependsOn: [],
    });
    issues.push({
      severity: 'warning',
      message: tConnector('theSqliteRebuildScriptDeliberatelyStopsAtACheckpointInside'),
    });
  }
  for (const table of comparison.tables) {
    if (
      !table.source ||
      !table.target ||
      table.source.connectionId !== table.target.connectionId ||
      table.source.schema !== table.target.schema ||
      table.source.table === table.target.table
    )
      continue;
    for (const change of table.changes.filter(
      (entry) =>
        selected.has(entry.id) &&
        entry.source &&
        ['index', 'constraint'].includes(entry.kind) &&
        provider !== 'mysql',
    )) {
      issue(
        change,
        'unsupported',
        tConnector('sourceAndTargetShareAConnectionAndSchemaSourceIndex', {
          p0: String(change.name),
        }),
      );
    }
  }
  const ordered = topologicalSteps(steps, issues, locale);
  const distinctIssues = [
    ...new Map(issues.map((entry) => [JSON.stringify(entry), entry])).values(),
  ];
  const header = tConnector('reviewHeader', { provider });
  const notes = distinctIssues
    .filter((entry) => entry.severity !== 'info')
    .map(
      (entry) =>
        `-- ${entry.severity === 'unsupported' ? tConnector('requiresManualHandling') : tConnector('effects')}：${entry.message.replace(/[\r\n]+/g, ' ')}`,
    )
    .join('\n');
  const body = ordered
    .map((step, index) => `-- ${index + 1}. ${step.label.replace(/[\r\n]+/g, ' ')}\n${step.sql}`)
    .join('\n\n');
  return {
    sql: header + (notes ? notes + '\n\n' : '') + (body || tConnector('noSelectedChanges')),
    steps: ordered,
    issues: distinctIssues,
    selectedCount: selected.size,
    reviewComplete: !distinctIssues.some((entry) => entry.severity === 'unsupported'),
  };
}
