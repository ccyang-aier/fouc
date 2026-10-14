import { createUiMessages } from '../../i18n/ui-message';
import { createTranslator, type Locale } from '@/lib/i18n';
import { messages as connectorMessages } from './pem-file.messages';
import { CONNECTION_OPTIONS_LIMITS } from '@fouc/shared/connection-options';
const connectorUiMessages = createUiMessages(connectorMessages);

export type ConnectionPemKind = 'caPem' | 'certificatePem' | 'privateKeyPem';
/** Read the actual selected Web file, rather than forwarding an unusable browser path. */
export async function readConnectionPem(
  file: File,
  kind: ConnectionPemKind,
  locale?: Locale,
): Promise<string> {
  const tConnector = createTranslator(connectorMessages, locale);
  if (file.size > CONNECTION_OPTIONS_LIMITS.pemBytes)
    throw connectorUiMessages.error('pemFilesMustNotExceedKib');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw connectorUiMessages.error('theFileCannotBeReadAsUtfTextChooseA');
  }
  if (text.includes('\0')) throw connectorUiMessages.error('thePemFileContainsInvalidCharacters');
  const expression =
    kind === 'privateKeyPem'
      ? /^\s*-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----\s*$/
      : /^\s*-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/;
  if (!expression.test(text))
    throw new Error(
      kind === 'privateKeyPem'
        ? tConnector('chooseAPemClientPrivateKey')
        : tConnector('chooseAPemCertificateFile'),
    );
  return text;
}
