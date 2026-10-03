import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { BSON, MongoClient } from 'mongodb';
import { mongoConnection } from './mongo-input';
import { mongoCanonical } from './drivers/mongo-driver';
import { commitMongoMutation, MongoMutationConflictError, prepareMongoMutation } from './mongo-mutation';

const configuration = process.env.FOUC_MONGO_TEST_CONFIG;
const liveTest = configuration ? test : test.skip;
liveTest('Mongo native mutation P0: preview no writes, exact BSON, atomic CAS, collections and indexes', async () => {
  const config = JSON.parse(await readFile(configuration!, 'utf8'));
  if (config.host !== '127.0.0.1' && config.host !== 'localhost') throw new Error('Mongo write P0 requires an explicit localhost laboratory');
  if (config.database !== 'fouc_datastore_lab') throw new Error('Mongo write P0 requires fouc_datastore_lab');
  const client = new MongoClient(mongoConnection(config).uri, { promoteValues: false, promoteLongs: false });
  const collection = `fouc_mongo_mutation_p0_${Date.now()}`, database = config.database;
  const db = client.db(database), docs = db.collection<BSON.Document & { _id: string | BSON.ObjectId }>(collection);
  try {
    await client.connect();
    const creation = await prepareMongoMutation(client, { database, collection, operation: 'create-collection', optionsEjson: '{"collation":{"locale":"en","strength":2}}' });
    expect(await db.listCollections({ name: collection }).hasNext()).toBe(false);
    await commitMongoMutation(client, creation.plan);
    const insertion = await prepareMongoMutation(client, { database, collection, operation: 'insert-document', documentEjson: '{"big":{"$numberLong":"9007199254740993"},"decimal":{"$numberDecimal":"12.3400"},"nested":{"a.b":{"$numberLong":"1"},"$z":{"$numberDouble":"2.0"}},"items":[{"$timestamp":{"t":2,"i":3}},null]}' });
    expect(String(await docs.countDocuments())).toBe('0');
    expect(insertion.review.documentId).toContain('$oid');
    await commitMongoMutation(client, insertion.plan);
    let original = (await docs.findOne({}))!;
    expect((original.big as BSON.Long).toString()).toBe('9007199254740993'); expect((original.decimal as BSON.Decimal128).toString()).toBe('12.3400');
    const replacement = await prepareMongoMutation(client, { database, collection, operation: 'replace-document', originalEjson: mongoCanonical(original), documentEjson: mongoCanonical({ ...original, title: 'replacement' }) });
    await commitMongoMutation(client, replacement.plan);
    original = (await docs.findOne({}))!; expect(original.title).toBe('replacement');
    const deletion = await prepareMongoMutation(client, { database, collection, operation: 'delete-document', originalEjson: mongoCanonical(original) });
    await docs.updateOne({ _id: original._id }, { $set: { title: 'external change' } });
    await expect(commitMongoMutation(client, deletion.plan)).rejects.toBeInstanceOf(MongoMutationConflictError);
    expect(String(await docs.countDocuments())).toBe('1');
    original = (await docs.findOne({}))!;
    await expect(prepareMongoMutation(client, { database, collection, operation: 'replace-document', originalEjson: mongoCanonical(original), documentEjson: '{"_id":"different"}' })).rejects.toThrow('_id');
    const index = await prepareMongoMutation(client, { database, collection, operation: 'create-index', keysEjson: '{"title":1}', optionsEjson: '{"name":"title_unique","unique":true}' });
    expect((await docs.listIndexes().toArray()).length).toBe(1);
    await commitMongoMutation(client, index.plan); expect((await docs.listIndexes().toArray()).length).toBe(2);
    const dropIndex = await prepareMongoMutation(client, { database, collection, operation: 'drop-index', indexName: 'title_unique' }); await commitMongoMutation(client, dropIndex.plan);
    expect((await docs.listIndexes().toArray()).length).toBe(1);
    const conflictIndex = await prepareMongoMutation(client, { database, collection, operation: 'create-index', keysEjson: '{"big":1}', optionsEjson: '{"name":"big_index"}' });
    await docs.createIndex({ title: 1 }, { name: 'external_index' });
    await expect(commitMongoMutation(client, conflictIndex.plan)).rejects.toBeInstanceOf(MongoMutationConflictError);
    original = (await docs.findOne({}))!;
    await commitMongoMutation(client, (await prepareMongoMutation(client, { database, collection, operation: 'delete-document', originalEjson: mongoCanonical(original) })).plan);
    expect(String(await docs.countDocuments())).toBe('0');
    await docs.insertOne({ _id: 'typed-cas', number: BSON.Long.fromString('1'), text: 'a' });
    const typedOriginal = (await docs.findOne({ _id: 'typed-cas' }))!;
    const typedPlan = await prepareMongoMutation(client, { database, collection, operation: 'replace-document', originalEjson: mongoCanonical(typedOriginal), documentEjson: mongoCanonical({ ...typedOriginal, text: 'updated' }) });
    let racingPatch: BSON.Document = { number: new BSON.Double(1) };
    // Simulate another client racing after preflight, before the single atomic update command.
    const racingClient = new Proxy(client, { get(target, property) {
      if (property === 'db') return (name: string) => new Proxy(target.db(name), { get(targetDb, dbProperty) {
        if (dbProperty === 'command') return async (command: BSON.Document, options: BSON.Document) => {
          if (command.update) await docs.updateOne({ _id: 'typed-cas' }, { $set: racingPatch });
          return targetDb.command(command, options);
        };
        const member = Reflect.get(targetDb, dbProperty, targetDb); return typeof member === 'function' ? member.bind(targetDb) : member;
      } });
      const member = Reflect.get(target, property, target); return typeof member === 'function' ? member.bind(target) : member;
    } });
    await expect(commitMongoMutation(racingClient, typedPlan.plan)).rejects.toBeInstanceOf(MongoMutationConflictError);
    expect((await docs.findOne({ _id: 'typed-cas' }))!.text).toBe('a');
    const caseOriginal = (await docs.findOne({ _id: 'typed-cas' }))!;
    const casePlan = await prepareMongoMutation(client, { database, collection, operation: 'replace-document', originalEjson: mongoCanonical(caseOriginal), documentEjson: mongoCanonical({ ...caseOriginal, text: 'updated' }) });
    racingPatch = { text: 'A' };
    await expect(commitMongoMutation(racingClient, casePlan.plan)).rejects.toBeInstanceOf(MongoMutationConflictError);
    expect((await docs.findOne({ _id: 'typed-cas' }))!.text).toBe('A');
    const drop = await prepareMongoMutation(client, { database, collection, operation: 'drop-collection' });
    await commitMongoMutation(client, drop.plan); expect(await db.listCollections({ name: collection }).hasNext()).toBe(false);
  } finally { await client.db(database).collection(collection).drop().catch(() => undefined); await client.close(); }
}, 20_000);
