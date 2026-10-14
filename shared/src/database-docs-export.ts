import {
  validationIssue,
  validationValue,
  type ValidationFormatter,
  defaultValidationMessage,
} from './validation-issue';
import type { DatabaseColumnInfo } from './database';
import {
  type DatabaseDocsExport,
  type DatabaseDocsNote,
  type DatabaseDocsSnapshot,
  type DatabaseDocsTable,
  type DatabaseDocsWarning,
} from './database-docs';
/** DBX OKLCH group palette conversion, shared by exported DBML and the native viewer. */
export function databaseDocsGroupColor(hue: number): string {
  const angle = ((hue % 360) * Math.PI) / 180,
    a = 0.15 * Math.cos(angle),
    b = 0.15 * Math.sin(angle),
    light = 0.55;
  const l = (light + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (light - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (light - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channel = (value: number) =>
    Math.round(
      Math.min(
        1,
        Math.max(0, value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055),
      ) * 255,
    )
      .toString(16)
      .padStart(2, '0');
  return (
    '#' +
    channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) +
    channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) +
    channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  );
}
function identifier(value: string): string {
  return JSON.stringify(value);
}
function qualified(schema: string, table: string): string {
  return `${identifier(schema)}.${identifier(table)}`;
}
function note(value: string): string {
  return `'''${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'''`;
}
function omission(
  warnings: DatabaseDocsWarning[],
  table: DatabaseDocsTable,
  item: string,
  message: string,
) {
  warnings.push({
    kind: 'dbml-omitted',
    table: `${table.structure.schema}.${table.structure.table}`,
    item,
    message,
  });
}
function nativeType(column: DatabaseColumnInfo): string {
  let type = column.dataType;
  if (!type.includes('(')) {
    if (column.characterMaximumLength !== null && column.characterMaximumLength > 0)
      type += `(${column.characterMaximumLength})`;
    else if (
      column.numericPrecision !== null &&
      column.numericPrecision > 0 &&
      /^(?:numeric|decimal|number)$/i.test(type)
    )
      type += `(${column.numericPrecision}${column.numericScale !== null ? `,${column.numericScale}` : ''})`;
  }
  return /\s|"|`/.test(type) ? identifier(type) : type || 'unknown';
}
function literalDefault(value: string): string | null {
  const source = value.trim();
  if (!source) return null;
  if (/^(?:[-+]?\d+(?:\.\d*)?(?:e[-+]?\d+)?|true|false|null)$/i.test(source)) return source;
  if (/^'(?:[^']|'')*'$/.test(source))
    return `'${source.slice(1, -1).replaceAll("''", "'").replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  return source.includes('`') ? null : `\`${source}\``;
}
export function exportDatabaseDocsDbml(
  snapshot: DatabaseDocsSnapshot,
  localize: ValidationFormatter = defaultValidationMessage,
): DatabaseDocsExport {
  const warnings = structuredClone(snapshot.warnings),
    sections: string[] = [];
  sections.push(
    `Project ${identifier(snapshot.project.name)} {\n  database_type: '${snapshot.provider === 'postgres' ? 'PostgreSQL' : snapshot.provider === 'mysql' ? 'MySQL' : 'SQLite'}'${snapshot.project.note ? `\n  Note: ${note(snapshot.project.note)}` : ''}\n}`,
  );
  for (const table of snapshot.tables) {
    const structure = table.structure,
      lines = [`Table ${qualified(structure.schema, structure.table)} {`],
      primary = structure.columns
        .filter((column) => column.isPrimaryKey)
        .map((column) => column.name);
    for (const column of structure.columns) {
      const settings: string[] = [];
      if (column.isPrimaryKey && primary.length === 1) settings.push('pk');
      if (column.isUnique && !column.isPrimaryKey) settings.push('unique');
      settings.push(column.isNullable ? 'null' : 'not null');
      if (/(?:\bauto_increment\b|\bidentity\b|\bautoincrement\b)/i.test(column.extra ?? ''))
        settings.push('increment');
      if (column.columnDefault !== null) {
        const rendered = literalDefault(column.columnDefault);
        if (rendered !== null) settings.push(`default: ${rendered}`);
        else
          omission(
            warnings,
            table,
            column.name,
            localize(
              validationIssue(
                'database-docs-export.theDefaultExpressionContainsBackticksThatDbmlCannot',
                '默认表达式包含 DBML 无法安全表达的反引号，已保留在结构文档。',
              ),
            ),
          );
      }
      if (table.columnNotes[column.name]?.effective)
        settings.push(`note: ${note(table.columnNotes[column.name].effective!)}`);
      if (column.enumValues?.length)
        omission(
          warnings,
          table,
          column.name,
          localize(
            validationIssue(
              'database-docs-export.currentDbmlPreservesNativeTypeNamesEnumValues',
              '当前 DBML 保留原生类型名称；枚举值保留在结构文档，不生成未知类型身份。',
            ),
          ),
        );
      if (
        column.collation ||
        column.characterSet ||
        /(?:\bstored\b|\bvirtual\b|\bgenerated\b)/i.test(
          (column.extra ?? '').replace(/\bDEFAULT_GENERATED\b/gi, ''),
        )
      )
        omission(
          warnings,
          table,
          column.name,
          localize(
            validationIssue(
              'database-docs-export.dbmlCannotFullyExpressColumnCollationsCharacterSets',
              '字段排序规则、字符集或生成属性无法完整表达在 DBML，原生元数据仍保留。',
            ),
          ),
        );
      lines.push(`  ${identifier(column.name)} ${nativeType(column)} [${settings.join(', ')}]`);
    }
    const indexes: string[] =
      primary.length > 1 ? [`    (${primary.map(identifier).join(', ')}) [pk]`] : [];
    for (const index of structure.indexes) {
      if (index.primary) continue;
      const parts = index.parts.filter((part) => part.role === 'key');
      if (
        !parts.length ||
        index.valid === false ||
        index.predicate ||
        index.parts.some((part) => part.role === 'include') ||
        parts.some(
          (part) =>
            !part.column ||
            part.expression !== null ||
            part.prefixLength !== null ||
            part.descending === true ||
            part.collation !== null ||
            part.nulls !== null,
        ) ||
        !['btree', 'hash'].includes(index.method.toLowerCase())
      ) {
        omission(
          warnings,
          table,
          index.name,
          localize(
            validationIssue(
              'database-docs-export.dbmlDoesNotFullySupportIndexExpressionsPredicates',
              '索引表达式、过滤条件、包含列、前缀、排序选项或原生方法不受 DBML 完整支持，已省略该索引。',
            ),
          ),
        );
        continue;
      }
      indexes.push(
        `    (${parts.map((part) => identifier(part.column!)).join(', ')}) [name: '${index.name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}', type: ${index.method.toLowerCase()}${index.unique ? ', unique' : ''}]`,
      );
    }
    if (indexes.length) lines.push('', '  indexes {', ...indexes, '  }');
    if (table.note.effective) lines.push('', `  Note: ${note(table.note.effective)}`);
    lines.push('}');
    sections.push(lines.join('\n'));
    for (const constraint of structure.constraints)
      if (['check', 'exclusion'].includes(constraint.kind))
        omission(
          warnings,
          table,
          constraint.name,
          localize(
            validationIssue(
              'database-docs-export.nativeCheckExcludeConstraintsRemainInTheStructure',
              '原生 CHECK / EXCLUDE 约束保留在结构文档，未加入 DBML。',
            ),
          ),
        );
    for (const trigger of structure.triggers)
      omission(
        warnings,
        table,
        trigger.name,
        localize(
          validationIssue(
            'database-docs-export.originalTriggerDefinitionsRemainInTheStructureDocument',
            '触发器原始定义保留在结构文档，DBML 不表达执行逻辑。',
          ),
        ),
      );
    if (structure.kind !== 'table')
      omission(
        warnings,
        table,
        structure.table,
        localize(
          validationIssue(
            'database-docs-export.dbmlDisplaysViewColumnsUsingTableNativeView',
            'DBML 用 Table 展示视图字段；原生视图类型和定义保留在 Markdown / 结构文档。',
          ),
        ),
      );
  }
  for (const relationship of snapshot.relationships) {
    if (!relationship.resolved) continue;
    const field = (value: typeof relationship.from) =>
      `${qualified(value.schema, value.table)}.${value.columns.length === 1 ? identifier(value.columns[0]) : `(${value.columns.map(identifier).join(', ')})`}`;
    const actions: string[] = [];
    for (const [kind, value] of [
      ['update', relationship.onUpdate],
      ['delete', relationship.onDelete],
    ]) {
      const action = value.toLowerCase();
      if (['cascade', 'restrict', 'set null', 'set default', 'no action'].includes(action))
        actions.push(`${kind}: ${action}`);
      else
        warnings.push({
          kind: 'dbml-omitted',
          table: `${relationship.from.schema}.${relationship.from.table}`,
          item: relationship.name,
          message: localize(
            validationIssue(
              'database-docs-export.foreignKeyHasAnUnknownOrUnsupportedDbml',
              '外键 {p0} 动作未知或不受 DBML 支持，原始值保留在结构文档。',
              { p0: validationValue(kind) },
            ),
          ),
        });
    }
    sections.push(
      `Ref ${identifier(`${relationship.from.schema}.${relationship.from.table}:${relationship.name}`)}: ${field(relationship.from)} ${relationship.cardinality === 'one-to-one' ? '-' : '>'} ${field(relationship.to)}${actions.length ? ` [${actions.join(', ')}]` : ''}`,
    );
  }
  for (const group of snapshot.groups) {
    const members = snapshot.tables.filter((table) => table.groupId === group.id);
    if (!members.length) continue;
    sections.push(
      `TableGroup ${identifier(group.id)} [color: ${databaseDocsGroupColor(group.hue)}] {\n${members.map((table) => `  ${qualified(table.structure.schema, table.structure.table)}`).join('\n')}${group.note ? `\n  Note: ${note(group.note)}` : ''}\n}`,
    );
  }
  return { text: sections.join('\n\n') + '\n', warnings };
}
function cell(
  value: string | null | undefined,
  localize: ValidationFormatter = defaultValidationMessage,
): string {
  return (value ?? localize(validationIssue('database-docs-export.unknown', '未知')))
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, '<br>');
}
function code(value: string): string {
  const delimiter = '`'.repeat(
    Math.max(1, ...(value.match(/`+/g) ?? []).map((part) => part.length + 1)),
  );
  return `${delimiter} ${value} ${delimiter}`;
}
function fence(sql: string, language = 'sql'): string {
  const delimiter = '`'.repeat(
    Math.max(3, ...(sql.match(/`+/g) ?? []).map((part) => part.length + 1)),
  );
  return `${delimiter}${language}\n${sql}\n${delimiter}`;
}
function notes(
  description: DatabaseDocsNote,
  localize: ValidationFormatter = defaultValidationMessage,
): string[] {
  const parts: string[] = [];
  if (description.database !== null)
    parts.push(
      localize(
        validationIssue('database-docs-export.nativeDatabaseComments', '**数据库原生注释**'),
      ),
      description.database,
    );
  if (description.local !== null)
    parts.push(
      localize(
        validationIssue(
          'database-docs-export.deviceLocalMarkdownNotes',
          '**设备本地 Markdown 笔记**',
        ),
      ),
      description.local,
    );
  return parts;
}
export function exportDatabaseDocsMarkdown(
  snapshot: DatabaseDocsSnapshot,
  localize: ValidationFormatter = defaultValidationMessage,
): DatabaseDocsExport {
  const sections = [
    `# ${snapshot.project.name}`,
    localize(
      validationIssue(
        'database-docs-export.databaseCollectedAt',
        '数据库：{p0} · {p1}\n\n采集于：{p2}',
        {
          p0: validationValue(code(snapshot.database)),
          p1: validationValue(snapshot.provider),
          p2: validationValue(snapshot.generatedAt),
        },
      ),
    ),
  ];
  if (snapshot.project.note) sections.push(snapshot.project.note);
  if (snapshot.warnings.length)
    sections.push(
      localize(validationIssue('database-docs-export.metadataWarnings', '## 元数据告警')),
      ...snapshot.warnings.map(
        (warning) => `- ${warning.table ? `${code(warning.table)}：` : ''}${warning.message}`,
      ),
    );
  for (const group of snapshot.groups)
    sections.push(
      localize(
        validationIssue('database-docs-export.group', '## 分组：{p0}', {
          p0: validationValue(group.name),
        }),
      ),
      localize(
        validationIssue('database-docs-export.color', '颜色：{p0}', {
          p0: validationValue(databaseDocsGroupColor(group.hue)),
        }),
      ),
      group.note ?? '',
      ...snapshot.tables
        .filter((table) => table.groupId === group.id)
        .map((table) => `- ${code(`${table.structure.schema}.${table.structure.table}`)}`),
    );
  for (const table of snapshot.tables) {
    const structure = table.structure;
    sections.push(
      `## ${code(`${structure.schema}.${structure.table}`)}`,
      localize(
        validationIssue('database-docs-export.nativeType', '原生类型：{p0}', {
          p0: validationValue(structure.kind),
        }),
      ),
      ...notes(table.note, localize),
    );
    sections.push(
      localize(validationIssue('database-docs-export.columns', '### 字段')),
      localize(
        validationIssue(
          'database-docs-export.columnNativeTypeNullablePrimaryKeyDefaultDatabase',
          '| 字段 | 原生类型 | 可空 | 主键 | 默认值 | 数据库注释 | 本地笔记 |\n| --- | --- | --- | --- | --- | --- | --- |\n',
        ),
      ) +
        structure.columns
          .map(
            (column) =>
              `| ${cell(column.name, localize)} | ${cell(column.dataType, localize)} | ${column.isNullable ? localize(validationIssue('database-docs-export.yes', '是')) : localize(validationIssue('database-docs-export.no', '否'))} | ${column.isPrimaryKey ? localize(validationIssue('database-docs-export.yes', '是')) : localize(validationIssue('database-docs-export.no', '否'))} | ${cell(column.columnDefault, localize)} | ${cell(table.columnNotes[column.name]?.database, localize)} | ${cell(table.columnNotes[column.name]?.local, localize)} |`,
          )
          .join('\n'),
    );
    const outgoing = snapshot.relationships.filter(
        (relationship) => relationship.from.tableKey === table.key,
      ),
      incoming = snapshot.relationships.filter(
        (relationship) => relationship.to.tableKey === table.key,
      );
    sections.push(
      localize(
        validationIssue(
          'database-docs-export.bidirectionalForeignKeyRelationships',
          '### 双向外键关系',
        ),
      ),
      ...outgoing.map(
        (relationship) =>
          `- → ${code(`${relationship.to.schema}.${relationship.to.table}`)}：(${relationship.from.columns.join(', ')}) → (${relationship.to.columns.join(', ')})；${relationship.cardinality}；UPDATE ${relationship.onUpdate} / DELETE ${relationship.onDelete}${relationship.resolved ? '' : localize(validationIssue('database-docs-export.targetUnconfirmed', '；目标未确认'))}`,
      ),
      ...incoming.map(
        (relationship) =>
          `- ← ${code(`${relationship.from.schema}.${relationship.from.table}`)}：(${relationship.from.columns.join(', ')}) → (${relationship.to.columns.join(', ')})；${relationship.cardinality}`,
      ),
    );
    if (!outgoing.length && !incoming.length)
      sections.push(
        localize(
          validationIssue(
            'database-docs-export.noRelatedForeignKeysRecordedInTheNative',
            '原生目录未记录相关外键。',
          ),
        ),
      );
    for (const index of structure.indexes)
      sections.push(
        localize(
          validationIssue('database-docs-export.index', '### 索引 {p0}', {
            p0: validationValue(code(index.name)),
          }),
        ),
        localize(
          validationIssue(
            'database-docs-export.methodUniquePrimaryKey',
            '方法：{p0}；唯一：{p1}；主键：{p2}',
            {
              p0: validationValue(index.method),
              p1: validationValue(index.unique),
              p2: validationValue(index.primary),
            },
          ),
        ),
        fence(JSON.stringify(index, null, 2), 'json'),
      );
    for (const constraint of structure.constraints)
      sections.push(
        localize(
          validationIssue('database-docs-export.constraint', '### 约束 {p0}', {
            p0: validationValue(code(constraint.name)),
          }),
        ),
        fence(constraint.definition ?? JSON.stringify(constraint, null, 2)),
      );
    for (const trigger of structure.triggers)
      sections.push(
        localize(
          validationIssue('database-docs-export.trigger', '### 触发器 {p0}', {
            p0: validationValue(code(trigger.name)),
          }),
        ),
        fence(trigger.definition),
      );
    sections.push(
      localize(
        validationIssue('database-docs-export.originalStructureDefinition', '### 原始结构定义'),
      ),
      localize(
        validationIssue('database-docs-export.source', '来源：{p0}', {
          p0: validationValue(structure.definition.origin),
        }),
      ),
      fence(structure.definition.sql),
      localize(validationIssue('database-docs-export.nativeProperties', '### 原生属性')),
      fence(JSON.stringify(structure.properties, null, 2), 'json'),
    );
  }
  if (snapshot.orphans.length)
    sections.push(
      localize(
        validationIssue(
          'database-docs-export.noteTargetsNotFoundInThisSnapshot',
          '## 未在本次快照中找到的笔记目标',
        ),
      ),
      ...snapshot.orphans.map((orphan) =>
        localize(
          validationIssue(
            'database-docs-export.notePreservedDeletionIsNotInferred',
            '- {p0}（笔记保留；不推断是否已删除）',
            {
              p0: validationValue(
                code(
                  `${orphan.schema}.${orphan.table}${orphan.column === null ? '' : `.${orphan.column}`}`,
                ),
              ),
            },
          ),
        ),
      ),
    );
  return {
    text: sections.filter(Boolean).join('\n\n') + '\n',
    warnings: structuredClone(snapshot.warnings),
  };
}
