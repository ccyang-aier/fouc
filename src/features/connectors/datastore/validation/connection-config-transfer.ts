import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './connection-config-transfer.messages';
import { localizedValidationValues } from './values';
const keys = {
  'connection-config-transfer.mustBeAnObject': 'mustBeAnObject',
  'connection-config-transfer.containsUnsupportedFields': 'containsUnsupportedFields',
  'connection-config-transfer.invalid': 'invalid',
  'connection-config-transfer.host': 'host',
  'connection-config-transfer.theHostMustBeADnsOrIp': 'theHostMustBeADnsOrIp',
  'connection-config-transfer.theHostMustBeAValidDnsOr': 'theHostMustBeAValidDnsOr',
  'connection-config-transfer.advancedConnectionParameters': 'advancedConnectionParameters',
  'connection-config-transfer.advancedConnectionParametersAreMissing':
    'advancedConnectionParametersAreMissing',
  'connection-config-transfer.tlsParameters': 'tlsParameters',
  'connection-config-transfer.publicTlsParametersCertificatesPrivateKeysAndPasswords':
    'publicTlsParametersCertificatesPrivateKeysAndPasswords',
  'connection-config-transfer.tlsParametersAreMissing': 'tlsParametersAreMissing',
  'connection-config-transfer.connectionEntry': 'connectionEntry',
  'connection-config-transfer.connectionName': 'connectionName',
  'connection-config-transfer.connectionConfiguration': 'connectionConfiguration',
  'connection-config-transfer.sqliteConfiguration': 'sqliteConfiguration',
  'connection-config-transfer.sqliteFilePath': 'sqliteFilePath',
  'connection-config-transfer.sqliteFilePathsMustBeAbsolute': 'sqliteFilePathsMustBeAbsolute',
  'connection-config-transfer.configurationContainsANativeConnectionTypeThatIs':
    'configurationContainsANativeConnectionTypeThatIs',
  'connection-config-transfer.publicConnectionConfigurationPasswordsAndUrisAreNot':
    'publicConnectionConfigurationPasswordsAndUrisAreNot',
  'connection-config-transfer.port': 'port',
  'connection-config-transfer.username': 'username',
  'connection-config-transfer.redisDatabaseIndex': 'redisDatabaseIndex',
  'connection-config-transfer.databaseName': 'databaseName',
  'connection-config-transfer.mongodbAuthenticationDatabase': 'mongodbAuthenticationDatabase',
  'connection-config-transfer.invalidMongodbDatabaseName': 'invalidMongodbDatabaseName',
  'connection-config-transfer.mongodbHostListDoesNotMatchThePrimary':
    'mongodbHostListDoesNotMatchThePrimary',
  'connection-config-transfer.mongodbAuthenticationDatabaseHasTwoConflictingSettings':
    'mongodbAuthenticationDatabaseHasTwoConflictingSettings',
  'connection-config-transfer.configurationFile': 'configurationFile',
  'connection-config-transfer.onlyTheCurrentFoucConfigurationFileFormatAnd':
    'onlyTheCurrentFoucConfigurationFileFormatAnd',
  'connection-config-transfer.exportTime': 'exportTime',
  'connection-config-transfer.invalidConfigurationFileExportTime':
    'invalidConfigurationFileExportTime',
  'connection-config-transfer.configurationFilesMustContainConnections':
    'configurationFilesMustContainConnections',
  'connection-config-transfer.invalidConfiguration': 'invalidConfiguration',
  'connection-config-transfer.connection': 'connection',
  'connection-config-transfer.publicConnectionConfigurationExceedsTheMibLimit':
    'publicConnectionConfigurationExceedsTheMibLimit',
  'connection-config-transfer.publicConfigurationFilesMustNotExceedMib':
    'publicConfigurationFilesMustNotExceedMib',
  'connection-config-transfer.configurationFileIsNotValidJson': 'configurationFileIsNotValidJson',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
