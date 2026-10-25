import { expect, test } from 'bun:test';
import { readFoucServiceConfig } from './config';

const base = {
  DATABASE_URL: 'postgresql://app:private@localhost:55432/fouc', BETTER_AUTH_URL: 'http://localhost:8710', BETTER_AUTH_SECRET: 'a'.repeat(32),
};

test('account and project service starts without optional object storage', () => {
  expect(readFoucServiceConfig(base).storage).toBeUndefined();
  expect(readFoucServiceConfig(base).port).toBe(8711);
});

test('partial object storage configuration is rejected without exposing secrets', () => {
  expect(() => readFoucServiceConfig({ ...base, S3_ENDPOINT: 'http://localhost:59000' })).toThrow('S3_REGION');
  const storage = { S3_ENDPOINT: 'http://localhost:59000', S3_REGION: 'us-east-1', S3_BUCKET: 'fouc', S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'private' };
  expect(readFoucServiceConfig({ ...base, ...storage }).storage?.bucket).toBe('fouc');
});

test('invalid endpoints, origins, and ports never echo credential values', () => {
  for (const change of [{ DATABASE_URL: 'http://password-should-not-be-logged' }, { BETTER_AUTH_URL: 'password-should-not-be-logged' }, { FOUC_SERVICE_PORT: '0' }, { FOUC_AUTH_TRUSTED_ORIGINS: '*' }, { FOUC_AUTH_TRUSTED_ORIGINS: 'https://example.com/path' }]) {
    let message = '';
    try { readFoucServiceConfig({ ...base, ...change }); } catch (error) { message = (error as Error).message; }
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain('password-should-not-be-logged');
  }
  expect(readFoucServiceConfig({ ...base, FOUC_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000,https://example.com' }).auth.trustedOrigins).toEqual(['http://localhost:8710', 'http://localhost:3000', 'https://example.com']);
});
