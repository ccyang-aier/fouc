import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  theDefaultExpressionContainsBackticksThatDbmlCannot: [
    '默认表达式包含 DBML 无法安全表达的反引号，已保留在结构文档。',
    'The default expression contains backticks that DBML cannot safely represent; it is preserved in the structure document.',
  ],
  currentDbmlPreservesNativeTypeNamesEnumValues: [
    '当前 DBML 保留原生类型名称；枚举值保留在结构文档，不生成未知类型身份。',
    'Current DBML preserves native type names. Enum values remain in the structure document; unknown type identities are not generated.',
  ],
  dbmlCannotFullyExpressColumnCollationsCharacterSets: [
    '字段排序规则、字符集或生成属性无法完整表达在 DBML，原生元数据仍保留。',
    'DBML cannot fully express column collations, character sets, or generated attributes. Native metadata is preserved.',
  ],
  dbmlDoesNotFullySupportIndexExpressionsPredicates: [
    '索引表达式、过滤条件、包含列、前缀、排序选项或原生方法不受 DBML 完整支持，已省略该索引。',
    'DBML does not fully support index expressions, predicates, included columns, prefixes, sort options, or native methods. The index was omitted.',
  ],
  nativeCheckExcludeConstraintsRemainInTheStructure: [
    '原生 CHECK / EXCLUDE 约束保留在结构文档，未加入 DBML。',
    'Native CHECK / EXCLUDE constraints remain in the structure document and are not included in DBML.',
  ],
  originalTriggerDefinitionsRemainInTheStructureDocument: [
    '触发器原始定义保留在结构文档，DBML 不表达执行逻辑。',
    'Original trigger definitions remain in the structure document; DBML does not express execution logic.',
  ],
  dbmlDisplaysViewColumnsUsingTableNativeView: [
    'DBML 用 Table 展示视图字段；原生视图类型和定义保留在 Markdown / 结构文档。',
    'DBML displays view columns using Table. Native view types and definitions remain in Markdown / structure documents.',
  ],
  foreignKeyHasAnUnknownOrUnsupportedDbml: [
    '外键 {p0} 动作未知或不受 DBML 支持，原始值保留在结构文档。',
    'Foreign key {p0} has an unknown or unsupported DBML action; its original value remains in the structure document.',
  ],
  unknown: ['未知', 'Unknown'],
  nativeDatabaseComments: ['**数据库原生注释**', '**Native database comments**'],
  deviceLocalMarkdownNotes: ['**设备本地 Markdown 笔记**', '**Device-local Markdown notes**'],
  databaseCollectedAt: [
    '数据库：{p0} · {p1}\n\n采集于：{p2}',
    'Database: {p0} · {p1}\n\nCollected at: {p2}',
  ],
  metadataWarnings: ['## 元数据告警', '## Metadata warnings'],
  group: ['## 分组：{p0}', '## Group: {p0}'],
  color: ['颜色：{p0}', 'Color: {p0}'],
  nativeType: ['原生类型：{p0}', 'Native type: {p0}'],
  columns: ['### 字段', '### Columns'],
  columnNativeTypeNullablePrimaryKeyDefaultDatabase: [
    '| 字段 | 原生类型 | 可空 | 主键 | 默认值 | 数据库注释 | 本地笔记 |\n| --- | --- | --- | --- | --- | --- | --- |\n',
    '| Column | Native type | Nullable | Primary key | Default | Database comment | Local note |\n| --- | --- | --- | --- | --- | --- | --- |\n',
  ],
  yes: ['是', 'Yes'],
  no: ['否', 'No'],
  bidirectionalForeignKeyRelationships: [
    '### 双向外键关系',
    '### Bidirectional foreign key relationships',
  ],
  targetUnconfirmed: ['；目标未确认', '; target unconfirmed'],
  noRelatedForeignKeysRecordedInTheNative: [
    '原生目录未记录相关外键。',
    'No related foreign keys recorded in the native catalog.',
  ],
  index: ['### 索引 {p0}', '### Index {p0}'],
  methodUniquePrimaryKey: [
    '方法：{p0}；唯一：{p1}；主键：{p2}',
    'Method: {p0}; unique: {p1}; primary key: {p2}',
  ],
  constraint: ['### 约束 {p0}', '### Constraint {p0}'],
  trigger: ['### 触发器 {p0}', '### Trigger {p0}'],
  originalStructureDefinition: ['### 原始结构定义', '### Original structure definition'],
  source: ['来源：{p0}', 'Source: {p0}'],
  nativeProperties: ['### 原生属性', '### Native properties'],
  noteTargetsNotFoundInThisSnapshot: [
    '## 未在本次快照中找到的笔记目标',
    '## Note targets not found in this snapshot',
  ],
  notePreservedDeletionIsNotInferred: [
    '- {p0}（笔记保留；不推断是否已删除）',
    '- {p0} (note preserved; deletion is not inferred)',
  ],
});
