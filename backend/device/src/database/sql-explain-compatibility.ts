export interface MysqlExplainCompatibilityHint { fallbackSql?: string; supportsJson: boolean }

/** DBX's explicit format-capability fallback: retry another EXPLAIN, never the source query. */
export function mysqlExplainCompatibilityHint(error: unknown, explainSql: string): MysqlExplainCompatibilityHint | undefined {
  const message = error instanceof Error ? error.message : String(error);
  if (!/invalid\s+explain\s+option/i.test(message)) return undefined;
  const options = /valid\s+options\s+are\s*:\s*\[([^\]]+)\]/i.exec(message);
  if (!options) return undefined;
  const formats = new Set(options[1].split(',').map((format) => format.trim().replace(/^['"`]|['"`]$/g, '').toUpperCase()).filter(Boolean));
  const prefix = /^EXPLAIN\s+FORMAT\s*=\s*[A-Z_]+\s+/i;
  if (!prefix.test(explainSql)) return { supportsJson: formats.has('JSON') };
  const fallback = formats.has('TRADITIONAL') ? 'EXPLAIN FORMAT=TRADITIONAL ' : 'EXPLAIN ';
  const fallbackSql = explainSql.replace(prefix, fallback);
  return { supportsJson: formats.has('JSON'), fallbackSql: fallbackSql === explainSql ? undefined : fallbackSql };
}
