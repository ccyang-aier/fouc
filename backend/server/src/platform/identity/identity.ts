import { createMiddleware } from 'hono/factory';
import type { FoucAuth } from './service';
import { hasTrustedFoucOrigin } from './config';

/** Authentication identity only. Workspace membership is checked by tenant services. */
export interface FoucIdentity {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
}

export async function getFoucIdentity(auth: FoucAuth, headers: Headers): Promise<FoucIdentity | null> {
  if (headers.has('authorization')) return null; // Cookie-only: never ignore an explicit credential and fall back.
  const result = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!result?.user.emailVerified) return null;
  return { userId: result.user.id, sessionId: result.session.id, email: result.user.email, name: result.user.name };
}

export function requireFoucIdentity(auth: FoucAuth) {
  return createMiddleware<{ Variables: { identity: FoucIdentity } }>(async (context, next) => {
    context.header('Cache-Control', 'no-store');
    if (!hasTrustedFoucOrigin(context.req.raw, auth.options.trustedOrigins as string[])) return context.json({ code: 'INVALID_ORIGIN', message: 'A trusted Origin is required.' }, 403);
    const identity = await getFoucIdentity(auth, context.req.raw.headers);
    if (!identity) return context.json({ code: 'UNAUTHENTICATED', message: 'Sign in with a verified email to continue.' }, 401);
    context.set('identity', identity);
    await next();
  });
}
