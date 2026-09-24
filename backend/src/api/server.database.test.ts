import { describe, expect, test } from 'bun:test';
import { DATABASE_CAPABILITIES, type DatabaseCapabilities } from '@fouc/shared';
import { DatabaseCapabilityRegistry } from '../database/capability-registry';
import { MysqlSessionManager } from '../database/mysql-session';
import { createApp } from './server';

const caps = Object.fromEntries(DATABASE_CAPABILITIES.map((key) => [key, key === 'metadataBrowse'])) as DatabaseCapabilities;

function testApp(registry: DatabaseCapabilityRegistry, mysqlSessions?: MysqlSessionManager) {
  return createApp({
    registry: {} as never,
    supervisor: {} as never,
    connectors: {} as never,
    databaseCapabilities: registry,
    mysqlSessions,
    token: 'frontend-token',
    internalToken: 'native-only-token',
  }).app;
}

describe('database capability API', () => {
  test('serves the validated catalog behind the same authentication boundary', async () => {
    const app = testApp(new DatabaseCapabilityRegistry());
    expect((await app.request('/api/database/catalog')).status).toBe(401);
    const headers = { authorization: 'Bearer frontend-token' };
    const response = await app.request('/api/database/catalog', { headers });
    expect(response.status).toBe(200);
    const catalog = (await response.json() as { data: { declarationOnly: boolean; drivers: unknown[]; profiles: unknown[] } }).data;
    expect(catalog.declarationOnly).toBe(true);
    expect(catalog.drivers).toHaveLength(81);
    expect(catalog.profiles).toHaveLength(104);
    expect((await app.request('/api/database/catalog/dialects/MySQL', { headers })).status).toBe(200);
    expect((await app.request('/api/database/catalog/dialects/unknown', { headers })).status).toBe(404);
  });

  test('requires authentication and a server-confirmed connection', async () => {
    const registry = new DatabaseCapabilityRegistry();
    const app = testApp(registry);
    expect((await app.request('/api/database/connections/mysql-1/capabilities')).status).toBe(401);
    const headers = { authorization: 'Bearer frontend-token' };
    expect((await app.request('/api/database/connections/mysql-1/capabilities', { headers })).status).toBe(404);

    registry.begin('mysql-1', 'session-1');
    registry.confirm('mysql-1', 'session-1', caps, caps, { readOnly: true, production: false });
    const response = await app.request('/api/database/connections/mysql-1/capabilities', { headers });
    expect(response.status).toBe(200);
    expect((await response.json() as { data: { capabilities: DatabaseCapabilities } }).data.capabilities.metadataBrowse).toBe(true);
  });

  test('connects, browses and disconnects through authenticated routes', async () => {
    const registry = new DatabaseCapabilityRegistry();
    const sessions = new MysqlSessionManager(registry, () => ({
      async query(sql) {
        if (sql === 'SHOW DATABASES') return [{ Database: 'orders' }];
        if (sql.includes('information_schema.TABLES')) return [{ TABLE_NAME: 'customers', TABLE_TYPE: 'BASE TABLE' }];
        if (sql.includes('information_schema.COLUMNS')) return [{ COLUMN_NAME: 'id', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI' }];
        if (sql.startsWith('SELECT *')) return [{ id: 1001 }];
        return [{ fouc_probe: 1 }];
      },
      async end() {},
    }));
    const app = testApp(registry, sessions);
    const headers = { authorization: 'Bearer frontend-token', 'content-type': 'application/json' };
    const created = await app.request('/api/database/mysql/sessions', {
      method: 'POST', headers,
      body: JSON.stringify({ host: '127.0.0.1', port: 3306, username: 'reader', password: 'secret' }),
    });
    expect(created.status).toBe(201);
    const id = (await created.json() as { data: { connectionId: string } }).data.connectionId;
    expect((await app.request(`/api/database/connections/${id}/capabilities`, { headers })).status).toBe(200);
    const databases = await app.request(`/api/database/mysql/sessions/${id}/databases`, { headers });
    expect((await databases.json() as { data: Array<{ name: string }> }).data[0]?.name).toBe('orders');
    const tables = await app.request(`/api/database/mysql/sessions/${id}/databases/orders/tables`, { headers });
    expect((await tables.json() as { data: Array<{ name: string }> }).data[0]?.name).toBe('customers');
    const rows = await app.request(`/api/database/mysql/sessions/${id}/databases/orders/tables/customers/rows?limit=1`, { headers });
    expect((await rows.json() as { data: { rows: number[][] } }).data.rows).toEqual([[1001]]);
    expect((await app.request(`/api/database/mysql/sessions/${id}/databases/orders/tables/customers/rows?limit=501`, { headers })).status).toBe(400);
    expect((await app.request(`/api/database/mysql/sessions/${id}`, { method: 'DELETE', headers })).status).toBe(200);
    expect((await app.request(`/api/database/connections/${id}/capabilities`, { headers })).status).toBe(404);
  });
});
