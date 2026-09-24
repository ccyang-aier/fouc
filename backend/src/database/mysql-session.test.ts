import { describe, expect, test } from 'bun:test';
import { DatabaseCapabilityRegistry } from './capability-registry';
import { MysqlSessionManager } from './mysql-session';

const input = { host: '127.0.0.1', port: 3306, username: 'reader', password: 'secret', readOnly: true };

describe('MySQL live session', () => {
  test('publishes metadata only after a real protocol probe and revokes on disconnect', async () => {
    const queries: string[] = [];
    let closed = false;
    const capabilities = new DatabaseCapabilityRegistry();
    const manager = new MysqlSessionManager(capabilities, () => ({
      async query(sql) {
        queries.push(sql);
        if (sql === 'SHOW DATABASES') return [{ Database: 'orders' }];
        if (sql.includes('information_schema.TABLES')) return [{ TABLE_NAME: 'customers', TABLE_TYPE: 'BASE TABLE', TABLE_COMMENT: '客户' }];
        return [{ fouc_probe: 1 }];
      },
      async end() { closed = true; },
    }));

    const snapshot = await manager.connect(input);
    expect(snapshot.capabilities.metadataBrowse).toBe(true);
    expect(snapshot.capabilities.queryExecution).toBe(false);
    expect(snapshot.restrictions.readOnly).toBe(true);
    expect((await manager.databases(snapshot.connectionId))?.[0]?.name).toBe('orders');
    expect((await manager.tables(snapshot.connectionId, 'orders'))?.[0]).toMatchObject({ name: 'customers', comment: '客户', kind: 'table' });
    expect(queries).toContain('SHOW DATABASES');
    expect(await manager.disconnect(snapshot.connectionId)).toBe(true);
    expect(closed).toBe(true);
    expect(capabilities.get(snapshot.connectionId)).toBeNull();
  });

  test('falls back to information_schema and SHOW FULL TABLES on restricted servers', async () => {
    const manager = new MysqlSessionManager(new DatabaseCapabilityRegistry(), () => ({
      async query(sql) {
        if (sql === 'SHOW DATABASES' || sql.includes('information_schema.TABLES')) throw new Error('access denied');
        if (sql.includes('information_schema.SCHEMATA')) return [{ SCHEMA_NAME: 'orders' }];
        if (sql.startsWith('SHOW FULL TABLES')) return [{ Tables_in_orders: 'customers', Table_type: 'VIEW' }];
        return [{ fouc_probe: 1 }];
      },
      async end() {},
    }));
    const snapshot = await manager.connect(input);
    expect((await manager.tables(snapshot.connectionId, 'orders'))?.[0]).toMatchObject({ kind: 'view', name: 'customers' });
    await manager.shutdown();
  });

  test('failed probe closes the pool without granting a capability', async () => {
    let closed = false;
    const capabilities = new DatabaseCapabilityRegistry();
    const manager = new MysqlSessionManager(capabilities, () => ({
      async query() { throw new Error('access denied'); },
      async end() { closed = true; },
    }));
    await expect(manager.connect(input)).rejects.toThrow('access denied');
    expect(closed).toBe(true);
  });
});
