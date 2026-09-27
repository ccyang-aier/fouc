/**
 * MySQL read-only preflight, adapted from DBX's query_execution_sql scanner and
 * strict read proof. This is a conservative UX guard; the driver must execute
 * accepted SQL inside a server-enforced read-only transaction as well.
 */

const READ_START = new Set(['SELECT', 'WITH', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN']);
const WRITE_WORDS = new Set([
  'ALTER', 'ANALYZE', 'BEGIN', 'CALL', 'COMMIT', 'CREATE', 'DEALLOCATE', 'DELETE',
  'DO', 'DROP', 'EXECUTE', 'FLUSH', 'GRANT', 'HANDLER', 'INSERT', 'KILL', 'LOAD',
  'LOCK', 'MERGE', 'OPTIMIZE', 'PREPARE', 'REPAIR', 'REPLACE', 'RESET', 'REVOKE',
  'ROLLBACK', 'SET', 'TRUNCATE', 'UNLOCK', 'UPDATE', 'USE',
]);

// DBX's reviewed pure MySQL builtins, with SUM added for ordinary aggregates.
const SAFE_FUNCTIONS = new Set(`ABS ASCII AVG BIN CEILING CHAR_LENGTH CHARACTER_LENGTH COALESCE
CONCAT CONCAT_WS CONV COUNT CRC32 CURDATE CURTIME CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP
DATE_FORMAT DATEDIFF DAYNAME DAYOFMONTH DAYOFWEEK DAYOFYEAR EXP FLOOR FORMAT GREATEST HEX
HOUR IF IFNULL INET_ATON INET_NTOA INSTR ISNULL JSON_EXTRACT JSON_LENGTH JSON_UNQUOTE JSON_VALID
LAST_DAY LCASE LEAST LEFT LENGTH LN LOCATE LOG LOG10 LOG2 LOWER LPAD LTRIM MAX MD5 MICROSECOND
MIN MINUTE MOD MONTH MONTHNAME NOW NULLIF OCT ORD POSITION POW POWER QUARTER RAND REPEAT REPLACE
REVERSE RIGHT ROUND RPAD RTRIM SECOND SHA SHA1 SHA2 SIGN SPACE SQRT STR_TO_DATE SUBSTRING SUBSTR
SUM TIME_FORMAT TIMEDIFF TIMESTAMPADD TIMESTAMPDIFF TRUNCATE UNHEX UNIX_TIMESTAMP UPPER UCASE
UTC_DATE UTC_TIME UTC_TIMESTAMP UUID WEEK WEEKDAY YEAR`.split(/\s+/));
const SQL_GROUPS = new Set(['AND', 'AS', 'CASE', 'EXISTS', 'FROM', 'IN', 'NOT', 'ON', 'OR', 'OVER', 'PARTITION', 'SELECT', 'VALUES', 'WHEN', 'WHERE', 'WITH']);

type ScanResult = { code: string; executableComment: boolean; quotedCall: boolean; closed: boolean };

export class MysqlReadOnlySqlError extends Error {}

function reject(message: string): never { throw new MysqlReadOnlySqlError(message); }

function scan(sql: string): ScanResult {
  let code = '';
  let state: 'normal' | 'line' | 'block' | 'single' | 'double' | 'backtick' = 'normal';
  let executableComment = false;
  let quotedCall = false;
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index]!;
    const next = sql[index + 1];
    if (state === 'line') {
      code += ' ';
      if (char === '\n') state = 'normal';
      continue;
    }
    if (state === 'block') {
      code += ' ';
      if (char === '*' && next === '/') { code += ' '; index++; state = 'normal'; }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'backtick') {
      code += ' ';
      if (char === '\\' && next) { code += ' '; index++; continue; }
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (char === quote) {
        if (next === quote) { code += ' '; index++; }
        else {
          if ((state === 'backtick' || state === 'double') && /^\s*\(/.test(sql.slice(index + 1))) quotedCall = true;
          state = 'normal';
        }
      }
      continue;
    }
    if (char === '-' && next === '-') { code += '  '; index++; state = 'line'; continue; }
    if (char === '#') { code += ' '; state = 'line'; continue; }
    if (char === '/' && next === '*') {
      executableComment ||= sql[index + 2] === '!' || (sql[index + 2] === 'M' && sql[index + 3] === '!');
      code += '  '; index++; state = 'block'; continue;
    }
    if (char === "'") state = 'single';
    else if (char === '"') state = 'double';
    else if (char === '`') state = 'backtick';
    code += state === 'normal' ? char : ' ';
  }
  return { code, executableComment, quotedCall, closed: state === 'normal' || state === 'line' };
}

export function assertMysqlReadOnlySql(sql: string): string {
  if (typeof sql !== 'string' || !sql.trim() || sql.length > 1_000_000) reject('SQL 不能为空且不得超过 1 MB');
  const { code, executableComment, quotedCall, closed } = scan(sql);
  if (!closed || executableComment || quotedCall) reject('SQL 包含未闭合文本或无法验证的可执行语法');
  const semicolon = code.indexOf(';');
  if (semicolon >= 0 && (code.slice(semicolon + 1).trim() || code.slice(0, semicolon).includes(';'))) {
    reject('一次只能执行一条 SQL');
  }
  const upper = code.slice(0, semicolon >= 0 ? semicolon : undefined).trim().toUpperCase();
  const words: string[] = upper.match(/[A-Z_][A-Z_0-9]*/g) ?? [];
  if (!READ_START.has(words[0] ?? '')) reject('当前仅支持已验证的只读 SQL');
  if (code.includes(':=') || code.includes('@')) reject('不允许修改或读取会话变量');
  if (words[0] === 'EXPLAIN' && words.includes('ANALYZE')) reject('EXPLAIN ANALYZE 会实际执行语句');
  const showCreate = words[0] === 'SHOW' && words[1] === 'CREATE';
  if (words.some((word, index) => WRITE_WORDS.has(word) && !(showCreate && index === 1))) {
    reject('只读连接禁止写入、管理或事务语句');
  }
  if (words.includes('INTO') || /\bFOR\s+SHARE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b/.test(upper)) {
    reject('SQL 包含写入目标或锁定子句');
  }
  for (const match of upper.matchAll(/\b([A-Z_][A-Z_0-9]*)\s*\(/g)) {
    const name = match[1]!;
    if (!SAFE_FUNCTIONS.has(name) && !SQL_GROUPS.has(name)) reject(`函数 ${name} 尚未证明只读`);
  }
  return sql.trim().replace(/;\s*$/, '').trim();
}
