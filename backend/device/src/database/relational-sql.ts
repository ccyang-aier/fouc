/** DBX query_execution_sql: one statement, with server-enforced read isolation. */
export class RelationalInputError extends Error {}
// DBX sql_risk.rs POSTGRES_PROOF_SAFE_FUNCTIONS. User functions, sequence
// mutators, advisory locks, notifications and large-object I/O need separate
// capability/policy approval and cannot inherit a read-only query grant.
const POSTGRES_PURE_FUNCTIONS = new Set(
  `abs age array_agg array_length ascii avg btrim cardinality ceil ceiling
  char_length character_length chr coalesce concat concat_ws count current_catalog current_database current_date
  current_schema current_setting current_time current_timestamp current_user date_part date_trunc decode div encode
  every exp floor format gen_random_uuid greatest left length localtime localtimestamp log lower lpad ltrim max md5 min
  mod now nullif position power repeat replace reverse right round rpad rtrim sha224 sha256 sha384 sha512 sign split_part
  sqrt starts_with strpos string_agg substr substring to_char to_date to_hex to_number to_timestamp trunc unnest upper version`.split(
    /\s+/,
  ),
);
const SQL_GROUPS = new Set(
  'as cast exists filter from in not on over partition select values when where with'.split(' '),
);
export function assertRelationalReadSql(sql: unknown, provider: 'postgres' | 'sqlite' = 'postgres'): string {
  if (typeof sql !== 'string' || !sql.trim() || sql.length > 1_000_000)
    throw new RelationalInputError('SQL 不能为空且不得超过 1 MB');
  let code = '';
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
      code += ' ';
      continue;
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (provider === 'postgres' && sql.startsWith('/*', i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith('*/', i)) {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) throw new RelationalInputError('SQL 注释未闭合');
      code += ' ';
      continue;
    }
    const dollar =
      provider === 'postgres' && sql[i] === '$' && !/[a-zA-Z_0-9$]/.test(sql[i - 1] ?? '')
        ? /^\$(?:[a-zA-Z_]\w*)?\$/.exec(sql.slice(i))?.[0]
        : undefined;
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) throw new RelationalInputError('SQL 文本未闭合');
      i = end + dollar.length;
      code += ' ';
      continue;
    }
    const quote = sql[i];
    if (quote === "'" || quote === '"') {
      const escaped =
        provider === 'postgres' && quote === "'" && /(?:^|[^a-zA-Z_0-9])E$/i.test(sql.slice(0, i));
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === quote) {
          i++;
          if (sql[i] === quote) {
            i++;
            continue;
          }
          closed = true;
          break;
        }
        if (escaped && sql[i] === '\\') i++;
        i++;
      }
      if (!closed) throw new RelationalInputError('SQL 文本未闭合');
      if (provider === 'postgres' && quote === '"' && /^\s*\(/.test(sql.slice(i)))
        throw new RelationalInputError('引用函数尚未证明只读');
      code += quote === '"' ? '__quoted_identifier__' : ' ';
      continue;
    }
    code += sql[i++];
  }
  const statements = code.split(';').filter((entry) => entry.trim());
  if (statements.length !== 1) throw new RelationalInputError('每次只能执行一条 SQL');
  const statement = statements[0]!;
  if (
    !/^\s*(SELECT|WITH|EXPLAIN)\b/i.test(statement) ||
    /\b(ALTER|BEGIN|CALL|COMMIT|COPY|CREATE|DELETE|DETACH|DO|DROP|EXECUTE|GRANT|INSERT|INTO|MERGE|PRAGMA|REINDEX|RELEASE|RESET|REVOKE|ROLLBACK|SAVEPOINT|SET|TRUNCATE|UPDATE|VACUUM|ATTACH|ANALYZE)\b/i.test(
      statement,
    )
  ) {
    throw new RelationalInputError('只读会话禁止写入、事务控制和管理语句');
  }
  if (provider === 'postgres') {
    for (const match of statement.matchAll(/\b((?:[a-zA-Z_][\w$]*\s*\.\s*)?)([a-zA-Z_][\w$]*)\s*\(/g)) {
      const scope = match[1]!.replace(/\s/g, '').toLowerCase();
      const name = match[2]!.toLowerCase();
      if (
        (scope && scope !== 'pg_catalog.') ||
        (!POSTGRES_PURE_FUNCTIONS.has(name) && !SQL_GROUPS.has(name))
      ) {
        throw new RelationalInputError(`函数 ${name} 尚未证明只读`);
      }
    }
  }
  // Quoted semicolons are already masked; substantive text after the only
  // statement separator cannot reach the driver's simple-query protocol.
  const separator = code.indexOf(';');
  if (separator >= 0 && code.slice(separator + 1).trim())
    throw new RelationalInputError('每次只能执行一条 SQL');
  return sql.trim().replace(/;\s*$/, '');
}

export function quoteRelationalIdentifier(value: string): string {
  if (!value.trim() || value.includes('\0') || value.length > 255)
    throw new RelationalInputError('数据库对象名称无效');
  return '"' + value.replaceAll('"', '""') + '"';
}
