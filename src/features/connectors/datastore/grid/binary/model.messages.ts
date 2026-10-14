import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  nativeBinaryDataIsMissingBaseContent: [
    '原生二进制缺少 Base64 内容',
    'Native binary data is missing Base64 content',
  ],
  nativeBinaryDataContainsInvalidBase: [
    '原生二进制的 Base64 格式无效',
    'Native binary data contains invalid Base64',
  ],
  invalidNativeBinaryLength: ['原生二进制长度无效', 'Invalid native binary length'],
  invalidBasePaddingBits: ['原生 Base64 的填充位无效', 'Invalid Base64 padding bits'],
  invalidBinaryPreviewRange: ['二进制预览范围无效', 'Invalid binary preview range'],
  rawCellFileDownloadsAreLimitedToMibUseFull: [
    '单元格原始文件下载最多 16 MiB，请使用全表导出',
    'Raw cell file downloads are limited to 16 MiB. Use full-table export',
  ],
  invalidHexadecimalViewRange: ['十六进制查看范围无效', 'Invalid hexadecimal view range'],
  enterHexadecimalBytesOptionallySeparatedBySpaces: [
    '输入 1–128 个字节的十六进制，可使用空格分隔',
    'Enter 1–128 hexadecimal bytes, optionally separated by spaces',
  ],
  invalidBinarySearchRange: ['二进制搜索范围无效', 'Invalid binary search range'],
});
