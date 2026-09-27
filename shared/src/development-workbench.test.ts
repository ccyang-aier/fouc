import { expect, test } from 'bun:test';
import { createDevelopmentWorkspaces } from './development-workbench';

test('development workspaces exercise independent bases, diverse content and empty states', () => {
  const spaces = createDevelopmentWorkspaces();
  expect(spaces).toHaveLength(3);
  expect(spaces.map((space) => space.bases.length)).toEqual([4, 3, 5]);
  const ids = new Set<string>();
  const extensions = new Set<string>();
  let documents = 0;
  for (const space of spaces) {
    expect(ids.has(space.id)).toBe(false); ids.add(space.id);
    expect(space.bases.some((base) => base.documents.length === 0)).toBe(true);
    for (const base of space.bases) {
      expect(ids.has(base.id)).toBe(false); ids.add(base.id);
      expect(base.workspaceId).toBe(space.id);
      for (const folder of base.folders) {
        expect(ids.has(folder.id)).toBe(false); ids.add(folder.id);
        expect(folder.knowledgeBaseId).toBe(base.id);
        expect(folder.workspaceId).toBe(space.id);
      }
      for (const document of base.documents) {
        expect(ids.has(document.id)).toBe(false); ids.add(document.id);
        expect(document.baseId).toBe(base.id);
        expect(document.workspaceId).toBe(space.id);
        expect(base.folders.some((folder) => folder.id === document.folderId)).toBe(true);
        extensions.add(document.title.split('.').at(-1)!); documents++;
      }
    }
  }
  expect(documents).toBe(145);
  expect(extensions.size).toBeGreaterThanOrEqual(10);
});
