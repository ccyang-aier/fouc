/**
 * Organization client error boundary (O02).
 *
 * The organization REST surface (backend/server/src/modules/knowledge/organization/http.ts)
 * answers with `{ code, message }` bodies from a fixed code set plus transport
 * failures. Everything is normalized here into one domain error so UI consumers
 * branch on a stable `code`; Chinese copy for each code lives in this module so
 * every surface renders the same structured message.
 */

export type OrganizationErrorCode =
  // Server-emitted organization codes.
  | 'INVALID_INPUT'
  | 'UNAUTHENTICATED'
  | 'WORKSPACE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'MEMBER_NOT_FOUND'
  | 'GROUP_NOT_FOUND'
  | 'TEAMSPACE_NOT_FOUND'
  | 'TEAMSPACE_NOT_EMPTY'
  | 'LAST_OWNER'
  | 'CONFLICT'
  | 'INVITATION_INVALID'
  // Request-envelope codes emitted by the route middleware.
  | 'INVALID_ORIGIN'
  | 'INVALID_CONTENT_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'ORGANIZATION_UNAVAILABLE'
  // Transport codes produced only by this client.
  | 'NETWORK'
  | 'ENDPOINT'
  | 'TIMEOUT';

export const organizationErrorText: Record<OrganizationErrorCode, string> = {
  INVALID_INPUT: '请求参数不正确，请检查后重试',
  UNAUTHENTICATED: '需要已验证的登录会话才能访问组织信息',
  WORKSPACE_NOT_FOUND: '工作区不存在或不可访问',
  FORBIDDEN: '当前角色没有执行此操作的权限',
  MEMBER_NOT_FOUND: '该成员不存在或已离开工作区',
  GROUP_NOT_FOUND: '该群组不存在或已删除',
  TEAMSPACE_NOT_FOUND: '该团队空间不存在或已删除',
  TEAMSPACE_NOT_EMPTY: '团队空间内仍有页面，清空后才能删除',
  LAST_OWNER: '工作区必须保留至少一名所有者',
  CONFLICT: '操作与当前状态冲突，请刷新后重试',
  INVITATION_INVALID: '邀请已失效',
  INVALID_ORIGIN: '请求来源不受信任',
  INVALID_CONTENT_TYPE: '请求格式不正确',
  PAYLOAD_TOO_LARGE: '请求内容超出大小限制',
  ORGANIZATION_UNAVAILABLE: '组织服务暂不可用，请稍后重试',
  NETWORK: '无法连接组织服务，请检查网络后重试',
  ENDPOINT: '组织服务地址无法解析',
  TIMEOUT: '请求超时，请重试',
};

const serverCodes = new Set<string>([
  'INVALID_INPUT', 'UNAUTHENTICATED', 'WORKSPACE_NOT_FOUND', 'FORBIDDEN', 'MEMBER_NOT_FOUND',
  'GROUP_NOT_FOUND', 'TEAMSPACE_NOT_FOUND', 'TEAMSPACE_NOT_EMPTY', 'LAST_OWNER', 'CONFLICT',
  'INVITATION_INVALID', 'INVALID_ORIGIN', 'INVALID_CONTENT_TYPE', 'PAYLOAD_TOO_LARGE', 'ORGANIZATION_UNAVAILABLE',
]);

export class OrganizationDataError extends Error {
  readonly code: OrganizationErrorCode;
  readonly httpStatus: number | null;

  constructor(code: OrganizationErrorCode, options: { message?: string; httpStatus?: number | null; cause?: unknown } = {}) {
    super(options.message ?? organizationErrorText[code], { cause: options.cause });
    this.name = 'OrganizationDataError';
    this.code = code;
    this.httpStatus = options.httpStatus ?? null;
  }
}

export function isOrganizationDataError(error: unknown): error is OrganizationDataError {
  return error instanceof OrganizationDataError;
}

export function organizationErrorTextOf(error: unknown): string {
  return isOrganizationDataError(error) ? organizationErrorText[error.code] : organizationErrorText.NETWORK;
}

/** Only transient conditions retry; auth, permission and request errors must surface immediately. */
export function isRetryableOrganizationError(error: unknown): boolean {
  return isOrganizationDataError(error) && (error.code === 'NETWORK' || error.code === 'ORGANIZATION_UNAVAILABLE' || error.code === 'TIMEOUT');
}

/** Any error body shape the middleware can emit: `{ code: string, ... }`. */
export function organizationErrorFromBody(status: number, body: unknown): OrganizationDataError {
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && serverCodes.has(code)) {
    return new OrganizationDataError(code as OrganizationErrorCode, { httpStatus: status, message: undefined });
  }
  return new OrganizationDataError('ORGANIZATION_UNAVAILABLE', { httpStatus: status });
}

/**
 * Normalize any failure below this data layer. Endpoint resolution failures from
 * the U01 layer carry their own `code` and map across directly; an aborted
 * signal keeps the original cause so the query layer recognizes cancellation.
 */
export function normalizeOrganizationError(cause: unknown, signal?: AbortSignal): unknown {
  if (signal?.aborted) return cause;
  if (isOrganizationDataError(cause)) return cause;
  const code = (cause as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && serverCodes.has(code)) {
    return new OrganizationDataError(code as OrganizationErrorCode, { cause });
  }
  if (cause instanceof Error) {
    if (cause.name === 'TimeoutError' || cause.name === 'AbortError') return new OrganizationDataError('TIMEOUT', { cause });
    if (typeof code === 'string' && code === 'ENDPOINT') return new OrganizationDataError('ENDPOINT', { cause });
    return new OrganizationDataError('NETWORK', { cause });
  }
  return new OrganizationDataError('NETWORK', { cause });
}
