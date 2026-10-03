import { expect, test } from 'bun:test';
import { compareSchemaSearchHits, matchSchemaSearchText, rankSchemaSearchHit, type SchemaSearchHit } from './schema-search';
const hit = (name: string, kind: SchemaSearchHit['kind'] = 'table'): Omit<SchemaSearchHit, 'match'> => ({ id: name, schema: 'public', kind, name, label: name, parentName: kind === 'column' ? 'users' : null, column: kind === 'column' ? name : null, dataType: kind === 'column' ? 'TEXT' : null, comment: null, object: null, relation: null });
test('quick-open exact names, initials, camelCase word prefixes, Unicode and literal wildcards', () => {
  expect(matchSchemaSearchText('users', 'users')).toMatchObject({ kind: 'exact', score: 1 });
  expect(matchSchemaSearchText('UP', 'user_profile')).toMatchObject({ kind: 'initials', indices: [0, 5] });
  expect(matchSchemaSearchText('uspro', 'userProfile')).toMatchObject({ kind: 'word-prefix', indices: [0, 1, 4, 5, 6] });
  expect(matchSchemaSearchText('档案', '用户档案')).toMatchObject({ kind: 'substring', indices: [2, 3] });
  expect(matchSchemaSearchText('%', 'tax%_rules')).toMatchObject({ kind: 'substring' });
  expect(matchSchemaSearchText('UP', 'user_profile', true)).toBeNull();
  expect(matchSchemaSearchText('u', 'value')).toMatchObject({ kind: 'substring' });
  expect(matchSchemaSearchText('z', 'value')).toBeNull();
});
test('an exact field outranks table prefix; qualified field paths preserve navigation identity', () => {
  const exact = rankSchemaSearchHit({ query: 'email' }, hit('email', 'column'))!, table = rankSchemaSearchHit({ query: 'email' }, hit('email_log'))!;
  expect([table, exact].sort(compareSchemaSearchHits)[0].kind).toBe('column');
  const qualified = rankSchemaSearchHit({ query: 'public.users.email' }, hit('email', 'column'))!;
  expect(qualified.match.field).toBe('path'); expect(qualified.parentName).toBe('users'); expect(qualified.column).toBe('email');
  const comment = rankSchemaSearchHit({ query: '客户' }, { ...hit('users'), comment: '客户记录' })!;
  expect(comment.match.field).toBe('comment'); expect(comment.match.text).toBe('客户记录');
});
