import { FoucAuthFlowError } from './auth-errors';

/** Email is opened in a system browser. A desktop asset origin cannot be a
 * public email landing page; desktop uses the configured Web deployment. */
export function resolveVerificationCallback(origin: string, desktop: boolean, webUrl?: string): string {
  let target: URL;
  try {
    target = new URL(desktop ? webUrl ?? '' : origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
    if ((target.protocol !== 'https:' && !(target.protocol === 'http:' && local))
      || target.pathname !== '/' || target.search || target.hash || target.username || target.password) throw new Error();
  } catch { throw new FoucAuthFlowError('ENDPOINT'); }
  return `${target.origin}/auth/verify?status=verified`;
}

export function verificationCallbackUrl(): string {
  return resolveVerificationCallback(window.location.origin, '__TAURI__' in window, process.env.NEXT_PUBLIC_FOUC_WEB_URL);
}
