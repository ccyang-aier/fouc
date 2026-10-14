import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  sqlFileExceedsTheLimit: [
    'SQL 文件 {p0} 超过 {p1} 上限。',
    'SQL file {p0} exceeds the {p1} limit.',
  ],
  theFileCannotBeDecodedAsSelectItsOriginalEncoding: [
    '文件无法按 {p0} 解码。请选择原始文件编码后重试。',
    'The file cannot be decoded as {p0}. Select its original encoding and retry.',
  ],
  theFileContainsNulBytesCheckItsEncodingOrChoose: [
    '文件包含 NUL 字节，请核对编码或选择文本 SQL 文件。',
    'The file contains NUL bytes. Check its encoding or choose a text SQL file.',
  ],
  chooseASqlFile: ['请选择 .sql 文件：{p0}', 'Choose a .sql file: {p0}'],
  sqlFileReadCancelled: ['SQL 文件读取已取消', 'SQL file read cancelled'],
  sqlFileReadFailed: ['SQL 文件读取失败', 'SQL file read failed'],
});
