import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { GridFSBucket, BSON, MongoClient } from 'mongodb';
import { mongoConnection } from './mongo-input';
import { MongoSessionManager } from './mongo-session';
import { mongoRoutes } from '../api/mongo-routes';

const configuration = process.env.FOUC_MONGO_TEST_CONFIG;
const liveTest = configuration ? test : test.skip;

liveTest('native GridFS browse, exact summaries, typed IDs, HTTP download bytes and session cancellation', async () => {
  const input = JSON.parse(readFileSync(configuration!, 'utf8'));
  if (!['localhost', '127.0.0.1'].includes(input.host) || input.database !== 'fouc_datastore_lab') throw new Error('GridFS P0 requires the explicit local isolated Mongo laboratory');
  const config = mongoConnection(input);
  const client = new MongoClient(config.uri);
  const sessions = new MongoSessionManager();
  const bucketName = 'fouc_gridfs_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const bucket = new GridFSBucket(client.db(config.database), { bucketName, chunkSizeBytes: 65536 });
  const orphan = bucketName + '_orphan';
  const bytes = Buffer.from(Array.from({ length: 1024 * 1024 + 101 }, (_, index) => index % 251));
  try {
    await client.connect();
    const upload = bucket.openUploadStream('../../中文\r\nfile.bin', { metadata: { big: BSON.Long.fromString('9007199254740993') } });
    const uploaded = once(upload, 'finish');
    upload.end(bytes);
    await uploaded;
    await client.db(config.database).createCollection(orphan + '.chunks');
    const session = await sessions.connect(input);
    expect(session.readOnly).toBe(true);
    const namespace = { database: config.database, bucket: bucketName };
    const discovered = await sessions.gridFsBuckets(session.id, { database: config.database });
    expect(discovered.buckets.find(item => item.bucket === bucketName)?.state).toBe('complete');
    expect(discovered.buckets.find(item => item.bucket === orphan)?.state).toBe('chunks-only');
    const page = await sessions.gridFsFiles(session.id, { ...namespace, filter: '{"filename":{"$regex":"中文"}}', limit: 1 });
    expect(page.files).toHaveLength(1);
    expect(page.files[0].metadataEjson).toContain('9007199254740993');
    expect(page.files[0].length).toBe(String(bytes.length));
    const summary = await sessions.gridFsSummary(session.id, namespace);
    expect(summary.totalBytes).toBe(String(bytes.length));
    const files = client.db(config.database).collection<BSON.Document & { _id: string | BSON.ObjectId }>(bucketName + '.files');
    await files.insertOne({ _id: 'bad-fraction', length: new BSON.Double(1.5) });
    expect((await sessions.gridFsSummary(session.id, namespace)).totalBytes).toBeNull();
    await files.deleteOne({ _id: 'bad-fraction' });
    await files.insertOne({ _id: 'large-exact', length: BSON.Long.fromString('9007199254740993'), chunkSize: new BSON.Int32(65536), uploadDate: new Date() });
    expect((await sessions.gridFsSummary(session.id, namespace)).totalBytes).toBe(String(9007199254740993n + BigInt(bytes.length)));
    await files.deleteOne({ _id: 'large-exact' });
    const routes = mongoRoutes(sessions);
    const root = `/api/database/mongo/sessions/${session.id}/gridfs`;
    const response = await routes.request(root + '/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...namespace, idEjson: page.files[0].idEjson }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(response.headers.get('content-disposition')).not.toContain('\r');
    expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(true);
    await files.insertOne({ _id: 'custom-scalar', filename: 'typed-id.bin', length: new BSON.Int32(3), chunkSize: new BSON.Int32(16), uploadDate: new Date() });
    await client.db(config.database).collection(bucketName + '.chunks').insertOne({ files_id: 'custom-scalar', n: 0, data: new BSON.Binary(Buffer.from([0, 128, 255])) });
    const custom = await routes.request(root + '/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...namespace, idEjson: '"custom-scalar"' }) });
    expect(custom.status).toBe(200);
    expect([...new Uint8Array(await custom.arrayBuffer())]).toEqual([0, 128, 255]);
    const unauthorized = await routes.request(root.replace(session.id, 'missing-session') + '/download', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...namespace, idEjson: page.files[0].idEjson }) });
    expect(unauthorized.status).toBe(400);
    const download = await sessions.gridFsDownload(session.id, { ...namespace, idEjson: page.files[0].idEjson });
    expect(download.stream.readableFlowing).toBeNull();
    const closed = once(download.stream, 'close').catch(() => undefined);
    await sessions.disconnect(session.id);
    await closed;
    expect(download.stream.destroyed).toBe(true);
    await expect(sessions.gridFsFiles('missing-session', namespace)).rejects.toThrow('断开');
    console.log('PASS native GridFS: real upload fixture → read-only browse/summary → streamed HTTP byte check → close cancels lazy download');
  } finally {
    await sessions.dispose();
    for (const collection of [bucketName + '.files', bucketName + '.chunks', orphan + '.chunks']) {
      await client.db(config.database).collection(collection).drop().catch(error => { if (error.code !== 26) throw error; });
    }
    await client.close();
  }
}, 45000);
