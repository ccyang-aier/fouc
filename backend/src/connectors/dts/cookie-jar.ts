export interface RuntimeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expiresAt: number | null;
  hostOnly: boolean;
}

export type CookieHandoff = Omit<RuntimeCookie, 'hostOnly'> & { hostOnly?: boolean };

export class CookieJar {
  private readonly values = new Map<string, RuntimeCookie>();

  import(cookies: CookieHandoff[]): void {
    for (const cookie of cookies) {
      if (!cookie.name || !cookie.domain || cookie.value.length > 16_384) continue;
      const normalized: RuntimeCookie = {
        ...cookie,
        domain: cookie.domain.replace(/^\./, '').toLowerCase(),
        path: cookie.path || '/',
        expiresAt: cookie.expiresAt ?? null,
        hostOnly: cookie.hostOnly ?? !cookie.domain.startsWith('.'),
      };
      this.set(normalized);
    }
  }

  setFromHeader(header: string, requestUrl: string): void {
    const url = new URL(requestUrl);
    const parts = header.split(';').map((part) => part.trim());
    const pair = parts.shift();
    const split = pair?.indexOf('=') ?? -1;
    if (!pair || split <= 0) return;
    const cookie: RuntimeCookie = {
      name: pair.slice(0, split), value: pair.slice(split + 1), domain: url.hostname.toLowerCase(), path: defaultPath(url.pathname),
      secure: false, httpOnly: false, expiresAt: null, hostOnly: true,
    };
    for (const part of parts) {
      const eq = part.indexOf('=');
      const key = (eq < 0 ? part : part.slice(0, eq)).toLowerCase();
      const value = eq < 0 ? '' : part.slice(eq + 1);
      if (key === 'domain' && value) { cookie.domain = value.replace(/^\./, '').toLowerCase(); cookie.hostOnly = false; }
      else if (key === 'path') cookie.path = value || '/';
      else if (key === 'secure') cookie.secure = true;
      else if (key === 'httponly') cookie.httpOnly = true;
      else if (key === 'max-age') cookie.expiresAt = Date.now() + Number(value) * 1000;
      else if (key === 'expires') { const parsed = Date.parse(value); if (Number.isFinite(parsed)) cookie.expiresAt = parsed; }
    }
    this.set(cookie);
  }

  header(urlValue: string): string {
    const url = new URL(urlValue);
    const now = Date.now();
    return [...this.values.values()]
      .filter((cookie) => {
        if (cookie.expiresAt != null && cookie.expiresAt <= now) return false;
        if (cookie.secure && url.protocol !== 'https:') return false;
        const domain = cookie.hostOnly ? url.hostname === cookie.domain : url.hostname === cookie.domain || url.hostname.endsWith(`.${cookie.domain}`);
        const path = url.pathname === cookie.path || url.pathname.startsWith(cookie.path.endsWith('/') ? cookie.path : `${cookie.path}/`);
        return domain && path;
      })
      .sort((a, b) => b.path.length - a.path.length)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  clear(): void { this.values.clear(); }
  get size(): number { return this.values.size; }

  private set(cookie: RuntimeCookie): void {
    const key = `${cookie.domain}\n${cookie.path}\n${cookie.name}`;
    if (!cookie.value || (cookie.expiresAt != null && cookie.expiresAt <= Date.now())) this.values.delete(key);
    else this.values.set(key, cookie);
  }
}

function defaultPath(pathname: string): string {
  if (!pathname.startsWith('/') || pathname === '/') return '/';
  const index = pathname.lastIndexOf('/');
  return index <= 0 ? '/' : pathname.slice(0, index);
}
