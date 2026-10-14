import { createTranslator, type Locale } from '@/lib/i18n';
import type { SchemaSearchKind } from '@fouc/shared';
import { messages } from './labels.messages';

export function schemaObjectLabel(kind: SchemaSearchKind, locale: Locale): string {
  return createTranslator(messages, locale)(kind);
}
