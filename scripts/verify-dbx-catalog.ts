import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

declare const Bun: { YAML: { parse: (source: string) => unknown } };

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
const readYaml = (path: string) => Bun.YAML.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

const catalog = readJson('shared/catalog/dbx-catalog.json');
const manifest = readJson('opensource/dbx/crates/dbx-core/assets/database-drivers.manifest.json');
const profiles = readYaml('opensource/dbx/plugins/connection-types/profiles/catalog.yaml');
const dialectRoot = 'opensource/dbx/plugins/dialects';
const dialects = readdirSync(dialectRoot).filter((name) => name.endsWith('.yaml')).sort()
  .map((name) => ({ id: basename(name, '.yaml'), ...readYaml(join(dialectRoot, name)) }));

assert.equal(catalog.manifestSchemaVersion, manifest.schemaVersion);
assert.deepEqual(catalog.drivers, manifest.drivers, 'driver declarations differ from DBX source');
assert.deepEqual(catalog.profiles, profiles.profiles, 'connection Profiles differ from DBX source');
assert.deepEqual(catalog.dialects, dialects, 'SQL dialects differ from DBX source');

console.log(`DBX catalog content verified: ${(catalog.drivers as unknown[]).length} drivers, ${(catalog.profiles as unknown[]).length} Profiles, ${dialects.length} dialects.`);
