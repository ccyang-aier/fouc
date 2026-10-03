import { test, expect } from 'bun:test';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RelationalSessionManager } from './relational-session';
import { DatabaseCapabilityRegistry } from './capability-registry';

test('real SQLite import plans enforce workspace, lock revocation, metadata and one-use append', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fouc-import-plan-')), file = join(directory, 'fixture.sqlite');
  const db = new DatabaseSync(file); db.exec('CREATE TABLE imported(id INTEGER PRIMARY KEY, name TEXT NOT NULL)'); db.close();
  const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry()), workspace = 'import-p0';
  const input = { schema: 'main', table: 'imported', text: 'id,name\n42,exact', options: { format: 'csv' as const }, mappings: ['id', 'name'].map((name) => ({ sourceColumn: name, targetColumn: name })) };
  try {
    const session = await manager.connect(workspace, { provider: 'sqlite', path: file }), id = session.id;
    expect(() => manager.prepareImport(workspace, id, input)).toThrow('只读');
    manager.setWriteAccess(workspace, id, true);
    const revoked = await manager.prepareImport(workspace, id, input);
    manager.setWriteAccess(workspace, id, false); manager.setWriteAccess(workspace, id, true);
    await expect(manager.commitImport(workspace, id, revoked.planId)).rejects.toThrow('失效');
    const changed = await manager.prepareImport(workspace, id, input);
    const writer = new DatabaseSync(file); writer.exec('ALTER TABLE imported ADD COLUMN note TEXT'); writer.close();
    await expect(manager.commitImport(workspace, id, changed.planId)).rejects.toThrow('表结构已变化');
    const plan = await manager.prepareImport(workspace, id, input);
    await expect(manager.commitImport('other-workspace', id, plan.planId)).rejects.toThrow('断开');
    expect((await manager.query(workspace, id, 'SELECT COUNT(*) FROM imported', 'main')).rows).toEqual([[0]]);
    expect((await manager.commitImport(workspace, id, plan.planId)).rowsImported).toBe(1);
    await expect(manager.commitImport(workspace, id, plan.planId)).rejects.toThrow('失效');
    expect((await manager.query(workspace, id, 'SELECT id,name FROM imported', 'main')).rows).toEqual([[42, 'exact']]);
  } finally {
    await manager.shutdown(); Bun.gc(true);
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name)); rmdirSync(directory);
  }
});
