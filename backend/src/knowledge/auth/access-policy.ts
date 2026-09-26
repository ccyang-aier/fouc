import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import { z } from 'zod';

/** Scopes match operations exactly; write does not imply read or administration. */
export const knowledgeTokenScopes = Object.freeze(['read', 'write'] as const);
export type KnowledgeTokenScope = typeof knowledgeTokenScopes[number];
export const tokenScopesSchema = z.array(z.enum(knowledgeTokenScopes)).min(1).max(knowledgeTokenScopes.length)
  .refine((scopes) => new Set(scopes).size === scopes.length);
export const tokenWorkspaceSchema = entityIdSchema.transform((value) => value.toLowerCase());
export const createKnowledgeTokenInputSchema = z.strictObject({
  workspaceId: tokenWorkspaceSchema,
  name: z.string().trim().min(1).max(120),
  scopes: tokenScopesSchema,
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
});
export const revokeKnowledgeTokenInputSchema = z.strictObject({ workspaceId: tokenWorkspaceSchema, tokenId: entityIdSchema });

const failures = {
  UNAUTHENTICATED: { status: 401, message: 'Valid workspace credentials are required.' },
  INSUFFICIENT_SCOPE: { status: 403, message: 'This credential does not allow the requested operation.' },
  INVALID_ORIGIN: { status: 403, message: 'A trusted Origin is required.' },
  INVALID_TOKEN_INPUT: { status: 400, message: 'Invalid personal access token request.' },
  AUTH_UNAVAILABLE: { status: 503, message: 'Authentication is temporarily unavailable.' },
} as const;
export type KnowledgeAccessErrorCode = keyof typeof failures;
export type KnowledgeAccessDiagnostic = 'access_denied' | 'access_unavailable';

export class KnowledgeAccessError extends Error {
  readonly status: typeof failures[KnowledgeAccessErrorCode]['status'];
  constructor(readonly code: KnowledgeAccessErrorCode) {
    super(failures[code].message);
    this.name = 'KnowledgeAccessError';
    this.status = failures[code].status;
  }
}

/** Never retain SQL errors, parameters, request headers, or credential text as causes. */
export async function sanitizedAccess<T>(operation: () => Promise<T>, diagnostic?: (event: KnowledgeAccessDiagnostic) => void): Promise<T> {
  try { return await operation(); }
  catch (error) {
    const failure = error instanceof KnowledgeAccessError ? error : new KnowledgeAccessError('AUTH_UNAVAILABLE');
    // An observer failure must not replace the deliberately sanitized auth error.
    try { diagnostic?.(failure.code === 'AUTH_UNAVAILABLE' ? 'access_unavailable' : 'access_denied'); } catch { /* no raw logger errors */ }
    throw failure;
  }
}

export function knowledgeAccessErrorResponse(error: unknown): Response {
  const failure = error instanceof KnowledgeAccessError ? error : new KnowledgeAccessError('AUTH_UNAVAILABLE');
  return Response.json({ code: failure.code, message: failure.message }, {
    status: failure.status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(failure.status === 401 ? { 'WWW-Authenticate': 'Bearer realm="knowledge"' } : {}) },
  });
}
