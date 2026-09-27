import type { PageScope, PermissionLevel } from '@fouc/shared/knowledge/contracts';
import type { KnowledgeTenantTransaction } from '../../../platform/database/knowledge/tenant';
import { authorizePageAccess } from '../permissions/authorization';
import { KnowledgeCommentError } from './errors';

/**
 * Every comment operation re-authorizes inside its own transaction against the
 * freshly materialized ACL: denials and rebuild fences both fail closed here.
 * userId must come from verified session authority, never a request body.
 */
export async function requireCommentAccess(
  db: KnowledgeTenantTransaction,
  input: { userId: string; scope: PageScope; required: PermissionLevel },
): Promise<void> {
  const decision = await authorizePageAccess(db, input);
  if (decision.decision !== 'allow') throw new KnowledgeCommentError('COMMENT_ACCESS_DENIED');
}
