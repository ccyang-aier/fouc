import { afterEach, expect, test } from 'bun:test';
import {
  DEFAULT_SQL_SNIPPETS,
  ValidationError,
  validateSqlSnippets,
  validationIssue,
} from '@fouc/shared';
import {
  validateStructureDataType,
  validateStructureIdentifier,
} from '@fouc/shared/relational-structure-edit';
import { parseConnectionSource } from '@fouc/shared/connection-options-url';
import { parseTableImport } from '@fouc/shared/table-import';
import { setLocale } from '@/lib/i18n';
import { sqlFunctionRegistry } from '../sql-assistance/functions/registry';
import { sqlSnippetLabel, sqlSnippetTemplate } from '../sql-snippet-completion';
import {
  connectorCategoryLabel,
  connectorPresentation,
  initialConnectors,
} from '../../connectors-data';
import { formatValidationIssue, validationErrorText } from './index';

afterEach(() => {
  setLocale('zh-CN');
});

test('shared validation uses stable codes while messages follow the active locale', () => {
  let failure: unknown;
  try {
    validateSqlSnippets([{ ...DEFAULT_SQL_SNIPPETS[0], prefix: 'bad prefix' }]);
  } catch (error) {
    failure = error;
  }
  expect(failure instanceof ValidationError).toBe(true);
  const issue = (failure as ValidationError).issue;
  expect(issue.code).toContain('sql-snippets.');
  expect(validationErrorText(failure, 'zh-CN')).toContain('1 至 64');
  expect(validationErrorText(failure, 'en-US')).toContain('1–64');
  expect((failure as ValidationError).issue).toBe(issue);

  const identifier = validateStructureIdentifier('x'.repeat(64), 'postgres')!;
  expect(formatValidationIssue(identifier, 'en-US')).toBe(
    'PostgreSQL names must not exceed 63 UTF-8 bytes',
  );
  expect(validateStructureDataType('TEXT; DROP TABLE account', 'postgres')).not.toBeNull();
  expect(validateStructureDataType('NUMERIC(30,12)[]', 'postgres')).toBeNull();
});

test('nested structured issues localize labels without changing connection fields or secrets', () => {
  let failure: unknown;
  try {
    parseConnectionSource('mysql://localhost/db?password=a&password=b');
  } catch (error) {
    failure = error;
  }
  expect(validationErrorText(failure, 'en-US')).toContain('password');
  expect(validationErrorText(failure, 'en-US')).not.toMatch(/[\u3400-\u9fff]/);
  const parsed = parseConnectionSource(
    'postgresql://reader:PrivateSecret@localhost/app?sslmode=verify-full',
  );
  expect(parsed.fields.username).toBe('reader');
  expect(parsed.fields.password).toBe('PrivateSecret');
  expect(parsed.fields.database).toBe('app');
});

test('import diagnostics retain source coordinates and structured bilingual errors', () => {
  const parsed = parseTableImport('INSERT INTO sample (id) VALUES (1 + 2);', {
    format: 'sql',
    sqlDialect: 'sqlite',
    titleRow: 0,
  });
  expect(parsed.rows).toHaveLength(0);
  expect(parsed.errors).not.toHaveLength(0);
  expect(parsed.errors[0].line).toBe(1);
  expect(parsed.errors[0].column).toBeGreaterThan(0);
  expect(validationErrorText(parsed.errors[0], 'en-US')).not.toMatch(/[\u3400-\u9fff]/);
  expect(validationErrorText(parsed.errors[0], 'zh-CN')).toMatch(/[\u3400-\u9fff]/);
});

test('unknown codes do not resolve inherited catalog keys or translate user text', () => {
  for (const code of ['constructor', '__proto__', 'toString', 'not-a-known-code']) {
    expect(formatValidationIssue(validationIssue(code, 'User SQL diagnostic'), 'en-US')).toBe(
      'User SQL diagnostic',
    );
  }
  expect(validationErrorText(new Error('用户数据'), 'en-US')).toBe('用户数据');
});

test('built-in connector and snippet presentation preserves canonical state and SQL', () => {
  const connector = initialConnectors.find((item) => item.id === 'connector-feishu')!;
  const english = connectorPresentation(connector, 'en-US');
  expect(english.name).toBe('Feishu');
  expect(english.category).toBe('办公协同');
  expect(connectorCategoryLabel(connector.category, 'en-US')).toBe('Collaboration');
  expect(connector.name).toBe('飞书');
  expect(connector.description).toMatch(/[\u3400-\u9fff]/);
  const builtin = DEFAULT_SQL_SNIPPETS.find((item) => item.id === 'builtin-cte')!;
  expect(sqlSnippetLabel(builtin, 'zh-CN')).toBe('公共表表达式');
  expect(sqlSnippetLabel(builtin, 'en-US')).toBe('common table expression');
  expect(sqlSnippetTemplate(builtin)).toContain('WITH');
  const custom = { ...builtin, label: '用户自己的名称', body: "SELECT 'MixedCase';" };
  expect(sqlSnippetLabel(custom, 'en-US')).toBe(custom.label);
  expect(sqlSnippetTemplate(custom)).toBe(custom.body);
  expect(sqlFunctionRegistry('mysql', 'zh-CN').get('COUNT')?.description).toMatch(
    /[\u3400-\u9fff]/,
  );
  expect(sqlFunctionRegistry('mysql', 'en-US').get('COUNT')?.description).toBe(
    'Returns the number of rows',
  );
});
