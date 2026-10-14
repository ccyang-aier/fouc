import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  importFilesMustNotExceedMib: ['导入文件最多 5 MiB。', 'Import files must not exceed 5 MiB.'],
  theFileContainsBytesThatCannotBeDecoded: [
    '文件含所选编码无法解码的字节。请选择正确的 UTF-8、GBK 或 UTF-16 编码。',
    'The file contains bytes that cannot be decoded with the selected encoding. Choose the correct UTF-8, GBK, or UTF-16 encoding.',
  ],
});
