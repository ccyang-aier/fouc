import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import type { RelationalSession } from '@fouc/shared';
import { DATABASE_ADMIN_OBJECT_LIMITS as limits } from '@fouc/shared/database-admin-objects';
import type { RelationalDriver } from '../drivers/relational-driver';
import { adminObjectListInput, adminObjectDetailsInput, adminObjectSearch } from './input';
import { boundedRows, sourceText, type AdminObjectAdapter } from './common';
import { describeMySqlEvent, listMySqlEvents } from './mysql-events';
import { describePostgresExtension } from './postgres-extensions';
import { DatabaseAdminObjectService, type DatabaseAdminObjectEntry } from './service';
import { databaseAdminObjectRoutes } from '../../api/database-admin-object-routes';

test('readonly request contract rejects provider mismatches, SQL, invalid paging and preserves literal search semantics', () => {
  expect(() => adminObjectListInput('mysql', { kind: 'extension' })).toThrow();
  expect(() => adminObjectListInput('sqlite', { kind: 'event', schema: 'main' })).toThrow();
  expect(() => adminObjectListInput('postgres', { kind: 'extension', sql: 'CREATE EXTENSION x' })).toThrow();
  expect(() => adminObjectListInput('mysql', { kind: 'event', schema: 'lab', offset: -1 })).toThrow();
  expect(() => adminObjectListInput('mysql', { kind: 'event', schema: 'lab', limit: 201 })).toThrow();
  expect(() => adminObjectDetailsInput('postgres', { kind: 'extension', name: 'x\0y' })).toThrow();
  expect(adminObjectSearch('50%_x=')).toBe('%50=%=_x==%');
  expect(adminObjectDetailsInput('mysql', { kind: 'event', schema: 'lab', name: 'quoted`event' }).name).toBe('quoted`event');
});

test('event reads preserve time-zone/schedule/exact body and select Create Event instead of SHOW source time_zone', async () => {
  const queries: string[] = [];
  let hideSource = false;
  const adapter: AdminObjectAdapter = {
    provider: 'mysql', database: 'lab', query: async (sql, values) => {
      queries.push(sql);
      if (sql.startsWith('SHOW CREATE')) {
        if (hideSource) throw new Error('EVENT privilege denied');
        return [{ Event: 'quoted`event', sql_mode: '', time_zone: '+08:00', 'Create Event': 'CREATE EVENT `quoted``event` DO SELECT 9007199254740993' }];
      }
      if (sql.includes('@@GLOBAL.event_scheduler')) return [{ status: 'OFF', session_time_zone: 'SYSTEM', system_time_zone: 'UTC' }];
      if (sql.includes('LEFT(EVENT_DEFINITION')) return [{ schema_name: 'lab', name: 'quoted`event', definer: null, time_zone: '+08:00', event_type: 'RECURRING', starts: '2099-01-01 00:00:00', interval_value: '1', interval_unit: 'DAY', status: 'DISABLED', body: 'SELECT 9007199254740993', body_truncated: 0 }];
      expect(values).toEqual(['lab', '%quoted=_%', '%quoted=_%']);
      return [{ schema_name: 'lab', name: 'first', event_type: 'RECURRING', interval_value: '1', interval_unit: 'DAY' }, { schema_name: 'lab', name: 'second' }];
    },
  };
  const listing = await listMySqlEvents(adapter, { schema: 'lab', search: 'quoted_', offset: 0, limit: 1 });
  expect(listing.items.length).toBe(1); expect(listing.hasMore).toBe(true); expect(listing.coverage).toBe('permission-filtered');
  const event = await describeMySqlEvent(adapter, 'lab', 'quoted`event');
  expect(event.timeZone).toBe('+08:00'); expect(event.starts).toBe('2099-01-01 00:00:00');
  expect(event.body.text).toBe('SELECT 9007199254740993'); expect(event.source.text).toStartWith('CREATE EVENT');
  expect(event.source.text).not.toBe('+08:00'); expect(event.scheduler.status).toBe('OFF'); expect(event.definer).toBeNull();
  expect(queries.some(sql => sql === 'SHOW CREATE EVENT `lab`.`quoted``event`')).toBe(true);
  hideSource = true;
  const hidden = await describeMySqlEvent(adapter, 'lab', 'quoted`event');
  expect(hidden.source.origin).toBe('unknown'); expect(hidden.source.complete).toBe(false); expect(hidden.source.warning).toContain('privilege denied');
  expect(hidden.body.text).toBe('SELECT 9007199254740993');
});

test('extension versions probe actual columns, preserve unknown trust, target extension OID and bound installed membership', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const adapter: AdminObjectAdapter = {
    provider: 'postgres', database: 'lab', query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('FULL JOIN pg_catalog.pg_available_extensions')) return [{ name: 'quoted"extension', oid: '12345', installed_version: "1.0'\\", schema_name: 'shared', owner: 'owner', relocatable: true, default_version: '2.0' }];
      if (sql.includes('pg_catalog.pg_attribute')) return ['name', 'version', 'installed', 'superuser', 'relocatable', 'schema', 'requires', 'comment'].map(name => ({ name }));
      if (sql.includes('FROM pg_catalog.pg_available_extension_versions')) return [{ version: '1.0', installed: true, superuser: true, trusted: null, relocatable: false, required_schema: null, requires: null }];
      if (sql.includes("d.deptype='e'")) return Array.from({ length: limits.members + 1 }, (_, index) => ({ catalog: 'pg_proc', oid: String(index + 1), sub_id: 0, object_type: 'function', schema_name: 'shared', name: 'member', identity: `shared.member${index}()` }));
      if (sql.includes('objects.direction')) return [{ direction: 'requires', dependency_type: 'n', catalog: 'pg_namespace', oid: '9', sub_id: 0, object_type: 'schema', schema_name: null, name: 'shared', identity: 'shared' }];
      if (sql.includes('has_database_privilege')) throw new Error('role metadata unavailable');
      throw new Error('Unexpected query');
    },
  };
  const details = await describePostgresExtension(adapter, 'quoted"extension');
  expect(details.versions.items[0].trusted).toBeNull(); expect(details.versions.items[0].requires).toEqual([]);
  expect(calls.find(call => call.sql.includes('FROM pg_catalog.pg_available_extension_versions'))?.sql).toContain('NULL::boolean AS trusted');
  expect(calls.find(call => call.sql.includes("d.deptype='e'"))?.values).toEqual(['12345']);
  expect(details.members.items.length).toBe(500); expect(details.members.hasMore).toBe(true); expect(details.members.complete).toBe(false);
  expect(details.dependencies.items[0].direction).toBe('requires'); expect(details.permissions.superuser).toBeNull(); expect(details.permissions.error).toContain('unavailable');
  expect(details.source.origin).toBe('reconstructed'); expect(details.source.text).toContain('"quoted""extension"');
  expect(details.source.text).toContain("VERSION E'1.0''\\\\'");
  expect(details.warnings.some(warning => warning.includes('trusted 列'))).toBe(true);
});

test('source bounds never claim truncated SQL complete and session revocation/saving/abort prevent delivery or native queries', async () => {
  const long = sourceText('汉'.repeat(limits.sourceCharacters + 1));
  expect(long.complete).toBe(false); expect(Buffer.byteLength(long.text!)).toBeLessThanOrEqual(limits.sourceBytes);
  expect(sourceText(null).origin).toBe('unknown'); expect(boundedRows([1, 2], 1).complete).toBe(false);
  let reads = 0, release: (() => void) | null = null;
  const session = { provider: 'mysql', database: 'lab' } as RelationalSession;
  const entry: DatabaseAdminObjectEntry = {
    session, saving: false,
    driver: { read: async () => { reads++; await new Promise<void>(resolve => { release = resolve }); return { columns: ['name'], columnTypes: [], rows: [], hasMore: false }; } } as unknown as RelationalDriver,
  };
  let current = entry;
  const service = new DatabaseAdminObjectService(id => { if (id !== 's') throw new Error('different session'); return current });
  entry.saving = true;
  await expect(service.list('s', { kind: 'event', schema: 'lab' })).rejects.toThrow('写事务'); expect(reads).toBe(0);
  entry.saving = false;
  const controller = new AbortController(); controller.abort();
  await expect(service.list('s', { kind: 'event', schema: 'lab' }, controller.signal)).rejects.toThrow(); expect(reads).toBe(0);
  const pending = service.list('s', { kind: 'event', schema: 'lab' });
  current = { ...entry }; release!();
  await expect(pending).rejects.toThrow('会话已变化');
  await expect(service.list('missing-session', { kind: 'event', schema: 'lab' })).rejects.toThrow('different session');
});

test('dedicated routes expose only bounded readonly list/details operations', async () => {
  let reads = 0;
  const app = new Hono().route('/', databaseAdminObjectRoutes({ list: async () => { reads++; throw new Error('stop'); }, details: async () => { reads++; throw new Error('stop'); } }));
  app.onError(error => new Response(error.message, { status: 400 }));
  const base = '/api/database/relational/sessions/s/admin-objects';
  expect((await app.request(`${base}/list`, { method: 'POST', body: 'x'.repeat(limits.requestBytes + 1) })).status).toBe(400);
  expect((await app.request(`${base}/execute`, { method: 'POST', body: '{}' })).status).toBe(404);
  expect((await app.request(`${base}/details`, { method: 'DELETE' })).status).toBe(404);
  expect(reads).toBe(0);
});
