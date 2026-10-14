export interface BinaryImage {
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/bmp';
  extension: string;
  width: number;
  height: number;
}
const MAX_IMAGE_PIXELS = 24_000_000;

function image(
  mimeType: BinaryImage['mimeType'],
  extension: string,
  width: number,
  height: number,
): BinaryImage | null {
  return Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width * height <= MAX_IMAGE_PIXELS
    ? { mimeType, extension, width, height }
    : null;
}
function text(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Only bounded raster headers are admitted; SVG/HTML never become active previews. */
export function identifyBinaryImage(bytes: Uint8Array): BinaryImage | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    text(bytes, 1, 7) === 'PNG\r\n\x1a\n' &&
    text(bytes, 12, 4) === 'IHDR'
  )
    return image('image/png', 'png', view.getUint32(16), view.getUint32(20));
  if (bytes.length >= 10 && ['GIF87a', 'GIF89a'].includes(text(bytes, 0, 6)))
    return image('image/gif', 'gif', view.getUint16(6, true), view.getUint16(8, true));
  if (bytes.length >= 26 && text(bytes, 0, 2) === 'BM') {
    const headerSize = view.getUint32(14, true);
    if (headerSize === 12)
      return image('image/bmp', 'bmp', view.getUint16(18, true), view.getUint16(20, true));
    if (headerSize >= 40)
      return image('image/bmp', 'bmp', view.getInt32(18, true), Math.abs(view.getInt32(22, true)));
  }
  if (bytes.length >= 30 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 4) === 'WEBP') {
    const kind = text(bytes, 12, 4);
    if (kind === 'VP8X') {
      const width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536;
      const height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536;
      return image('image/webp', 'webp', width, height);
    }
    if (kind === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42)
      return image(
        'image/webp',
        'webp',
        view.getUint16(26, true) & 0x3fff,
        view.getUint16(28, true) & 0x3fff,
      );
    if (kind === 'VP8L' && bytes[20] === 47) {
      const width = 1 + bytes[21] + (bytes[22] & 63) * 256;
      const height = 1 + (bytes[22] >> 6) + bytes[23] * 4 + (bytes[24] & 15) * 1024;
      return image('image/webp', 'webp', width, height);
    }
  }
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length && offset < 256 * 1024) {
    if (bytes[offset++] !== 255) return null;
    while (offset < bytes.length && bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217 || marker === 218) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (length < 8) return null;
      return image('image/jpeg', 'jpg', view.getUint16(offset + 5), view.getUint16(offset + 3));
    }
    offset += length;
  }
  return null;
}
