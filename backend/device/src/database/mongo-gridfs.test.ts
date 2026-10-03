import { expect, test } from 'bun:test';
import { BSON } from 'mongodb';
import { mongoGridFsDownloadName, mongoGridFsSize } from '@fouc/shared/mongo-gridfs';
import { mongoGridFsFileInput, mongoGridFsListInput, mongoGridFsNamespace } from './mongo-gridfs-input';
import { mongoGridFsFileInfo } from './mongo-gridfs';

test('GridFS native metadata keeps integer/date/EJSON precision and marks malformed files', () => {
  const file = mongoGridFsFileInfo({
    _id: BSON.Long.fromString('9007199254740993'), filename: 'report.bin',
    length: BSON.Long.fromString('9007199254740993'), chunkSize: new BSON.Int32(65536),
    uploadDate: new Date('2026-10-04T01:02:03.123Z'), metadata: { value: BSON.Decimal128.fromString('123.4500') },
  });
  expect(file.idEjson).toBe('{"$numberLong":"9007199254740993"}');
  expect(file.length).toBe('9007199254740993');
  expect(file.uploadedAt).toBe('2026-10-04T01:02:03.123Z');
  expect(file.metadataEjson).toContain('123.4500');
  expect(file.warnings).toHaveLength(0);
  expect(mongoGridFsFileInfo({ _id: 'bad', length: new BSON.Double(1.5), chunkSize: 0 }).length).toBeNull();
  expect(mongoGridFsFileInfo({ _id: 'bad', length: -1, chunkSize: 1 }).warnings.length).toBeGreaterThan(0);
  expect(mongoGridFsSize('9007199254740993')).toBe('8.00 PiB');
});

test('GridFS identities and namespaces remain typed, bounded and safe; filters cannot run JS', () => {
  expect(mongoGridFsFileInput({ database: 'db', bucket: 'nested.fs', idEjson: '{"$numberLong":"9007199254740993"}' }).id).toBeInstanceOf(BSON.Long);
  expect(mongoGridFsFileInput({ database: 'db', bucket: 'nested.fs', idEjson: '"report-42"' }).id).toBe('report-42');
  expect(() => mongoGridFsFileInput({ database: 'db', bucket: 'fs', idEjson: '{"$gt":0}' })).toThrow('标量');
  expect(() => mongoGridFsNamespace({ database: 'db', bucket: 'system.fs' })).toThrow();
  expect(() => mongoGridFsNamespace({ database: 'd'.repeat(63), bucket: 'b'.repeat(200) })).toThrow('命名空间');
  expect(() => mongoGridFsListInput({ database: 'db', bucket: 'fs', filter: '{"$where":"true"}' })).toThrow('只读');
  expect(() => mongoGridFsListInput({ database: 'db', bucket: 'fs', offset: 1.5 })).toThrow();
  const input = mongoGridFsListInput({ database: 'db', bucket: 'fs', sort: '{"filename":1.0}', limit: 25 });
  expect(input.sort).toEqual({ filename: 1, _id: -1 });
  expect(mongoGridFsDownloadName('../../中文\r\nfile.bin')).toBe('-..-中文-file.bin');
  expect(mongoGridFsDownloadName('CON.txt')).toBe('gridfs-file.bin');
  expect(Buffer.byteLength(mongoGridFsDownloadName('😀中文'.repeat(100)))).toBeLessThanOrEqual(180);
});
