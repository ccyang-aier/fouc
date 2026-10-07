import { expect, test } from 'bun:test';
import { BSON } from 'mongodb';
import { mongoValueText, mongoValueType } from '@fouc/shared/mongo';
import { mongoConnection, mongoEjson, mongoFindInput } from './mongo-input';
import { mongoReadCommand } from './mongo-read-policy';
import { mongoCanonical, readMongoCursor, type MongoDriver } from './drivers/mongo-driver';
import { MongoSessionManager } from './mongo-session';

test('Mongo canonical BSON transport preserves Long Decimal128 binary dates and missing distinction', () => {
  const raw = mongoCanonical({ big: BSON.Long.fromString('9007199254740993'), decimal: BSON.Decimal128.fromString('123456789.1234567890123456789'), int: new BSON.Int32(3), double: new BSON.Double(3.25), id: new BSON.ObjectId('507f1f77bcf86cd799439011'), binary: new BSON.Binary(Buffer.from([0, 255])), date: new Date('2026-01-01T00:00:00Z'), nullable: null });
  const object = JSON.parse(raw) as Record<string, unknown>;
  expect(mongoValueText(object.big)).toBe('9007199254740993');
  expect(mongoValueText(object.decimal)).toBe('123456789.1234567890123456789');
  expect(mongoValueType(object.int)).toBe('Int32'); expect(mongoValueType(object.double)).toBe('Double');
  expect(mongoValueType(object.binary)).toBe('Binary'); expect(mongoValueText(object.date)).toBe('2026-01-01T00:00:00.000Z');
  expect(mongoValueType(object.nullable)).toBe('null'); expect(mongoValueType(object.absent)).toBe('missing');
  expect(mongoEjson(raw).big).toBeInstanceOf(BSON.Long);
  expect(() => mongoEjson('{"big":9007199254740993}')).toThrow('精度丢失');
  expect(() => mongoEjson('{"big":1e400}')).toThrow();
  expect(() => mongoEjson('[]')).toThrow();
  expect(() => mongoEjson('{"big":{"$numberLong":"9223372036854775808"}}')).toThrow('BSON 整数范围');
  expect(() => mongoEjson('{"small":{"$numberInt":"2147483648"}}')).toThrow('BSON 整数范围');
  expect(() => mongoEjson('{"binary":{"$binary":{"base64":"bad!","subType":"00"}}}')).toThrow();
  expect(() => mongoEjson('{"timestamp":{"$timestamp":{"t":4294967296,"i":0}}}')).toThrow();
});
test('Mongo connection input has credential-free display and validated bounded queries', () => {
  const input = mongoConnection({ host: '::1', username: 'u@x', password: 'secret/path', database: 'demo', authSource: 'admin' });
  expect(input.host).toBe('[::1]:27017'); expect(input.database).toBe('demo');
  expect(input.uri).toContain('u%40x:secret%2Fpath@');
  expect(mongoConnection({ uri: 'mongodb://u:secret@host:27017/demo?authSource=admin' }).host).toBe('host:27017');
  const query = mongoFindInput({ database: 'demo', collection: 'docs', sort: '{"price":-1}', projection: '{"price":1,"_id":0}' });
  expect(query.parsedSort).toEqual({ price: -1, _id: 1 }); expect(query.parsedProjection).toEqual({ price: 1, _id: 0 });
  expect(() => mongoFindInput({ database: 'demo', collection: 'docs', projection: '{"a":1,"b":0}' })).toThrow();
  expect(() => mongoFindInput({ database: 'demo', collection: 'docs', sort: '{"price":2}' })).toThrow();
  expect(() => mongoFindInput({ database: 'demo', collection: 'docs', limit: 501 })).toThrow();
  expect(() => mongoFindInput({ database: 'demo', collection: 'system.users' })).toThrow();
});
test('Mongo read policy denies write commands nested output and server JS; explain is estimate only', () => {
  expect(mongoReadCommand('{"find":"docs","filter":{"x":{"$numberLong":"9007199254740993"}}}').name).toBe('find');
  expect(mongoReadCommand('{"aggregate":"docs","pipeline":[{"$match":{}},{"$group":{"_id":"$x","n":{"$sum":1}}}]}').name).toBe('aggregate');
  expect(mongoReadCommand('{"explain":{"find":"docs","filter":{"x":{"$numberLong":"9007199254740993"}}}}').command.verbosity).toBe('queryPlanner');
  expect(() => mongoReadCommand('{"find":"docs","filter":{"$and":[{"_bsontype":"fake","$where":"true"}]}}')).toThrow();
  for (const command of ['{"insert":"docs","documents":[]}', '{"drop":"docs"}', '{"renameCollection":"demo.a","to":"demo.b"}', '{"aggregate":"docs","pipeline":[{"$out":"other"}]}', '{"aggregate":"docs","pipeline":[{"$lookup":{"from":"other","pipeline":[{"$merge":"other"}],"as":"x"}}]}', '{"find":"docs","filter":{"$where":"true"}}', '{"aggregate":"docs","pipeline":[{"$project":{"x":{"$function":{"body":"return 1","args":[],"lang":"js"}}}}]}', '{"explain":{"delete":"docs","deletes":[]}}', '{"explain":{"find":"docs"},"verbosity":"executionStats"}', '{"ping":1,"$db":"other"}']) expect(() => mongoReadCommand(command)).toThrow();
});
test('Mongo cursor closes on page bound abort and iteration failure', async () => {
  let closed = 0;
  const page = await readMongoCursor({ async *[Symbol.asyncIterator]() { yield { n: 1 }; yield { n: 2 }; yield { n: 3 }; }, async close() { closed++; } }, 2);
  expect(page.documents).toHaveLength(2); expect(page.hasMore).toBe(true); expect(closed).toBe(1);
  const abort = new AbortController();
  await expect(readMongoCursor({ async *[Symbol.asyncIterator]() { yield { n: 1 }; abort.abort(new Error('cancel')); yield { n: 2 }; }, async close() { closed++; } }, 5, abort.signal)).rejects.toThrow('cancel');
  await expect(readMongoCursor({ async *[Symbol.asyncIterator]() { yield { n: 1 }; throw new Error('cursor failed'); }, async close() { closed++; } }, 5)).rejects.toThrow('cursor failed');
  expect(closed).toBe(3);
});

function fakeDriver(onFind: (signal?: AbortSignal) => Promise<ReturnType<MongoDriver['find']> extends Promise<infer T> ? T : never>, onClose: () => void): MongoDriver {
  const unavailable = async (): Promise<never> => { throw new Error('unused test operation'); };
  return { database: 'demo', host: 'test', version: '8.0', find: (_value, signal) => onFind(signal), databases: unavailable, collections: unavailable, count: unavailable, indexes: unavailable, information: unavailable, command: unavailable, close: async () => onClose() };
}
test('Mongo session ownership precedes all I/O and close aborts in-flight reads', async () => {
  let calls = 0, closed = 0;
  const driver = fakeDriver(signal => { calls++; return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(signal!.reason), { once: true })); }, () => closed++);
  const manager = new MongoSessionManager(async () => driver);
  try {
    const session = await manager.connect({});
    expect(session.readOnly).toBe(true); expect('uri' in session).toBe(false);
    await expect(manager.find('missing-session', {})).rejects.toThrow('已断开');
    await expect(manager.disconnect('missing-session')).rejects.toThrow('已断开'); expect(calls).toBe(0); expect(closed).toBe(0);
    const pending = manager.find(session.id, {});
    await manager.disconnect(session.id);
    await expect(pending).rejects.toThrow('会话已关闭'); expect(closed).toBe(1);
    await expect(manager.find(session.id, {})).rejects.toThrow('已断开');
  } finally { await manager.dispose(); }
});
test('Mongo disposal cancels a pending connection and never publishes its session', async () => {
  let closed = 0;
  const driver = fakeDriver(async () => { throw new Error('unused'); }, () => closed++);
  const manager = new MongoSessionManager(async (_input, signal) => { await new Promise<void>(resolve => signal!.addEventListener('abort', () => resolve(), { once: true })); return driver; });
  try {
    const pending = manager.connect({});
    await Promise.resolve(); await Promise.resolve();
    await manager.dispose();
    await expect(pending).rejects.toThrow('运行时已关闭'); expect(closed).toBe(1);
  } finally { await manager.dispose(); }
});
