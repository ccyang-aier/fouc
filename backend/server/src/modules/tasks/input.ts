import type { z } from 'zod';
import { ResourceRequestError, parseInput } from '../../platform/resources/errors';

/** Route parameters and body each have a strict schema; neither can overwrite
 * the other's fields, including direct service callers in integration tests.
 */
export function taskRequest<S extends z.ZodObject, B extends z.ZodType>(scopeSchema: S, bodySchema: B, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ResourceRequestError('INVALID_INPUT', '请求格式无效。', 400);
  const keys = new Set(Object.keys(scopeSchema.shape));
  const scope = Object.fromEntries(Object.entries(input).filter(([key]) => keys.has(key)));
  const body = Object.fromEntries(Object.entries(input).filter(([key]) => !keys.has(key)));
  return { scope: parseInput(scopeSchema, scope), data: parseInput(bodySchema, body) };
}
