import { createMiddleware } from 'hono/factory';
import type { KnowledgeAuth } from './service';
import { hasTrustedKnowledgeOrigin } from './config';

/** Authentication identity only. Workspace membership is checked by tenant services. */
export interface KnowledgeIdentity {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
}

export async function getKnowledgeIdentity(auth: KnowledgeAuth, headers: Headers): Promise<KnowledgeIdentity | null> {
  const result = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!result?.user.emailVerified) return null;
  return { userId: result.user.id, sessionId: result.session.id, email: result.user.email, name: result.user.name };
}

export function requireKnowledgeIdentity(auth: KnowledgeAuth) {
  return createMiddleware<{ Variables: { identity: KnowledgeIdentity } }>(async (context, next) => {
    context.header('Cache-Control', 'no-store');
    if (!hasTrustedKnowledgeOrigin(context.req.raw, auth.options.trustedOrigins as string[])) return context.json({ code: 'INVALID_ORIGIN', message: 'A trusted Origin is required.' }, 403);
    const identity = await getKnowledgeIdentity(auth, context.req.raw.headers);
    if (!identity) return context.json({ code: 'UNAUTHENTICATED', message: 'Sign in with a verified email to continue.' }, 401);
    context.set('identity', identity);
    await next();
  });
}
