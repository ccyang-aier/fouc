import { describe, expect, test } from 'bun:test';
import { createKnowledgeAssetStorage, readKnowledgeAssetStorageConfig } from './storage';
import { confirmWorkspaceAssetUpload, prepareWorkspaceAssetUpload, presignWorkspaceAssetDownload, revokeWorkspaceAsset } from './service';
import { KnowledgeAssetError } from './errors';

const workspaceId = '5bd0c7a8-1713-4c47-97f0-2c1e0f3f2a91';
const hash = '6a1b0e8b2b4a86b7f47feff3b6c78b9dd7f43f784e21fdba4b5e10c0ad4dbdf2';
const userId = 'a41c2f2c-c678-4f7f-bb6e-a3a1ea3b0e14';
const intent = { workspaceId, userId, hash, mime: 'text/plain', size: 12, name: 'notes.txt' };
const storage = createKnowledgeAssetStorage({
  endpoint: 'http://127.0.0.1:59000', region: 'us-east-1', bucket: 'fouc-knowledge', accessKeyId: 'testing', secretAccessKey: 'testing',
});

describe('asset storage configuration and addressing', () => {
  test('rejects malformed storage configuration without falling back silently', async () => {
    await expect(readKnowledgeAssetStorageConfig({ S3_ENDPOINT: 'ftp://storage.internal:9000' })).rejects.toMatchObject({ code: 'INVALID_STORAGE_CONFIG' });
    expect(() => createKnowledgeAssetStorage({ endpoint: 'http://127.0.0.1:59000/path', region: 'us-east-1', bucket: 'Fouc-Knowledge', accessKeyId: 'k', secretAccessKey: 's' }))
      .toThrow(KnowledgeAssetError);
  });

  test('addresses objects as workspace/hash and refuses anything else', () => {
    expect(storage.objectKey({ workspaceId, hash })).toBe(`${workspaceId}/${hash}`);
    expect(() => storage.objectKey({ workspaceId: 'not-a-uuid', hash })).toThrow(KnowledgeAssetError);
    expect(() => storage.objectKey({ workspaceId, hash: hash.slice(0, 63) })).toThrow(KnowledgeAssetError);
  });

  test('presigned URLs carry the grant\'s method, scope and expiry', () => {
    const upload = storage.presignUpload({ workspaceId, hash }, 600);
    const download = storage.presignDownload({ workspaceId, hash }, 300);
    const uploadUrl = new URL(upload.url), downloadUrl = new URL(download.url);
    expect(`${uploadUrl.protocol}//${uploadUrl.host}${uploadUrl.pathname}`).toBe(`http://127.0.0.1:59000/fouc-knowledge/${workspaceId}/${hash}`);
    expect(uploadUrl.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(uploadUrl.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(uploadUrl.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(uploadUrl.searchParams.get('X-Amz-Credential')).toContain('/s3/aws4_request');
    // The method is part of the signed canonical request: grants are not interchangeable.
    expect(uploadUrl.searchParams.get('X-Amz-Signature')).not.toBe(downloadUrl.searchParams.get('X-Amz-Signature'));
    expect(Date.parse(upload.expiresAt)).toBeGreaterThan(Date.now());
    expect(() => storage.presignUpload({ workspaceId, hash }, 0)).toThrow(KnowledgeAssetError);
    expect(() => storage.presignDownload({ workspaceId, hash }, 3601)).toThrow(KnowledgeAssetError);
  });
});

describe('asset service input validation', () => {
  test('rejects malformed scopes, hashes, mimes and sizes before any I/O', async () => {
    const withExtraField = { ...intent, extra: 'field' };
    await expect(prepareWorkspaceAssetUpload(storage, null as never, { ...intent, hash: 'XYZ' })).rejects.toMatchObject({ code: 'INVALID_ASSET_INPUT' });
    await expect(confirmWorkspaceAssetUpload(storage, null as never, { ...intent, size: 0 })).rejects.toMatchObject({ code: 'INVALID_ASSET_INPUT' });
    await expect(confirmWorkspaceAssetUpload(storage, null as never, withExtraField)).rejects.toMatchObject({ code: 'INVALID_ASSET_INPUT' });
    await expect(presignWorkspaceAssetDownload(storage, null as never, { workspaceId, userId, hash: 'zz' })).rejects.toMatchObject({ code: 'INVALID_ASSET_INPUT' });
    await expect(revokeWorkspaceAsset(null as never, { workspaceId, userId: 'nope', hash })).rejects.toMatchObject({ code: 'INVALID_ASSET_INPUT' });
    await expect(prepareWorkspaceAssetUpload(storage, null as never, { ...intent, mime: 'not a mime' })).rejects.toMatchObject({ code: 'INVALID_ASSET_INPUT' });
  });
});
