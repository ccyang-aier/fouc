import type { z } from 'zod';

export type OrganizationErrorCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'WORKSPACE_NOT_FOUND' | 'FORBIDDEN' | 'MEMBER_NOT_FOUND' | 'GROUP_NOT_FOUND' | 'LAST_OWNER' | 'CONFLICT' | 'INVITATION_INVALID';

export class OrganizationError extends Error {
  constructor(readonly code: OrganizationErrorCode, message: string, readonly status: 400 | 401 | 403 | 404 | 409) {
    super(message);
    this.name = 'OrganizationError';
  }
}

export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OrganizationError('INVALID_INPUT', 'Invalid organization request.', 400);
  return parsed.data;
}

export function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? postgresCode(error.cause) : undefined;
}

export function organizationFailure(error: unknown): OrganizationError | undefined {
  if (error instanceof OrganizationError) return error;
  if (postgresCode(error) === '23505') return new OrganizationError('CONFLICT', 'This organization record already exists.', 409);
  return undefined;
}
