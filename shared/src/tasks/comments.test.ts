import { expect, test } from 'bun:test';
import { createTaskCommentInputSchema, taskCommentImageSchema, TASK_COMMENT_IMAGE_MAX_BYTES } from './index';

test('comment bodies allow image-only input while rejecting injected attachment metadata', () => {
  expect(createTaskCommentInputSchema.parse({ body: '  Review 🥳  ' })).toEqual({ body: 'Review 🥳' });
  expect(createTaskCommentInputSchema.parse({})).toEqual({ body: '' });
  expect(createTaskCommentInputSchema.safeParse({ body: 'a'.repeat(4_001) }).success).toBe(false);
  expect(createTaskCommentInputSchema.safeParse({ body: '', images: [] }).success).toBe(false);
});

test('image metadata admits only owned UUID image identities and bounded supported formats', () => {
  const image = { id: crypto.randomUUID(), name: 'review.png', mime: 'image/png' as const, size: 12 };
  expect(taskCommentImageSchema.parse(image)).toEqual(image);
  for (const changed of [{ mime: 'image/svg+xml' }, { size: 0 }, { size: TASK_COMMENT_IMAGE_MAX_BYTES + 1 }, { id: '../image' }, { url: 'https://example.com/fake' }]) {
    expect(taskCommentImageSchema.safeParse({ ...image, ...changed }).success).toBe(false);
  }
});
