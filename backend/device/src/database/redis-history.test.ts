import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RedisHistoryRepository, redisHistoryEntry } from './redis-history';

test('Redis history survives repository reload, isolates connections and caps storage', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-redis-history-'));
  try {
    const history = new RedisHistoryRepository(directory);
    for (let index = 0; index < 105; index++) history.append('connection', redisHistoryEntry(15, `TYPE key-${index}`, Date.now(), true, 'string'));
    const reloaded = new RedisHistoryRepository(directory);
    expect(reloaded.list('connection')).toHaveLength(100);
    expect(reloaded.list('connection')[0]?.command).toBe('TYPE key-5');
    expect(reloaded.list('other')).toEqual([]);
    const capped = redisHistoryEntry(15, 'INFO stats', Date.now(), true, 'x'.repeat(20000));
    expect(capped.output.length).toBe(16384); expect(capped.outputTruncated).toBe(true);
    history.clear('connection'); expect(reloaded.list('connection')).toEqual([]);
  } finally {
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(target).startsWith('fouc-redis-history-')) throw new Error('Unexpected test cleanup target');
    rmSync(target, { recursive: true });
  }
});
