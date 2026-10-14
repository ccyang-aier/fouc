import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqlIsTooLargeToFormatMaximumMbOfCharacters: [
    'SQL 太大，无法格式化（最多 1 MB 字符）。',
    'SQL is too large to format (maximum 1 MB of characters).',
  ],
  useStructuredTextFormattingForXml: [
    '请使用结构化文本格式化处理 XML。',
    'Use structured text formatting for XML.',
  ],
  theFormatterCannotPreserveQuotedContentCompletelyKeepTheOriginal: [
    '格式化器无法完整保留引用内容，请保留原始 SQL。',
    'The formatter cannot preserve quoted content completely. Keep the original SQL.',
  ],
  sqlIsTooLargeToMinifyMaximumMbOfCharacters: [
    'SQL 太大，无法压缩（最多 1 MB 字符）。',
    'SQL is too large to minify (maximum 1 MB of characters).',
  ],
});
