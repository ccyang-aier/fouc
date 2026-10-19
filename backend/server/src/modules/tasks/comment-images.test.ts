import { expect, test } from 'bun:test';
import { prepareCommentImages } from './comment-images';

test('image signatures determine supported PNG, JPEG, GIF and WebP metadata', async () => {
  const formats = [
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['image/gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    ['image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  ] as const;
  const images = await prepareCommentImages(formats.map(([mime, bytes], index) => new File([new Uint8Array(bytes)], `picture-${index}`, { type: mime })));
  expect(images.map(image => image.metadata.mime)).toEqual(formats.map(([mime]) => mime));
  expect(new Set(images.map(image => image.metadata.id)).size).toBe(4);
  const unnamedMime = await prepareCommentImages([new File([new Uint8Array(formats[0][1])], '../review.png')]);
  expect(unnamedMime[0]!.metadata).toMatchObject({ mime: 'image/png', name: 'review.png' });
});
