import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './connection-config-transfer-crypto.messages';
import { localizedValidationValues } from './values';
const keys = {
  'connection-config-transfer-crypto.webcryptoIsUnavailableInThisBrowserOpenOver':
    'webcryptoIsUnavailableInThisBrowserOpenOver',
  'connection-config-transfer-crypto.encryptionPasswordsMustContainCharacters':
    'encryptionPasswordsMustContainCharacters',
  'connection-config-transfer-crypto.encryptedConfigurationContainsInvalidBaseData':
    'encryptedConfigurationContainsInvalidBaseData',
  'connection-config-transfer-crypto.invalidEncryptedConfigurationLengthOrEncoding':
    'invalidEncryptedConfigurationLengthOrEncoding',
  'connection-config-transfer-crypto.encryptedConfigurationMustBeAnObject':
    'encryptedConfigurationMustBeAnObject',
  'connection-config-transfer-crypto.encryptedConfigurationFormatVersionOrEncryptionParametersAre':
    'encryptedConfigurationFormatVersionOrEncryptionParametersAre',
  'connection-config-transfer-crypto.configurationFilesMustNotExceedMib':
    'configurationFilesMustNotExceedMib',
  'connection-config-transfer-crypto.configurationFileIsNotValidJson':
    'configurationFileIsNotValidJson',
  'connection-config-transfer-crypto.decryptionFailedThePasswordIsIncorrectOrThe':
    'decryptionFailedThePasswordIsIncorrectOrThe',
  'connection-config-transfer-crypto.decryptedConfigurationIsNotValidUtfText':
    'decryptedConfigurationIsNotValidUtfText',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
