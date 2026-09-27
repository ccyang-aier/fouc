import { expect, test } from 'bun:test';
import { sameSiteDevelopmentOrigin } from './fouc-api-endpoint';

test('localhost and IPv4 loopback share the browser cookie site across every Fouc API', () => {
  const dev = (browserOrigin: string) => ({ isProduction: () => false, browserOrigin: () => browserOrigin });
  expect(sameSiteDevelopmentOrigin('http://127.0.0.1:8711', dev('http://localhost:3000'))).toBe('http://localhost:8711');
  expect(sameSiteDevelopmentOrigin('http://localhost:8711', dev('http://127.0.0.1:3000'))).toBe('http://127.0.0.1:8711');
  expect(sameSiteDevelopmentOrigin('https://api.fouc.example', dev('http://localhost:3000'))).toBe('https://api.fouc.example');
  expect(sameSiteDevelopmentOrigin('http://127.0.0.1:8711', { ...dev('http://localhost:3000'), isProduction: () => true })).toBe('http://127.0.0.1:8711');
});
