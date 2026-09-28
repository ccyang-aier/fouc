import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { hasTrustedFoucOrigin } from '../../platform/identity/config';
import { requireFoucIdentity } from '../../platform/identity/identity';
import type { FoucIdentity } from '../../platform/identity/identity';
import type { FoucAuth } from '../../platform/identity/service';
import { OrganizationError, organizationFailure } from './errors';

type WorkspaceEnvironment = { Variables: { identity: FoucIdentity } };
export const workspaceApiBase = '/api/workspaces';

export async function bodyWithPath(context: Context, path: Record<string, string> = {}) {
  let body: unknown;
  try { body = await context.req.json(); } catch { throw new OrganizationError('INVALID_INPUT', 'A JSON object is required.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(path).some((key) => key in body)) {
    throw new OrganizationError('INVALID_INPUT', 'Request scope must be provided only in the URL.', 400);
  }
  return { ...body, ...path };
}

export function pagination(context: Context) {
  const values = context.req.query();
  return { ...values, ...(values.limit === undefined ? {} : { limit: Number(values.limit) }) };
}

/** One authenticated HTTP boundary for workspace and nested resource routes. */
export function createWorkspaceApi(auth: FoucAuth) {
  const app = new Hono<WorkspaceEnvironment>();
  const origins = auth.options.trustedOrigins as string[];
  app.use(`${workspaceApiBase}/*`, async (context, next) => {
    context.header('Cache-Control', 'no-store');
    context.header('Referrer-Policy', 'no-referrer');
    if (!hasTrustedFoucOrigin(context.req.raw, origins)) return context.json({ code: 'INVALID_ORIGIN', message: 'A trusted Origin is required.' }, 403);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method) && context.req.header('content-type')?.split(';')[0]?.trim() !== 'application/json') {
      return context.json({ code: 'INVALID_CONTENT_TYPE', message: 'JSON requests are required.' }, 415);
    }
    await next();
  });
  app.use(`${workspaceApiBase}/*`, cors({ origin: (origin) => origins.includes(origin) ? origin : undefined, credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 600 }));
  app.use(`${workspaceApiBase}/*`, bodyLimit({ maxSize: 16 * 1_024, onError: (context) => context.json({ code: 'PAYLOAD_TOO_LARGE', message: 'Organization request is too large.' }, 413) }));
  app.use(`${workspaceApiBase}/*`, requireFoucIdentity(auth));
  app.onError((error, context) => {
    const known = organizationFailure(error);
    return known ? context.json({ code: known.code, message: known.message }, known.status)
      : context.json({ code: 'ORGANIZATION_UNAVAILABLE', message: 'Organization service is temporarily unavailable.', retryable: true }, 503);
  });
  return app;
}
