/**
 * Global Fouc identity error boundary.
 *
 * The auth API is plain Better Auth HTTP (not tRPC): failures arrive as
 * `{ code?, message? }` JSON bodies with a status, or as transport failures.
 * Everything normalizes here into one domain error so auth UI branches on a
 * stable `code` instead of sniffing response internals. The Fouc backend
 * contract (`backend/server/src/platform/identity/README.md`) guarantees sanitized
 * codes/messages; unknown codes degrade instead of leaking internals.
 */

export type FoucAuthErrorCode =
  | 'SESSION_NOT_PERSISTED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_DELIVERY_FAILED'
  | 'AUTH_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'ENDPOINT'
  | 'INVALID_REQUEST';

/** Only transient conditions retry; credential and request errors surface immediately. */
const retryableCodes: ReadonlySet<FoucAuthErrorCode> = new Set([
  'EMAIL_DELIVERY_FAILED',
  'AUTH_UNAVAILABLE',
  'RATE_LIMITED',
  'NETWORK',
]);

export class FoucAuthFlowError extends Error {
  readonly code: FoucAuthErrorCode;
  readonly httpStatus: number | null;
  readonly serverCode: string | null;

  constructor(
    code: FoucAuthErrorCode,
    options: { message?: string; httpStatus?: number | null; serverCode?: string | null; cause?: unknown } = {},
  ) {
    super(options.message ?? defaultAuthErrorMessage(code), { cause: options.cause });
    this.name = 'FoucAuthFlowError';
    this.code = code;
    this.httpStatus = options.httpStatus ?? null;
    this.serverCode = options.serverCode ?? null;
  }
}

export function isFoucAuthFlowError(error: unknown): error is FoucAuthFlowError {
  return error instanceof FoucAuthFlowError;
}

export function isRetryableAuthError(error: unknown): boolean {
  return isFoucAuthFlowError(error) && retryableCodes.has(error.code);
}

/**
 * Every sanitized code the auth seam can emit, mapped to its domain meaning.
 * Server messages stay English diagnostics; the UI renders its own Chinese
 * copy via `authErrorCopy` and never echoes the server text to the user.
 */
const domainByServerCode: Record<string, FoucAuthErrorCode> = {
  // Better Auth 1.7.6 email-password seam; sign-in never distinguishes
  // "user not found" from "wrong password" (A01 anti-enumeration).
  INVALID_EMAIL_OR_PASSWORD: 'INVALID_CREDENTIALS',
  INVALID_PASSWORD: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',
  // Fouc http.ts sanitizes unknown 5xx to AUTH_UNAVAILABLE.
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
  OAUTH_PROVIDER_UNAVAILABLE: 'AUTH_UNAVAILABLE',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'INVALID_REQUEST',
  FAILED_TO_CREATE_USER: 'INVALID_REQUEST',
  FAILED_TO_CREATE_SESSION: 'INVALID_REQUEST',
  INVALID_NAME: 'INVALID_REQUEST',
  INVALID_EMAIL: 'INVALID_REQUEST',
  INVALID_TOKEN: 'INVALID_REQUEST',
  TOKEN_EXPIRED: 'INVALID_REQUEST',
  EMAIL_ALREADY_VERIFIED: 'INVALID_REQUEST',
  EMAIL_MISMATCH: 'INVALID_REQUEST',
  VERIFICATION_EMAIL_NOT_ENABLED: 'INVALID_REQUEST',
  INVALID_ORIGIN: 'INVALID_REQUEST',
  INVALID_CONTENT_TYPE: 'INVALID_REQUEST',
  PAYLOAD_TOO_LARGE: 'INVALID_REQUEST',
  INVALID_CALLBACK_URL: 'INVALID_REQUEST',
  INVALID_OAUTH_REQUEST: 'INVALID_REQUEST',
  PROVIDER_NOT_FOUND: 'INVALID_REQUEST',
};

function domainForStatus(status: number): FoucAuthErrorCode {
  if (status === 401) return 'INVALID_CREDENTIALS';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'AUTH_UNAVAILABLE';
  if (status >= 500) return 'AUTH_UNAVAILABLE';
  return 'INVALID_REQUEST';
}

export function authFlowErrorFromResponse(
  status: number,
  body: unknown,
): FoucAuthFlowError {
  const serverCode = typeof (body as { code?: unknown } | null)?.code === 'string'
    ? (body as { code: string }).code
    : null;
  const code = serverCode && domainByServerCode[serverCode]
    ? domainByServerCode[serverCode]
    : domainForStatus(status);
  return new FoucAuthFlowError(code, { httpStatus: status, serverCode });
}

/** Normalizes any failure below this layer (transport, endpoint, unknown shapes). */
export function normalizeAuthFlowError(cause: unknown): FoucAuthFlowError {
  if (cause instanceof FoucAuthFlowError) return cause;
  const message = cause instanceof Error ? cause.message : undefined;
  // Endpoint resolution failures from the data layer carry their own shape.
  const endpointCode = (cause as { code?: unknown } | null)?.code;
  if (endpointCode === 'ENDPOINT') return new FoucAuthFlowError('ENDPOINT', { cause });
  return new FoucAuthFlowError('NETWORK', { message, cause });
}

const defaultMessages: Record<FoucAuthErrorCode, string> = {
  SESSION_NOT_PERSISTED: 'The browser did not retain the session cookie.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_NOT_VERIFIED: 'This email address has not been verified yet.',
  EMAIL_DELIVERY_FAILED: 'The verification email could not be sent.',
  AUTH_UNAVAILABLE: 'The authentication service is unavailable.',
  RATE_LIMITED: 'Too many attempts.',
  NETWORK: 'The authentication service could not be reached.',
  ENDPOINT: 'The authentication endpoint is not configured.',
  INVALID_REQUEST: 'The request could not be completed.',
};

function defaultAuthErrorMessage(code: FoucAuthErrorCode): string {
  return defaultMessages[code];
}

export type AuthErrorCopy = { title: string; description: string };

/** Fixed Chinese copy per domain code; never built from server-provided text. */
const authErrorCopy: Record<FoucAuthErrorCode, AuthErrorCopy> = {
  SESSION_NOT_PERSISTED: { title: '登录会话未能保存', description: '浏览器没有保存会话，请检查 Cookie 设置后重试。' },
  INVALID_CREDENTIALS: {
    title: '邮箱或密码不正确',
    description: '请检查后重试;若刚注册,请先完成邮箱验证再登录。',
  },
  EMAIL_NOT_VERIFIED: {
    title: '邮箱尚未验证',
    description: '该邮箱已注册但尚未完成验证,请查收验证邮件后再登录。',
  },
  EMAIL_DELIVERY_FAILED: {
    title: '验证邮件暂时未能发送',
    description: '邮件通道暂时不可用,稍后可以在此重新发送。',
  },
  AUTH_UNAVAILABLE: {
    title: '认证服务暂时不可用',
    description: '请稍后重试;若持续出现,请联系管理员。',
  },
  RATE_LIMITED: {
    title: '操作过于频繁',
    description: '为保障账号安全,请等待约一分钟后再试。',
  },
  NETWORK: {
    title: '无法连接认证服务',
    description: '请检查网络连接后重试。',
  },
  ENDPOINT: {
    title: '认证服务地址未配置',
    description: '当前部署缺少认证服务配置,请联系管理员。',
  },
  INVALID_REQUEST: {
    title: '请求未能完成',
    description: '请检查输入后重试;若持续出现,请联系管理员。',
  },
};

export function authErrorCopyFor(error: unknown): AuthErrorCopy {
  const code = isFoucAuthFlowError(error) ? error.code : 'NETWORK';
  return authErrorCopy[code];
}
