import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './connection-options-url.messages';
import { localizedValidationValues } from './values';
const keys = {
  'connection-options-url.connectionUrlContainsAnInvalidPercentEscape':
    'connectionUrlContainsAnInvalidPercentEscape',
  'connection-options-url.acceptsOnlyTrueFalse': 'acceptsOnlyTrueFalse',
  'connection-options-url.mustBeAnInteger': 'mustBeAnInteger',
  'connection-options-url.mustBeInTheRange': 'mustBeInTheRange',
  'connection-options-url.invalidConnectionHost': 'invalidConnectionHost',
  'connection-options-url.theConnectionHostMustBeADnsName': 'theConnectionHostMustBeADnsName',
  'connection-options-url.invalid': 'invalid',
  'connection-options-url.invalidMongodbHostOrConnectionParameters':
    'invalidMongodbHostOrConnectionParameters',
  'connection-options-url.unsupportedMongodbConnectionParameters':
    'unsupportedMongodbConnectionParameters',
  'connection-options-url.invalidMongodbSrvOrHostListParameters':
    'invalidMongodbSrvOrHostListParameters',
  'connection-options-url.invalidMongodbHostListParameters': 'invalidMongodbHostListParameters',
  'connection-options-url.invalidMongodbParameters': 'invalidMongodbParameters',
  'connection-options-url.invalidMongodbUriExtraParameters': 'invalidMongodbUriExtraParameters',
  'connection-options-url.unsupportedMongodbParameters': 'unsupportedMongodbParameters',
  'connection-options-url.invalidReadpreference': 'invalidReadpreference',
  'connection-options-url.theCurrentMongodbAuthmechanismIsNotAvailable':
    'theCurrentMongodbAuthmechanismIsNotAvailable',
  'connection-options-url.duplicateOrConflictingConnectionOptions':
    'duplicateOrConflictingConnectionOptions',
  'connection-options-url.duplicateConnectionOption': 'duplicateConnectionOption',
  'connection-options-url.thisConnectionSettingDisablesServerCertificateValidationWhic':
    'thisConnectionSettingDisablesServerCertificateValidationWhic',
  'connection-options-url.serverCertificateAndHostnameValidationAlwaysRemainEnabled':
    'serverCertificateAndHostnameValidationAlwaysRemainEnabled',
  'connection-options-url.filePathsOrPasswordsAreNotReadFrom': 'filePathsOrPasswordsAreNotReadFrom',
  'connection-options-url.password': 'password',
  'connection-options-url.username': 'username',
  'connection-options-url.theUrlIncludesTwiceRemoveTheDuplicateParameter':
    'theUrlIncludesTwiceRemoveTheDuplicateParameter',
  'connection-options-url.supportsOnlyDisabledTlsOrFullValidationVerify':
    'supportsOnlyDisabledTlsOrFullValidationVerify',
  'connection-options-url.postgresqlOptionsCurrentlySupportOnlyCStatementTimeout':
    'postgresqlOptionsCurrentlySupportOnlyCStatementTimeout',
  'connection-options-url.unsupportedUrlParameterAdjustTheParameterExplicitlyBefore':
    'unsupportedUrlParameterAdjustTheParameterExplicitlyBefore',
  'connection-options-url.invalidDsnParameterName': 'invalidDsnParameterName',
  'connection-options-url.dsnParameterIsMissingAnEqualsSign': 'dsnParameterIsMissingAnEqualsSign',
  'connection-options-url.incompleteDsnBackslashEscape': 'incompleteDsnBackslashEscape',
  'connection-options-url.dsnSingleQuoteIsNotClosed': 'dsnSingleQuoteIsNotClosed',
  'connection-options-url.aSpaceIsRequiredAfterADsnQuote': 'aSpaceIsRequiredAfterADsnQuote',
  'connection-options-url.duplicateDsnParameter': 'duplicateDsnParameter',
  'connection-options-url.connectionUrlDsnMustBeSingleLineText':
    'connectionUrlDsnMustBeSingleLineText',
  'connection-options-url.theCurrentNativeConnectorProvidesLibpqDsnOnly':
    'theCurrentNativeConnectorProvidesLibpqDsnOnly',
  'connection-options-url.port': 'port',
  'connection-options-url.database': 'database',
  'connection-options-url.pasteTheConnectionUrlItselfCommandLineFlags':
    'pasteTheConnectionUrlItselfCommandLineFlags',
  'connection-options-url.onlyPostgresqlMysqlRedisAndMongodbConnectionUrls':
    'onlyPostgresqlMysqlRedisAndMongodbConnectionUrls',
  'connection-options-url.urlTypeDoesNotMatchTheCurrentConnection':
    'urlTypeDoesNotMatchTheCurrentConnection',
  'connection-options-url.connectionAddressContainsAnUnsupportedHostList':
    'connectionAddressContainsAnUnsupportedHostList',
  'connection-options-url.invalidConnectionUrlCheckTheHostIpvBrackets':
    'invalidConnectionUrlCheckTheHostIpvBrackets',
  'connection-options-url.connectionUrlsDoNotSupportFragmentsRemoveSettings':
    'connectionUrlsDoNotSupportFragmentsRemoveSettings',
  'connection-options-url.theDatabasePathSupportsOnlyOneEscapedName':
    'theDatabasePathSupportsOnlyOneEscapedName',
  'connection-options-url.redisDatabaseIndex': 'redisDatabaseIndex',
  'connection-options-url.mongodbSrvRequiresOneDnsHostWithoutA':
    'mongodbSrvRequiresOneDnsHostWithoutA',
  'connection-options-url.multiHostMongodbUrlsMustRetainTheHost':
    'multiHostMongodbUrlsMustRetainTheHost',
  'connection-options-url.theRedissProtocolConflictsWithTheDisabledTls':
    'theRedissProtocolConflictsWithTheDisabledTls',
  'connection-options-url.mongodbSrvDoesNotSupportDirectconnectionTrue':
    'mongodbSrvDoesNotSupportDirectconnectionTrue',
  'connection-options-url.multiHostMongodbUrlsDoNotSupportDirectconnection':
    'multiHostMongodbUrlsDoNotSupportDirectconnection',
  'connection-options-url.urlDsnDoesNotIncludeCertificateContentsRequired':
    'urlDsnDoesNotIncludeCertificateContentsRequired',
  'connection-options-url.customTlsServerNamesAreKeptOnlyIn': 'customTlsServerNamesAreKeptOnlyIn',
  'connection-options-url.theMinimumTlsVersionIsKeptOnlyIn': 'theMinimumTlsVersionIsKeptOnlyIn',
  'connection-options-url.libpqDsnAppliesOnlyToPostgresql': 'libpqDsnAppliesOnlyToPostgresql',
  'connection-options-url.libpqConnectTimeoutCanExpressOnlyWholeSecond':
    'libpqConnectTimeoutCanExpressOnlyWholeSecond',
  'connection-options-url.connectionPoolIdleTimeoutIsNotIncludedIn':
    'connectionPoolIdleTimeoutIsNotIncludedIn',
  'connection-options-url.postgresqlUrlConnectTimeoutCanExpressOnlyWhole':
    'postgresqlUrlConnectTimeoutCanExpressOnlyWhole',
  'connection-options-url.mysqlQueryDeadlinesAreKeptOnlyInAdvanced':
    'mysqlQueryDeadlinesAreKeptOnlyInAdvanced',
  'connection-options-url.connectionPoolIdleTimeoutIsKeptOnlyIn':
    'connectionPoolIdleTimeoutIsKeptOnlyIn',
  'connection-options-url.mongodbHostListsMustContainEntries': 'mongodbHostListsMustContainEntries',
  'connection-options-url.mongodbSrvRequiresASingleDnsHost': 'mongodbSrvRequiresASingleDnsHost',
  'connection-options-url.directconnectionTrueAppliesOnlyToSingleHostMongodb':
    'directconnectionTrueAppliesOnlyToSingleHostMongodb',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
