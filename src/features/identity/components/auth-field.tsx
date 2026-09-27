'use client';

/**
 * Labeled auth input (A04). Styling follows the workspace form language
 * (settings search input): 6px radius, token borders, accent focus. Errors
 * are wired to aria so screen readers announce them with the field.
 */

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function AuthTextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  error,
  hint,
  disabled,
  onInputBlur,
  autoFocus,
  maxLength,
  'data-testid': testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  inputMode?: 'text' | 'email';
  placeholder?: string;
  error?: string | null;
  hint?: string | null;
  disabled?: boolean;
  onInputBlur?: () => void;
  autoFocus?: boolean;
  maxLength?: number;
  'data-testid'?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11.5px] font-medium text-[var(--ink-soft)]">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onInputBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={maxLength}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-10 w-full rounded-[10px] border bg-[var(--panel)] px-3 text-[12.5px] text-[var(--ink)] outline-none',
          'transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-55',
          error ? 'border-[color-mix(in_srgb,var(--err-ink)_45%,var(--line))]' : 'border-[var(--line)]',
        )}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] leading-4 text-[var(--err-ink)]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[11px] leading-4 text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
