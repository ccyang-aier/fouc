import type { ValidationIssue } from '@fouc/shared';

export class DatabaseInputError extends Error {
  constructor(
    message: string,
    readonly issue?: ValidationIssue,
  ) {
    super(message);
  }
}
