import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { BSON, MongoClient } from 'mongodb';
import { MongoSessionManager } from './mongo-session';
import { mongoConnection } from './mongo-input';
import { mongoRoutes } from '../api/mongo-routes';

const configuration = process.env.FOUC_MONGO_TEST_CONFIG;
const liveTest = configuration ? test : test.skip;

liveTest('native document export/import fidelity, once plans, ordered partial success and metadata invalidation', async () => {
  const input = JSON.parse(readFileSync(configuration!, 'utf8'));
  if (!['localhost', '127.0.0.1'].includes(input.host) || input.database !== 'fouc_datastore_lab') throw new Error('Requires the explicit local isolated Mongo laboratory');
  const config = mongoConnection(input), client = new MongoClient(config.uri), sessions = new MongoSessionManager();
  const prefix = '__fouc_documents_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const source = prefix + '_source', target = prefix + '_target';
  const database = client.db(config.database);
  try {
    await client.connect();
    await database.createCollection(source);
    await database.createCollection(target);
    const fixture = {
      _id: new BSON.ObjectId(), big: BSON.Long.fromString('9007199254740993'), decimal: BSON.Decimal128.fromString('123.4567890123456789012345678901234'),
      binary: new BSON.Binary(Buffer.from([0, 1, 128, 255]), 128), date: new Date('2025-02-03T04:05:06.007Z'), nested: [new BSON.Int32(3), new BSON.Double(1.5)],
    };
    await database.collection(source).insertMany([fixture, { _id: new BSON.ObjectId(), excluded: true }]);
    const session = await sessions.connect(input);
    const routes = mongoRoutes(sessions), root = `/api/database/mongo/sessions/${session.id}`;
    const exported = await routes.request(root + '/documents/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ database: config.database, collection: source, filter: '{"excluded":{"$ne":true}}', scope: 'all' }) });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toBe('application/octet-stream');
    const text = await exported.text();
    expect(text).toBe(BSON.EJSON.stringify(fixture, { relaxed: false }) + '\n');
    const one = await sessions.exportDocuments(session.id, { database: config.database, collection: source, scope: 'first', limit: 1 });
    let oneText = '';
    for await (const chunk of one.stream) oneText += chunk.toString();
    expect(oneText.trim().split('\n')).toHaveLength(1);
    const importInput = { database: config.database, collection: target, format: 'ndjson', idPolicy: 'preserve', text };
    const beforeUnlock = await sessions.prepareDocumentImport(session.id, importInput);
    expect(beforeUnlock.documents).toBe(1);
    expect(await database.collection(target).countDocuments()).toBe(0);
    await expect(sessions.commitDocumentImport(session.id, beforeUnlock.planId)).rejects.toThrow('只读');
    sessions.setWriteAccess(session.id, true);
    await expect(sessions.commitDocumentImport(session.id, beforeUnlock.planId)).rejects.toThrow('失效');
    const preview = await sessions.prepareDocumentImport(session.id, importInput);
    const result = await sessions.commitDocumentImport(session.id, preview.planId);
    expect(result.state).toBe('complete'); expect(result.inserted).toBe(1); expect(result.insertedIds).toHaveLength(1);
    const inserted = await database.collection(target).findOne({ _id: fixture._id }, { promoteValues: false, promoteLongs: false });
    expect(BSON.EJSON.stringify(inserted, { relaxed: false })).toBe(text.trim());
    await expect(sessions.commitDocumentImport(session.id, preview.planId)).rejects.toThrow('已使用');
    const partialInput = { ...importInput, format: 'json', text: BSON.EJSON.stringify([{ _id: 'prefix-success' }, { _id: fixture._id }, { _id: 'must-not-execute' }], { relaxed: false }) };
    const partialPlan = await sessions.prepareDocumentImport(session.id, partialInput);
    expect(partialPlan.existingIds).toBe(1);
    const partial = await sessions.commitDocumentImport(session.id, partialPlan.planId);
    expect(partial.state).toBe('partial'); expect(partial.inserted).toBe(1); expect(partial.error?.row).toBe(1);
    expect(partial.insertedIds.map(value => value.row)).toEqual([0]);
    expect(await database.collection(target).findOne({ _id: 'must-not-execute' } as BSON.Document)).toBeNull();
    const changed = await sessions.prepareDocumentImport(session.id, { ...importInput, idPolicy: 'generate' });
    await database.collection(target).createIndex({ marker: 1 });
    const conflict = await sessions.commitDocumentImport(session.id, changed.planId);
    expect(conflict.state).toBe('failed'); expect(conflict.inserted).toBe(0); expect(conflict.error?.message).toContain('元数据');
    const cancelled = await sessions.prepareDocumentImport(session.id, { ...importInput, idPolicy: 'generate' });
    expect(sessions.cancelDocumentImport(session.id, cancelled.planId).state).toBe('cancelled');
    await expect(sessions.commitDocumentImport(session.id, cancelled.planId)).rejects.toThrow('已使用');
    expect((await routes.request(root.replace(session.id, 'missing-session') + '/documents/import/plans/' + partialPlan.planId)).status).toBe(400);
    const downloading = await sessions.exportDocuments(session.id, { database: config.database, collection: source, scope: 'all' });
    expect(downloading.stream.readableFlowing).toBeNull();
    await sessions.disconnect(session.id);
    expect(downloading.stream.destroyed).toBe(true);
    console.log('PASS new native Mongo document P0: EJSON stream → readonly full preview → unlock/repreview → once append; ordered partial IDs, metadata conflict, cancellation and scoped lifecycle');
  } finally {
    await sessions.dispose();
    for (const collection of [source, target]) await database.collection(collection).drop().catch(error => { if (error.code !== 26) throw error; });
    await client.close();
  }
}, 45000);
