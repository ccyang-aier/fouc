export type SqlSnippet = { id: string; label: string; prefix: string; body: string; enabled: boolean };

export const SQL_SNIPPET_MAX_COUNT = 256;
export const SQL_SNIPPET_MAX_BODY_BYTES = 64 * 1024;
export const SQL_SNIPPET_MAX_PREFIX_LENGTH = 64;

/** Return independent rows so editing a connection cannot mutate the built-in catalog. */
export function defaultSqlSnippets(): SqlSnippet[] {
  return DEFAULT_SQL_SNIPPETS.map((snippet) => ({ ...snippet }));
}

/** Validate persisted completions before they can replace an owning connection's catalog. */
export function validateSqlSnippets(value: unknown): SqlSnippet[] {
  if (!Array.isArray(value) || value.length > SQL_SNIPPET_MAX_COUNT) {
    throw new Error(`SQL 代码片段最多 ${SQL_SNIPPET_MAX_COUNT} 个`);
  }
  const ids = new Set<string>();
  const prefixes = new Set<string>();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("SQL 代码片段格式无效");
    const row = item as Record<string, unknown>;
    if (Object.keys(row).length !== 5 || !Object.keys(row).every((key) => ["id", "label", "prefix", "body", "enabled"].includes(key))) {
      throw new Error("SQL 代码片段须包含完整的 ID、名称、前缀、SQL 和启用状态");
    }
    if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 128 || /[\s\x00-\x1f\x7f]/u.test(row.id)) {
      throw new Error("SQL 代码片段 ID 无效");
    }
    if (typeof row.label !== "string" || !row.label.trim() || row.label.length > 200 || /[\x00-\x1f\x7f]/u.test(row.label)) {
      throw new Error("SQL 代码片段名称需为 1 至 200 个字符");
    }
    if (typeof row.prefix !== "string" || !row.prefix || row.prefix.length > SQL_SNIPPET_MAX_PREFIX_LENGTH || !/^[\p{L}\p{N}_$-]+$/u.test(row.prefix)) {
      throw new Error("SQL 代码片段前缀需为 1 至 64 个字母、数字、下划线、美元符号或连字符");
    }
    if (typeof row.body !== "string" || !row.body.trim() || row.body.includes("\0") || encoder.encode(row.body).byteLength > SQL_SNIPPET_MAX_BODY_BYTES) {
      throw new Error("SQL 代码片段内容不能为空，且最多 64 KiB");
    }
    if ([row.id, row.label, row.prefix, row.body].some((text) => decoder.decode(encoder.encode(text)) !== text)) {
      throw new Error("SQL 代码片段须为有效 UTF-8");
    }
    if (typeof row.enabled !== "boolean") throw new Error("SQL 代码片段启用状态无效");
    if (ids.has(row.id)) throw new Error("SQL 代码片段 ID 不能重复");
    const prefixKey = row.prefix.toLowerCase();
    if (prefixes.has(prefixKey)) throw new Error("SQL 代码片段前缀不能重复");
    ids.add(row.id);
    prefixes.add(prefixKey);
    return { id: row.id, label: row.label, prefix: row.prefix, body: row.body, enabled: row.enabled };
  });
}


/**
 * Built-in SQL snippets shared by database types.
 *
 * Database-specific bodies are resolved at completion time so the stored
 * defaults remain portable and existing user-customized bodies stay intact.
 */
export const DEFAULT_SQL_SNIPPETS: SqlSnippet[] = [
  {
    id: "builtin-sel",
    label: "select *",
    prefix: "sel",
    body: "SELECT * FROM table LIMIT 100;",
    enabled: true,
  },
  {
    id: "builtin-ins",
    label: "insert into",
    prefix: "ins",
    body: "INSERT INTO table (columns) VALUES (values);",
    enabled: true,
  },
  {
    id: "builtin-upd",
    label: "update set",
    prefix: "upd",
    body: "UPDATE table SET column = value WHERE condition;",
    enabled: true,
  },
  {
    id: "builtin-cte",
    label: "common table expression",
    prefix: "cte",
    body: "WITH name AS (\n  SELECT columns\n  FROM table\n)\nSELECT *\nFROM name;",
    enabled: true,
  },
  {
    id: "builtin-join",
    label: "join",
    prefix: "join",
    body: "JOIN table ON left_column = right_column",
    enabled: true,
  },
  {
    id: "builtin-case",
    label: "case when",
    prefix: "case",
    body: "CASE WHEN condition THEN value ELSE default END",
    enabled: true,
  },
  {
    id: "builtin-ct",
    label: "create table",
    prefix: "ct",
    body: "CREATE TABLE table (\n  column type\n);",
    enabled: true,
  },
  {
    id: "builtin-ex",
    label: "exists",
    prefix: "ex",
    body: "EXISTS (SELECT 1 FROM table WHERE condition)",
    enabled: true,
  },
  {
    id: "builtin-nex",
    label: "not exists",
    prefix: "nex",
    body: "NOT EXISTS (SELECT 1 FROM table WHERE condition)",
    enabled: true,
  },
  {
    id: "builtin-at",
    label: "alter table add column",
    prefix: "at",
    body: "ALTER TABLE table ADD COLUMN column type;",
    enabled: true,
  },
  {
    id: "builtin-ci",
    label: "create index",
    prefix: "ci",
    body: "CREATE INDEX idx_name ON table (column);",
    enabled: true,
  },
];
