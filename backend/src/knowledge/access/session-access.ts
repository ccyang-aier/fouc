import { and, eq, gt, sql } from 'drizzle-orm';
import type { MemberRole } from '@fouc/shared/knowledge/contracts';
import type { Pool } from 'pg';
import { authSession, authUser, member } from '../../database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import { hasTrustedFoucOrigin } from '../../identity/config';
import { KnowledgeAccessError } from './access-policy';
import type { KnowledgeAccessDiagnostic } from './access-policy';
import { getFoucIdentity } from '../../identity/identity';
import type { FoucIdentity } from '../../identity/identity';
import type { FoucAuth } from '../../identity/service';

export interface KnowledgeAccessDependencies {
  pool: Pool;
  auth: FoucAuth;
  onDiagnostic?: (event: KnowledgeAccessDiagnostic) => void;
}

export async function verifiedRequestSession(auth: FoucAuth, request: Request, mutation = false): Promise<FoucIdentity> {
  const origins = auth.options.trustedOrigins as string[];
  // A request carrying no cookie has nothing to forge: report the missing credential
  // (401, with the RFC 9727 challenge on MCP endpoints) instead of an origin problem.
  if (!request.headers.has('cookie')) throw new KnowledgeAccessError('UNAUTHENTICATED');
  if (!hasTrustedFoucOrigin(request, origins) || (mutation && !request.headers.get('origin'))) {
    throw new KnowledgeAccessError('INVALID_ORIGIN');
  }
  const identity = await getFoucIdentity(auth, request.headers);
  if (!identity) throw new KnowledgeAccessError('UNAUTHENTICATED');
  return identity;
}

/** Recheck live state inside the tenant transaction; never trust a cached role/email. */
export async function activeSessionMember(db: KnowledgeTenantTransaction, workspaceId: string, identity: Pick<FoucIdentity, 'userId' | 'sessionId'>, lock = false): Promise<MemberRole> {
  let query = db.select({ role: member.role }).from(authSession)
    .innerJoin(authUser, eq(authUser.id, authSession.userId))
    .innerJoin(member, and(eq(member.workspaceId, workspaceId), eq(member.userId, authUser.id)))
    .where(and(eq(authSession.id, identity.sessionId), eq(authSession.userId, identity.userId),
      gt(authSession.expiresAt, sql`clock_timestamp()`), eq(authUser.emailVerified, true))).$dynamic();
  if (lock) query = query.for('share');
  const [found] = await query;
  if (!found) throw new KnowledgeAccessError('UNAUTHENTICATED');
  return found.role;
}
