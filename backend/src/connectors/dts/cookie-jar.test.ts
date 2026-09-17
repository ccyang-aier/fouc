import { describe, expect, test } from 'bun:test';
import { CookieJar } from './cookie-jar';

describe('DTS CookieJar', () => {
  test('applies domain, path and secure matching', () => {
    const jar = new CookieJar();
    jar.import([{ name: 'session', value: 'secret', domain: '.xfusion.com', path: '/dts', secure: true, httpOnly: true, expiresAt: Date.now() + 60_000 }]);
    expect(jar.header('https://clouddragon.xfusion.com/dts/DTSPortal/v1/getUserInfo')).toBe('session=secret');
    expect(jar.header('https://clouddragon.xfusion.com/other')).toBe('');
    expect(jar.header('http://clouddragon.xfusion.com/dts')).toBe('');
    expect(jar.header('https://example.com/dts')).toBe('');
  });

  test('parses expiry and removes expired cookies', () => {
    const jar = new CookieJar();
    jar.setFromHeader('a=1; Domain=.xfusion.com; Path=/; Secure; HttpOnly', 'https://clouddragon.xfusion.com/dts');
    jar.setFromHeader('a=; Domain=.xfusion.com; Path=/; Max-Age=0', 'https://clouddragon.xfusion.com/dts');
    expect(jar.header('https://clouddragon.xfusion.com/dts')).toBe('');
  });

  test('keeps same-name cookies on different paths in RFC order', () => {
    const jar = new CookieJar();
    jar.setFromHeader('route=root; Path=/; Secure', 'https://clouddragon.xfusion.com/');
    jar.setFromHeader('route=dts; Path=/dts; Secure', 'https://clouddragon.xfusion.com/dts');
    expect(jar.header('https://clouddragon.xfusion.com/dts/a')).toBe('route=dts; route=root');
  });
});
