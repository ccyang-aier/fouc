import { getLocale, translate, type Locale, type MessageCatalog } from '@/lib/i18n';
import { isValidationIssue, type ValidationIssue } from '@fouc/shared';
import { formatValidationIssue, validationErrorText } from '../datastore/validation';

type UiValue = string | number | Error | ValidationIssue | UiDescriptor;
type UiValues = Readonly<Record<string, UiValue>>;
export type UiDescriptor = {
  readonly catalog: MessageCatalog;
  readonly key: string;
  readonly values?: UiValues;
};
export type UiMessage = string | Error | ValidationIssue | UiDescriptor;
type MessageSlots<Text extends string> = Text extends `${string}{${infer Slot}}${infer Rest}`
  ? Slot | MessageSlots<Rest>
  : never;
type ValuesFor<Catalog extends MessageCatalog, Key extends keyof Catalog> = Readonly<
  Record<MessageSlots<Catalog[Key][0] | Catalog[Key][1]>, UiValue>
>;

/** A UI producer binds its own catalog before storing a message or throwing an error. */
export function createUiMessages<Catalog extends MessageCatalog>(catalog: Catalog) {
  function message<Key extends keyof Catalog & string>(
    key: Key,
    values?: ValuesFor<Catalog, Key>,
  ): UiDescriptor {
    return { catalog, key, values };
  }
  function error<Key extends keyof Catalog & string>(
    key: Key,
    values?: ValuesFor<Catalog, Key>,
  ): UiError {
    return new UiError(message(key, values));
  }
  return { message, error };
}

export class UiError extends Error {
  constructor(readonly uiMessage: UiDescriptor) {
    super(uiText(uiMessage, getLocale()));
    this.name = 'UiError';
  }
}

/** Only explicit descriptors and domain issue codes localize; source text stays unchanged. */
export function uiText(input: unknown, locale: Locale): string {
  if (input instanceof UiError) return uiText(input.uiMessage, locale);
  if (isValidationIssue(input)) return formatValidationIssue(input, locale);
  if (
    input instanceof Error ||
    (input && typeof input === 'object' && 'issue' in input && isValidationIssue(input.issue))
  )
    return validationErrorText(input, locale);
  if (input && typeof input === 'object' && 'catalog' in input && 'key' in input) {
    const message = input as UiDescriptor;
    const values =
      message.values &&
      Object.fromEntries(
        Object.entries(message.values).map(([key, value]) => [
          key,
          typeof value === 'object' ? uiText(value, locale) : value,
        ]),
      );
    return translate(message.catalog, message.key, values, locale);
  }
  return String(input ?? '');
}

export function uiFailure(error: unknown): UiMessage {
  return error instanceof UiError
    ? error.uiMessage
    : error instanceof Error || isValidationIssue(error)
      ? error
      : String(error);
}
