import { describe, expect, test } from 'bun:test';
import { readKnowledgeAuthConfig, validateKnowledgeAuthConfig } from './config';
import { createSmtpAuthEmailTransport, createVerificationEmailTransport } from './email';

const defaults = { baseUrl: 'http://localhost:8710', secret: 'a'.repeat(40), trustedOrigins: ['http://localhost:3000'] };

describe('explicit authentication transport configuration', () => {
  test('same-site local Web and HTTPS cross-site desktop are separate valid modes', () => {
    expect(validateKnowledgeAuthConfig(defaults).cookieMode).toBe('same-site');
    const desktop = validateKnowledgeAuthConfig({ ...defaults, baseUrl: 'https://auth.example.test', trustedOrigins: ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'], cookieMode: 'cross-site', production: true });
    expect(desktop.trustedOrigins).toHaveLength(4);
    expect(readKnowledgeAuthConfig({ BETTER_AUTH_URL: defaults.baseUrl, BETTER_AUTH_SECRET: defaults.secret, KNOWLEDGE_ALLOWED_ORIGINS: defaults.trustedOrigins.join(',') }).trustedOrigins).toEqual([defaults.baseUrl, ...defaults.trustedOrigins]);
  });

  test('rejects wildcard, opaque, path, insecure production and impossible cross-site configurations', () => {
    for (const change of [
      { trustedOrigins: ['*'] }, { trustedOrigins: ['null'] }, { trustedOrigins: ['https://example.test/path'] },
      { trustedOrigins: ['https://user:private@example.test'] }, { trustedOrigins: ['http://tauri.localhost'] },
      { cookieMode: 'cross-site' as const }, { production: true }, { baseUrl: 'http://external.example.test' },
      { baseUrl: 'http://localhost:8710/private?secret=value' }, { secret: 'short-secret' },
      { baseUrl: 'https://auth.example.test', production: true, trustedOrigins: ['http://app.example.test'] },
    ]) expect(() => validateKnowledgeAuthConfig({ ...defaults, ...change })).toThrow('Invalid knowledge authentication configuration');
  });

  test('production SMTP must be configured and delivery failures never contain credentials or verification URLs', async () => {
    expect(() => createSmtpAuthEmailTransport({})).toThrow('SMTP_HOST');
    expect(() => createSmtpAuthEmailTransport({ SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_FROM: 'fouc@example.test', SMTP_USERNAME: 'private' })).toThrow('SMTP_USERNAME');
    const email = createVerificationEmailTransport('fouc@example.test', async () => { throw new Error('smtp://password@host verify?token=secret'); });
    await expect(email.sendVerification({ to: 'person@example.test', url: 'https://auth.example.test/verify?token=secret' })).rejects.toThrow('Verification email delivery failed. Please retry later.');
  });
});
