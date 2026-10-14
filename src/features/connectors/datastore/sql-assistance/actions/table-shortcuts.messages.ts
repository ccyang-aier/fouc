import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  enterATableNameSchemaTableIsSupported: [
    '请输入表名，支持 schema.table。',
    'Enter a table name. schema.table is supported.',
  ],
  theTableNameMustBeASingleOrQualifiedIdentifier: [
    '表名应为单个或带限定符的标识符，包含空格的名称请加引号。',
    'The table name must be a single or qualified identifier. Quote names containing spaces.',
  ],
  theTableNameContainsSqlKeywordsUseIdentifierQuotes: [
    '表名包含 SQL 关键字，请使用标识符引号。',
    'The table name contains SQL keywords. Use identifier quotes.',
  ],
});
