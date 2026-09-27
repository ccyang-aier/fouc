import { describe, expect, test } from 'bun:test';
import { readFoucOAuthOptions, validateFoucOAuthOptions } from './oauth-config';

const provider = { id: 'company', kind: 'oidc' as const, name: 'Company SSO', clientId: 'fouc', clientSecret: 'server-only-secret', issuer: 'https://idp.example.test/realm' };
describe('server-owned OAuth configuration', () => {
  test('accepts explicit OIDC/enterprise endpoint origins and defaults to safe network/authentication', () => {
    const value = validateFoucOAuthOptions({ providers: [{ ...provider, endpointOrigins: ['https://keys.example.test'], allowedEmailDomains: ['example.test'] }] }, true);
    expect(value.providers[0]?.allowPrivateNetwork).toBe(false);
    expect(value.providers[0]?.tokenEndpointAuth).toBe('client_secret_basic');
    expect(value.timeoutMs).toBe(8_000);
    expect(readFoucOAuthOptions({})).toEqual({ providers: [] });
  });
  test('rejects duplicate/reserved identifiers, unsafe URLs, client security overrides and insecure production', () => {
    for (const change of [
      { id: 'credential' }, { id: '../callback' }, { issuer: 'http://idp.example.test' },
      { issuer: 'https://user:secret@idp.example.test' }, { issuer: 'https://idp.example.test/#fragment' },
      { issuer: 'https://idp.example.test/?secret=hidden' }, { issuer: 'file:///private' },
      { endpointOrigins: ['https://keys.example.test/path'] }, { allowedEmailDomains: ['*.example.test'] },
      { disableIdTokenNonceBinding: true }, { pkce: false },
    ]) expect(() => validateFoucOAuthOptions({ providers: [{ ...provider, ...change }] })).toThrow('Invalid Fouc authentication configuration');
    expect(() => validateFoucOAuthOptions({ providers: [provider, provider] })).toThrow('oauth.providers');
    expect(() => validateFoucOAuthOptions({ providers: [{ ...provider, issuer: 'http://127.0.0.1:1234' }] }, true)).toThrow('oauth.providers');
  });
  test('malformed secret-bearing deployment JSON is never included in errors', () => {
    for (const value of ['server-only-secret', JSON.stringify([{ ...provider, issuer: 'http://169.254.169.254' }])]) {
      expect(() => readFoucOAuthOptions({ FOUC_AUTH_PROVIDERS: value })).toThrow('Invalid Fouc authentication configuration: FOUC_AUTH_PROVIDERS');
    }
  });
});
