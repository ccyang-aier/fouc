export type ValidationValue = string | number | ValidationIssue | readonly ValidationValue[];

export interface ValidationIssue {
  code: string;
  values: Readonly<Record<string, ValidationValue>>;
  message: string;
}

export type ValidationFormatter = (issue: ValidationIssue) => string;

/** Machine-readable validation; native callers retain the same default diagnostic text. */
export function validationIssue(
  code: string,
  template: string,
  values: Readonly<Record<string, ValidationValue>> = {},
): ValidationIssue {
  const message = template.replace(
    /\{\{([^{}]*)\}\}|\{(\w+)\}/g,
    (_match, literal: string | undefined, key: string | undefined) => {
      if (literal !== undefined) return `{${literal}}`;
      const value = values[key!];
      return isValidationIssue(value)
        ? value.message
        : Array.isArray(value)
          ? value.map((item) => (isValidationIssue(item) ? item.message : String(item))).join('; ')
          : String(value ?? '');
    },
  );
  return { code, values, message };
}

export function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Partial<ValidationIssue>;
  return (
    typeof issue.code === 'string' &&
    typeof issue.message === 'string' &&
    !!issue.values &&
    typeof issue.values === 'object'
  );
}

export function validationValue(value: unknown): ValidationValue {
  return isValidationIssue(value)
    ? value
    : Array.isArray(value)
      ? value.map(validationValue)
      : typeof value === 'number'
        ? value
        : String(value);
}

export function validationIssueFromError(error: unknown): ValidationIssue {
  if (isValidationIssue(error)) return error;
  if (error && typeof error === 'object' && 'issue' in error && isValidationIssue(error.issue))
    return error.issue;
  return validationIssue('validation.unexpected', '{message}', {
    message:
      error instanceof Error
        ? error.message
        : error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string'
          ? error.message
          : String(error),
  });
}

export const defaultValidationMessage: ValidationFormatter = (issue) => issue.message;

export class ValidationError extends Error {
  readonly issue: ValidationIssue;
  constructor(issue: ValidationIssue) {
    super(issue.message);
    this.name = 'ValidationError';
    this.issue = issue;
  }
}

export class ValidationAbortError extends DOMException {
  readonly issue: ValidationIssue;
  constructor(issue: ValidationIssue) {
    super(issue.message, 'AbortError');
    this.issue = issue;
  }
}
