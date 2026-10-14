import { expect, test } from 'bun:test';
import { readConnectionPem } from './pem-file';

test('browser PEM upload reads the selected UTF-8 bytes and rejects unusable files', async () => {
  const certificate = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n';
  expect(await readConnectionPem(new File([certificate], 'ca.pem'), 'caPem')).toBe(certificate);
  expect(
    await readConnectionPem(
      new File(
        ['-----BEGIN ENCRYPTED PRIVATE KEY-----\nTEST\n-----END ENCRYPTED PRIVATE KEY-----'],
        'client.key',
      ),
      'privateKeyPem',
    ),
  ).toContain('ENCRYPTED PRIVATE KEY');
  await expect(
    readConnectionPem(new File([new Uint8Array([255, 254])], 'ca.pem'), 'caPem'),
  ).rejects.toThrow('UTF-8');
  await expect(
    readConnectionPem(new File([certificate], 'key.pem'), 'privateKeyPem'),
  ).rejects.toThrow('私钥');
  await expect(
    readConnectionPem(new File([new Uint8Array(262145)], 'large.pem'), 'caPem'),
  ).rejects.toThrow('256 KiB');
});
