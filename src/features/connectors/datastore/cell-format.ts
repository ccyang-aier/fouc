import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './cell-format.messages';
import type { DatabaseCell } from '@fouc/shared';
export function databaseCellText(value: DatabaseCell, locale?: Locale): string {
  const tConnector = createTranslator(connectorMessages, locale);
  if (value === null) return 'NULL';
  if (typeof value === 'object')
    return !Array.isArray(value) && value.type === 'binary'
      ? tConnector('binaryData')
      : JSON.stringify(value);
  return String(value);
}
