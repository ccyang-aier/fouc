import { expect, test } from 'bun:test';
import { openDatabase } from '../storage/db';
import { KnowledgeRepository } from './repository';

test('knowledge sidebar data and actions persist across repository instances', () => {
  const db = openDatabase(':memory:');
  const library = new KnowledgeRepository(db);
  const project = library.createProject('定位', 'folder');
  const child = library.createProject('子项目', 'folder', project.id);
  const tag = library.createTag('13', '#ada34e');
  const document = library.createDocument(child.id, tag.id);
  library.updateDocument(document.id, { title: 'Untitled', content: '正文' });
  library.starDocument(document.id, true);

  const reopened = new KnowledgeRepository(db);
  expect(reopened.snapshot().projects.find((item) => item.id === child.id)?.parentId).toBe(project.id);
  expect(reopened.snapshot().documentTags[document.id]).toEqual([tag.id]);
  expect(reopened.snapshot().documents.find((item) => item.id === document.id)?.starred).toBe(true);
  expect(reopened.versions(document.id)).toHaveLength(1);

  reopened.trashDocument(document.id, true);
  expect(reopened.snapshot().documents.find((item) => item.id === document.id)?.trashedAt).toBeNumber();
  reopened.trashDocument(document.id, false);
  reopened.deleteProject(project.id);
  expect(reopened.snapshot().documents.find((item) => item.id === document.id)?.projectId).toBe(child.id);
  expect(reopened.snapshot().projects.find((item) => item.id === child.id)?.parentId).toBeNull();
  db.close();
});
