import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { KnowledgePatSummary, MemberRole } from '@fouc/shared/knowledge/contracts';
import { authUser, member, personalAccessToken } from '../../database/knowledge/schema';
import { withKnowledgeTenant } from '../../database/knowledge/tenant';
import { createKnowledgeTokenInputSchema, KnowledgeAccessError, revokeKnowledgeTokenInputSchema, sanitizedAccess, tokenScopesSchema, tokenWorkspaceSchema } from './access-policy';
import type { KnowledgeTokenScope } from './access-policy';
import { activeSessionMember, verifiedRequestSession } from './session-access';
import type { KnowledgeAccessDependencies } from './session-access';
import { issueKnowledgeToken, matchesKnowledgeToken, parseKnowledgeToken } from './token-format';
import type { KnowledgeTokenProof } from './token-format';

const metadataColumns = {
  workspaceId: personalAccessToken.workspaceId, id: personalAccessToken.id, name: personalAccessToken.name,
  scopes: personalAccessToken.scopes, createdAt: personalAccessToken.createdAt,
  expiresAt: personalAccessToken.expiresAt, revokedAt: personalAccessToken.revokedAt, lastUsedAt: personalAccessToken.lastUsedAt,
};
type StoredTokenMetadata = Pick<typeof personalAccessToken.$inferSelect, keyof typeof metadataColumns>;
export type KnowledgeTokenSummary = KnowledgePatSummary;

function summary(value: StoredTokenMetadata): KnowledgeTokenSummary {
  return Object.freeze({
    workspaceId: value.workspaceId, id: value.id, name: value.name,
    scopes: Object.freeze(tokenScopesSchema.parse(value.scopes)),
    createdAt: value.createdAt.toISOString(), expiresAt: value.expiresAt?.toISOString() ?? null,
    revokedAt: value.revokedAt?.toISOString() ?? null, lastUsedAt: value.lastUsedAt?.toISOString() ?? null,
  });
}

/** Management is session-only and scoped to the current user's tokens, even for owners. */
export function createKnowledgeTokenService(dependencies: KnowledgeAccessDependencies) {
  const run = <T>(operation: () => Promise<T>) => sanitizedAccess(operation, dependencies.onDiagnostic);
  return {
    create(request: Request, input: unknown) {
      return run(async () => {
        const identity = await verifiedRequestSession(dependencies.auth, request, true);
        const parsed = createKnowledgeTokenInputSchema.safeParse(input);
        if (!parsed.success) throw new KnowledgeAccessError('INVALID_TOKEN_INPUT');
        const value = parsed.data;
        return withKnowledgeTenant(dependencies.pool, value.workspaceId, async (db) => {
          await activeSessionMember(db, value.workspaceId, identity, true);
          if (value.expiresAt !== null) {
            const result = await db.execute<{ valid: boolean }>(sql`SELECT ${value.expiresAt}::timestamptz > clock_timestamp() AS valid`);
            if (!result.rows[0]?.valid) throw new KnowledgeAccessError('INVALID_TOKEN_INPUT');
          }
          const issued = issueKnowledgeToken(value.workspaceId);
          const [stored] = await db.insert(personalAccessToken).values({
            workspaceId: value.workspaceId, id: issued.tokenId, userId: identity.userId, name: value.name,
            scopes: value.scopes, expiresAt: value.expiresAt ? new Date(value.expiresAt) : null, tokenHash: issued.tokenHash,
          }).returning(metadataColumns);
          // The plaintext is not retained by this service or recoverable from list().
          return Object.freeze({ token: issued.token, metadata: summary(stored!) });
        });
      });
    },
    list(request: Request, workspaceId: string) {
      return run(async () => {
        const identity = await verifiedRequestSession(dependencies.auth, request);
        const parsed = tokenWorkspaceSchema.safeParse(workspaceId);
        if (!parsed.success) throw new KnowledgeAccessError('INVALID_TOKEN_INPUT');
        return withKnowledgeTenant(dependencies.pool, parsed.data, async (db) => {
          await activeSessionMember(db, parsed.data, identity, true);
          const tokens = await db.select(metadataColumns).from(personalAccessToken)
            .where(and(eq(personalAccessToken.workspaceId, parsed.data), eq(personalAccessToken.userId, identity.userId)))
            .orderBy(desc(personalAccessToken.createdAt), personalAccessToken.id);
          return Object.freeze(tokens.map(summary));
        });
      });
    },
    revoke(request: Request, input: unknown) {
      return run(async () => {
        const identity = await verifiedRequestSession(dependencies.auth, request, true);
        const parsed = revokeKnowledgeTokenInputSchema.safeParse(input);
        if (!parsed.success) throw new KnowledgeAccessError('INVALID_TOKEN_INPUT');
        const { workspaceId, tokenId } = parsed.data;
        await withKnowledgeTenant(dependencies.pool, workspaceId, async (db) => {
          await activeSessionMember(db, workspaceId, identity, true);
          await db.update(personalAccessToken).set({ revokedAt: sql`clock_timestamp()` }).where(and(
            eq(personalAccessToken.workspaceId, workspaceId), eq(personalAccessToken.id, tokenId),
            eq(personalAccessToken.userId, identity.userId), isNull(personalAccessToken.revokedAt),
          ));
        });
        // Idempotent and non-enumerating: unknown and another user's IDs look alike.
        return Object.freeze({ revoked: true as const });
      });
    },
  };
}

export interface VerifiedKnowledgeToken {
  userId: string;
  tokenId: string;
  role: MemberRole;
  scopes: KnowledgeTokenScope[];
  proof: KnowledgeTokenProof;
}

/** Private authentication bootstrap: no identity discovery or business reads here. */
export async function verifyKnowledgeToken(dependencies: KnowledgeAccessDependencies, token: string, workspaceId: string): Promise<VerifiedKnowledgeToken> {
  const locator = parseKnowledgeToken(token);
  if (!locator || locator.workspaceId !== workspaceId) throw new KnowledgeAccessError('UNAUTHENTICATED');
  return verifyKnowledgeTokenProof(dependencies, locator);
}

/** Internal only: refresh receives this proof from the authenticator's private WeakMap. */
export async function verifyKnowledgeTokenProof(dependencies: KnowledgeAccessDependencies, locator: KnowledgeTokenProof): Promise<VerifiedKnowledgeToken> {
  const workspaceId = locator.workspaceId;
  return withKnowledgeTenant(dependencies.pool, locator.workspaceId, async (db) => {
    // Only the token's composite locator is queried under its RLS tenant. A public
    // locator is not authorization; the secret and live user/membership are mandatory.
    const [found] = await db.select({ token: personalAccessToken,
      active: sql<boolean>`${personalAccessToken.revokedAt} IS NULL AND (${personalAccessToken.expiresAt} IS NULL OR ${personalAccessToken.expiresAt} > clock_timestamp())`,
    }).from(personalAccessToken)
      .where(and(eq(personalAccessToken.workspaceId, locator.workspaceId), eq(personalAccessToken.id, locator.tokenId)))
      .for('update');
    const matches = matchesKnowledgeToken(locator.hash, found?.token.tokenHash);
    const scopes = tokenScopesSchema.safeParse(found?.token.scopes);
    if (!matches || !found?.active || !scopes.success) throw new KnowledgeAccessError('UNAUTHENTICATED');
    const [membership] = await db.select({ role: member.role }).from(member)
      .innerJoin(authUser, eq(authUser.id, member.userId))
      .where(and(eq(member.workspaceId, workspaceId), eq(member.userId, found.token.userId), eq(authUser.emailVerified, true)))
      .for('share');
    if (!membership) throw new KnowledgeAccessError('UNAUTHENTICATED');
    const used = await db.update(personalAccessToken).set({ lastUsedAt: sql`clock_timestamp()` }).where(and(
      eq(personalAccessToken.workspaceId, workspaceId), eq(personalAccessToken.id, locator.tokenId), isNull(personalAccessToken.revokedAt),
      or(isNull(personalAccessToken.expiresAt), sql`${personalAccessToken.expiresAt} > clock_timestamp()`),
    )).returning({ id: personalAccessToken.id });
    if (!used.length) throw new KnowledgeAccessError('UNAUTHENTICATED');
    return { userId: found.token.userId, tokenId: locator.tokenId, role: membership.role, scopes: scopes.data, proof: locator };
  });
}
