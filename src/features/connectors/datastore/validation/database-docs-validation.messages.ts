import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  databaseDocumentationParametersMustBeAnObject: [
    '数据库文档参数必须是对象',
    'Database documentation parameters must be an object',
  ],
  databaseDocumentationParametersContainUnknownFields: [
    '数据库文档参数包含未知字段',
    'Database documentation parameters contain unknown fields',
  ],
  name: ['名称', 'name'],
  invalid: ['{p0}无效', 'Invalid {p0}'],
  markdownNotesMustNotExceedKibOrContain: [
    'Markdown 笔记最多 64 KiB，且不可包含 NUL',
    'Markdown notes must not exceed 64 KiB or contain NUL',
  ],
  invalidDatabaseDocumentationNoteFormat: [
    '数据库文档笔记格式无效',
    'Invalid database documentation note format',
  ],
  databaseDocumentationGroupTableNoteCountExceedsThe: [
    '数据库文档分组 / 表笔记数量超限',
    'Database documentation group / table note count exceeds the limit',
  ],
  groupId: ['分组 ID', 'group ID'],
  invalidOrDuplicateGroupId: ['分组 ID 无效或重复', 'Invalid or duplicate group ID'],
  groupHueMustBe: ['分组色相必须在 0–359', 'Group hue must be 0–359'],
  groupName: ['分组名称', 'group name'],
  table: ['表', 'table'],
  duplicateTableNoteTarget: ['表笔记目标重复', 'Duplicate table note target'],
  theTableReferencesAGroupThatDoesNot: [
    '表引用的分组不存在',
    'The table references a group that does not exist',
  ],
  invalidColumnNotes: ['字段笔记无效', 'Invalid column notes'],
  column: ['字段', 'column'],
  columnNotesSupportAtMostEntries: [
    '字段笔记最多 10000 条',
    'Column notes support at most 10,000 entries',
  ],
  documentTitle: ['文档标题', 'document title'],
  localDocumentationNotesMustNotExceedMib: [
    '本地文档笔记最多 2 MiB',
    'Local documentation notes must not exceed 2 MiB',
  ],
  noteVersion: ['笔记版本', 'note version'],
  chooseSchemas: ['请选择 1–64 个 Schema', 'Choose 1–64 schemas'],
  selectedTableCountExceedsTheLimit: ['选择的表数量超限', 'Selected table count exceeds the limit'],
  theTableIsOutsideTheSelectedSchemaScope: [
    '表不在选择的 Schema 范围内',
    'The table is outside the selected schema scope',
  ],
});
