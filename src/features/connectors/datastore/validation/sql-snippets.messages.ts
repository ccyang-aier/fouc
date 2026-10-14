import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  atMostSqlSnippetsAreAllowed: [
    'SQL 代码片段最多 {p0} 个',
    'At most {p0} SQL snippets are allowed',
  ],
  invalidSqlSnippetFormat: ['SQL 代码片段格式无效', 'Invalid SQL snippet format'],
  sqlSnippetsRequireACompleteIdNamePrefix: [
    'SQL 代码片段须包含完整的 ID、名称、前缀、SQL 和启用状态',
    'SQL snippets require a complete ID, name, prefix, SQL, and enabled status',
  ],
  invalidSqlSnippetId: ['SQL 代码片段 ID 无效', 'Invalid SQL snippet ID'],
  sqlSnippetNamesMustContainCharacters: [
    'SQL 代码片段名称需为 1 至 200 个字符',
    'SQL snippet names must contain 1–200 characters',
  ],
  sqlSnippetPrefixesMustContainLettersDigitsUnderscores: [
    'SQL 代码片段前缀需为 1 至 64 个字母、数字、下划线、美元符号或连字符',
    'SQL snippet prefixes must contain 1–64 letters, digits, underscores, dollar signs, or hyphens',
  ],
  sqlSnippetContentMustNotBeEmptyAnd: [
    'SQL 代码片段内容不能为空，且最多 64 KiB',
    'SQL snippet content must not be empty and must not exceed 64 KiB',
  ],
  sqlSnippetsMustBeValidUtf: ['SQL 代码片段须为有效 UTF-8', 'SQL snippets must be valid UTF-8'],
  invalidSqlSnippetEnabledStatus: [
    'SQL 代码片段启用状态无效',
    'Invalid SQL snippet enabled status',
  ],
  sqlSnippetIdsMustBeUnique: ['SQL 代码片段 ID 不能重复', 'SQL snippet IDs must be unique'],
  sqlSnippetPrefixesMustBeUnique: [
    'SQL 代码片段前缀不能重复',
    'SQL snippet prefixes must be unique',
  ],
});
