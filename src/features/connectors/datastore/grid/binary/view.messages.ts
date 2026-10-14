import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  thisValueIsNotNativeBinaryData: ['该值不是原生二进制', 'This value is not native binary data'],
  noMatchingBytesInTheCurrentPreviewRange: [
    '当前预览范围没有匹配字节',
    'No matching bytes in the current preview range',
  ],
  matchAtOffsetXSearchAgainForTheNextMatch: [
    '匹配偏移 0x{p0}；再次搜索查看下一处',
    'Match at offset 0x{p0}; search again for the next match',
  ],
  handedOriginalBytesToTheBrowserForSaving: [
    '已交给浏览器保存原始 {p0} 字节',
    'Handed {p0} original bytes to the browser for saving',
  ],
  rawBinaryByteViewer: ['二进制原始字节查看器', 'Raw binary byte viewer'],
  binaryViewMode: ['二进制查看方式', 'Binary view mode'],
  image: ['图像', 'Image'],
  originalValue: ['原值', 'Original value'],
  invalidBytes: ['无效字节', 'Invalid bytes'],
  theOriginalValueIsUnchanged: ['；原始值保持不变。', '; the original value is unchanged.'],
  previewSearchOnlyTheFirst: ['预览 / 搜索仅前', 'Preview / Search only the first '],
  fullSize: ['，完整', '; full size '],
  searchBinaryHexadecimalBytes: ['搜索二进制十六进制字节', 'Search binary hexadecimal bytes'],
  searchBytesEGFf: ['搜索字节，如 00 FF 41', 'Search bytes, e.g. 00 FF 41'],
  lookup: ['查找', 'Lookup'],
  hexadecimalAndAsciiView: ['十六进制与 ASCII 对照', 'Hexadecimal and ASCII view'],
  emptyBinaryValueBytes: ['空二进制值，0 字节', 'Empty binary value, 0 bytes'],
  previousBytePage: ['上一页字节', 'Previous byte page'],
  pagesUpTo: ['页 · 每页最多', ' pages · Up to '],
  nextBytePage: ['下一页字节', 'Next byte page'],
  copyTheCurrentBytePageOnly: ['仅复制当前字节页', 'Copy the current byte page only'],
  hexForTheCurrentPreviewPage: ['当前预览页 HEX', 'HEX for the current preview page'],
  thisRangeIsNotValidUtfUseHexToInspect: [
    '该范围不是有效 UTF-8，使用 HEX 查看原始字节。',
    'This range is not valid UTF-8. Use HEX to inspect the original bytes.',
  ],
  binaryUtfPreview: ['二进制 UTF-8 预览', 'Binary UTF-8 preview'],
  originalCellValue: ['单元格原始值', 'Original cell value'],
  theOriginalFileExceedsMibUseFullTableExport: [
    '原值文件超过 16 MiB，使用全表导出',
    'The original file exceeds 16 MiB. Use full-table export',
  ],
  saveAllOriginalBytes: ['保存完整原始字节', 'Save all original bytes'],
  saveFile: ['保存文件', 'Save file'],
  nativeBinaryImagePreview: ['原生二进制图像预览', 'Native binary image preview'],
  imagePreviewsAreLimitedToMibUseTheOriginalValue: [
    '图像预览最多 16 MiB，使用原值或全表导出。',
    'Image previews are limited to 16 MiB. Use the original value or full-table export.',
  ],
  decodingTheOriginalImage: ['正在解码原始图像…', 'Decoding the original image…'],
  nativeBinaryImage: ['{p0} × {p1} 原生二进制图像', '{p0} × {p1} native binary image'],
  theImageCannotBeDecodedOriginalBytesRemainAvailableTo: [
    '图像数据无法解码，原始字节仍可查看与保存',
    'The image cannot be decoded. Original bytes remain available to inspect and save',
  ],
  imageDimensionsDoNotMatchTheOriginalHeaderDisplayWas: [
    '图像尺寸与原始头部不一致，已停止显示',
    'Image dimensions do not match the original header; display was stopped',
  ],
});
