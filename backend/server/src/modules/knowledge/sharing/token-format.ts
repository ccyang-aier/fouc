import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { entityIdSchema } from '@fouc/shared/knowledge/contracts';

const tokenPattern = /^fouc_share\.([a-f0-9-]{36})\.([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/;
const digest = (token: string) => createHash('sha256').update(token, 'utf8').digest();
export interface ShareTokenProof { workspaceId: string; shareId: string; hash: Buffer }

/** Locators are public routing hints. Neither UUID authenticates the request. */
export function parseShareToken(token: string): ShareTokenProof | null {
  const match = tokenPattern.exec(token);
  if (!match || !entityIdSchema.safeParse(match[1]).success || !entityIdSchema.safeParse(match[2]).success) return null;
  const secret = Buffer.from(match[3]!, 'base64url');
  if (secret.length !== 32 || secret.toString('base64url') !== match[3]) return null;
  return { workspaceId: match[1]!, shareId: match[2]!, hash: digest(token) };
}

export function issueShareToken(workspaceId: string) {
  const shareId = randomUUID();
  const token = `fouc_share.${workspaceId}.${shareId}.${randomBytes(32).toString('base64url')}`;
  return { shareId, token, tokenHash: digest(token).toString('hex') };
}

/** Always compare two fixed 32-byte digests, even when no credential was found. */
export function matchesShareToken(hash: Buffer, storedHash: string | undefined): boolean {
  const valid = typeof storedHash === 'string' && /^[a-f0-9]{64}$/.test(storedHash);
  const expected = valid ? Buffer.from(storedHash, 'hex') : Buffer.alloc(32);
  return timingSafeEqual(hash, expected) && valid;
}
