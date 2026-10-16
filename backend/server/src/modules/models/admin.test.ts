import { describe, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import { importModelCatalog, readBundledModelCatalog, validateModelCatalog } from './admin';

describe('model catalog import boundary', () => {
  test('bundled model metadata has verified official sources and unique real IDs', async () => {
    const catalog = await readBundledModelCatalog();
    expect(catalog.items.length).toBeGreaterThan(0);
    expect(new Set(catalog.items.map((item) => item.id)).size).toBe(catalog.items.length);
    for (const item of catalog.items) expect(item.sources.every((source) => new URL(source.url).protocol === 'https:')).toBe(true);
  });

  test('rejects invalid, duplicate, or execution-bearing payloads before database access', async () => {
    const entry = (await readBundledModelCatalog()).items[0]!;
    let connected = false;
    const admin = { connect: async () => { connected = true; throw new Error('Must not acquire a connection'); } } as unknown as Pool;
    for (const value of [
      { items: [entry, entry] },
      { items: [{ ...entry, maxOutput: -1 }] },
      { items: [{ ...entry, ratings: { ...entry.ratings, intelligence: { ...entry.ratings.intelligence, score: 101 } } }] },
      { items: [{ ...entry, reasoning: { levels: ['low', 'low'], defaultLevel: 'low' } }] },
      { items: [{ ...entry, reasoning: { levels: ['low', 'high'], defaultLevel: 'medium' } }] },
      { items: [{ ...entry, capabilities: { ...entry.capabilities, reasoning: false } }] },
      { items: [{ ...entry, benchmarks: [] }] },
      { items: [{ ...entry, apiKey: 'provider-secret' }] },
      { items: [{ ...entry, sources: [{ label: 'Unsafe URL', url: 'http://example.com' }] }] },
      { items: [entry], accountId: 'invented-scope' },
    ]) await expect(importModelCatalog(admin, value)).rejects.toMatchObject({ code: 'invalid_config' });
    expect(connected).toBe(false);
    expect(validateModelCatalog({ items: [] })).toEqual({ items: [] });
  });
});
