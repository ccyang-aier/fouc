import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from '../validation-issue';
import { TABLE_IMPORT_LIMITS, type TableImportEncoding } from './types';
// Bun's ambient Encoding union is narrower than the implemented WHATWG decoder.
// Keep this pure module portable by describing the standard constructor subset we use.
type StandardDecoder = new (
  label?: ValidationValue,
  options?: {
    fatal?: boolean;
    ignoreBOM?: boolean;
  },
) => {
  decode(
    input?: ArrayBuffer | ArrayBufferView,
    options?: {
      stream?: boolean;
    },
  ): string;
};
const StandardTextDecoder = globalThis.TextDecoder as unknown as StandardDecoder;
/** DBX BOM selection and UTF-8/GBK detection using the host's standard, strict decoder. */
export function decodeTableImportBytes(
  bytes: Uint8Array,
  encoding: TableImportEncoding = 'auto',
): {
  text: string;
  encoding: Exclude<TableImportEncoding, 'auto'>;
} {
  if (bytes.byteLength > TABLE_IMPORT_LIMITS.bytes)
    throw new ValidationError(
      validationIssue('table-import-encoding.importFilesMustNotExceedMib', '导入文件最多 5 MiB。'),
    );
  const labels = {
    utf8: 'utf-8',
    utf16Le: 'utf-16le',
    utf16Be: 'utf-16be',
    gbk: 'gb18030',
  } as const;
  const bom: Exclude<TableImportEncoding, 'auto'> | undefined =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf16Le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf16Be'
        : bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
          ? 'utf8'
          : undefined;
  const candidates: Array<Exclude<TableImportEncoding, 'auto'>> =
    encoding === 'auto' ? (bom ? [bom] : ['utf8', 'gbk']) : [encoding];
  for (const candidate of candidates) {
    try {
      return {
        text: new StandardTextDecoder(labels[candidate], { fatal: true }).decode(bytes),
        encoding: candidate,
      };
    } catch {
      /* Try only the other explicitly supported auto-detection candidate. */
    }
  }
  throw new ValidationError(
    validationIssue(
      'table-import-encoding.theFileContainsBytesThatCannotBeDecoded',
      '文件含所选编码无法解码的字节。请选择正确的 UTF-8、GBK 或 UTF-16 编码。',
    ),
  );
}
