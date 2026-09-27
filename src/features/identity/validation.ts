/**
 * Auth form validation (A04) — pure functions, mirroring the backend limits
 * in Better Auth 1.7.6 as assembled by A01: password 12–128 characters,
 * user name 1–120 after trim, practical email shape. Field errors are
 * user-facing Chinese strings so panels stay free of branching logic.
 */

export type AuthFieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

export const authPasswordMinLength = 12;
export const authPasswordMaxLength = 128;
export const authNameMaxLength = 120;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return '请输入邮箱地址';
  if (email.length > 320) return '邮箱地址过长';
  if (!emailPattern.test(email)) return '邮箱地址格式不正确';
  return null;
}

export function validateAuthPassword(raw: string): string | null {
  if (!raw) return '请输入密码';
  if (raw.length < authPasswordMinLength) return `密码至少 ${authPasswordMinLength} 位`;
  if (raw.length > authPasswordMaxLength) return `密码不能超过 ${authPasswordMaxLength} 位`;
  return null;
}

export function validateAuthName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return '请输入名称';
  if (name.length > authNameMaxLength) return `名称不能超过 ${authNameMaxLength} 个字符`;
  return null;
}

/** Client-side gate for sign-in; the server still revalidates everything. */
export function validateSignInForm(input: { email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = validateAuthEmail(input.email);
  if (email) errors.email = email;
  const password = validateAuthPassword(input.password);
  if (password) errors.password = password;
  return errors;
}

export function validateSignUpForm(input: { name: string; email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const name = validateAuthName(input.name);
  if (name) errors.name = name;
  const email = validateAuthEmail(input.email);
  if (email) errors.email = email;
  const password = validateAuthPassword(input.password);
  if (password) errors.password = password;
  return errors;
}

export function hasAuthFieldErrors(errors: AuthFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
