import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createCredentialCipher, createModelCredentialStore } from './credentials';
import { ModelGatewayError } from './errors';
import { createTenantTestDatabase, seedTenantTestData } from '../../../../platform/database/workspace/tenant-test-database';

test('AES-GCM binds ciphertext to tenant, owner, credential, provider and destination', () => {
  const identity = { workspaceId: randomUUID(), userId: randomUUID(), id: randomUUID(), provider: 'cloud', endpoint: 'https://model.test/v1' };
  const key = randomBytes(32), cipher = createCredentialCipher(key);
  const encrypted = cipher.encrypt('synthetic-api-key', identity);
  assert.equal(Buffer.from(encrypted).includes(Buffer.from('synthetic-api-key')), false);
  assert.equal(cipher.decrypt(encrypted, identity), 'synthetic-api-key');
  assert.notDeepEqual(cipher.encrypt('synthetic-api-key', identity), encrypted);
  for (const field of ['workspaceId', 'userId', 'id', 'provider', 'endpoint'] as const) assert.throws(() => cipher.decrypt(encrypted, { ...identity, [field]: 'tampered' }), ModelGatewayError);
  const corrupt = new Uint8Array(encrypted); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => cipher.decrypt(corrupt, identity), ModelGatewayError);
  assert.throws(() => createCredentialCipher(randomBytes(32)).decrypt(encrypted, identity), ModelGatewayError);
  assert.throws(() => createCredentialCipher(randomBytes(31)), ModelGatewayError);
  assert.throws(() => cipher.encrypt('key\r\nheader', identity), ModelGatewayError);
});

test('real PostgreSQL credential store isolates owners and tenants, encrypts at rest and revokes immediately', async () => {
  const database = await createTenantTestDatabase();
  try {
    const { tenants: [alpha, beta] } = await seedTenantTestData(database.admin);
    const store = createModelCredentialStore(database.pool, randomBytes(32));
    const created = await store.create(alpha, { provider: 'cloud', apiKey: 'synthetic-private-key', endpoint: 'https://model.test/v1' });
    assert.deepEqual(Object.keys(created).sort(), ['endpoint', 'id', 'provider']);
    const encrypted = await database.admin.query('SELECT encrypted_secret FROM workspace.model_credential WHERE workspace_id=$1 AND id=$2', [alpha.workspaceId, created.id]);
    assert.equal((encrypted.rows[0].encrypted_secret as Buffer).includes(Buffer.from('synthetic-private-key')), false);
    assert.equal((await store.find(alpha, created.id, 'cloud'))?.apiKey, 'synthetic-private-key');
    assert.equal(await store.find(beta, created.id, 'cloud'), null);
    assert.equal(await store.find({ workspaceId: alpha.workspaceId, userId: beta.userId }, created.id, 'cloud'), null);
    assert.equal(await store.find(alpha, created.id, 'other'), null);
    assert.equal(await store.revoke(beta, created.id), false);
    await database.admin.query('UPDATE workspace.model_credential SET endpoint=$1 WHERE workspace_id=$2 AND id=$3', ['https://tampered.test', alpha.workspaceId, created.id]);
    await assert.rejects(store.find(alpha, created.id, 'cloud'), ModelGatewayError);
    await database.admin.query('UPDATE workspace.model_credential SET endpoint=$1 WHERE workspace_id=$2 AND id=$3', ['https://model.test/v1', alpha.workspaceId, created.id]);
    assert.equal(await store.revoke(alpha, created.id), true);
    assert.equal(await store.find(alpha, created.id, 'cloud'), null);
    assert.equal(await store.revoke(alpha, created.id), false);
    await assert.rejects(store.create(alpha, { provider: 'cloud', apiKey: 'key', endpoint: 'https://key:secret@model.test' }), ModelGatewayError);
  } finally { await database.dispose(); }
});
