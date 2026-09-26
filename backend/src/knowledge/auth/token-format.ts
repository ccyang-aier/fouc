import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { entityIdSchema } from '@fouc/shared/knowledge/contracts';

const tokenPattern = /^fouc_pat\.([a-f0-9-]{36})\.([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/;
const digest = (token: string) => createHash('sha256').update(token, 'utf8').digest();
export interface KnowledgeTokenProof { workspaceId: string; tokenId: string; hash: Buffer }

/** Locators are public routing hints. Neither UUID authenticates the request. */
export function parseKnowledgeToken(token: string): KnowledgeTokenProof | null {
  const match = tokenPattern.exec(token);
  if (!match || !entityIdSchema.safeParse(match[1]).success || !entityIdSchema.safeParse(match[2]).success) return null;
  const secret = Buffer.from(match[3]!, 'base64url');
  if (secret.length !== 32 || secret.toString('base64url') !== match[3]) return null;
  return { workspaceId: match[1]!, tokenId: match[2]!, hash: digest(token) };
}

export function issueKnowledgeToken(workspaceId: string) {
  const tokenId = randomUUID();
  const token = `fouc_pat.${workspaceId}.${tokenId}.${randomBytes(32).toString('base64url')}`;
  return { tokenId, token, tokenHash: digest(token).toString('hex') };
}

/** Always compare two fixed 32-byte digests, even when no credential was found. */
export function matchesKnowledgeToken(hash: Buffer, storedHash: string | undefined): boolean {
  const valid = typeof storedHash === 'string' && /^[a-f0-9]{64}$/.test(storedHash);
  const expected = valid ? Buffer.from(storedHash, 'hex') : Buffer.alloc(32);
  return timingSafeEqual(hash, expected) && valid;
}
