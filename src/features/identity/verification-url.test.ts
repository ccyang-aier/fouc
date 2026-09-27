import { expect, test } from 'bun:test';
import { resolveVerificationCallback } from './verification-url';

test('desktop verification emails return to the public Web page, never an internal WebView asset address', () => {
  expect(resolveVerificationCallback('http://tauri.localhost', true, 'https://app.fouc.test')).toBe('https://app.fouc.test/auth/verify?status=verified');
  expect(resolveVerificationCallback('http://localhost:3000', false)).toBe('http://localhost:3000/auth/verify?status=verified');
  for (const url of [undefined, 'http://tauri.localhost', 'https://app.test/path', 'https://user:secret@app.test']) {
    expect(() => resolveVerificationCallback('http://tauri.localhost', true, url)).toThrow();
  }
});
