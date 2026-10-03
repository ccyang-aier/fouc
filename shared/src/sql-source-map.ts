/** UTF-16 source coordinates survive SQL template expansion and statement splitting. */
export interface MappedSql { sql: string; origins: number[]; ends: number[]; end: number }
export interface SqlSourceEdit { from: number; to: number; text: string }
export function sourceSql(sql: string): MappedSql {
  return { sql, origins: Array.from({ length: sql.length }, (_, index) => index), ends: Array.from({ length: sql.length }, (_, index) => index + 1), end: sql.length };
}
export function editMappedSql(source: MappedSql, edits: SqlSourceEdit[]): MappedSql {
  const parts: string[] = [], origins: number[] = [], ends: number[] = [];
  let cursor = 0;
  let length = source.sql.length;
  for (const edit of edits) {
    if (edit.from < cursor || edit.to < edit.from || edit.to > source.sql.length) throw new Error('SQL 源码编辑区间无效');
    length += edit.text.length - (edit.to - edit.from);
    if (length > 1_000_000) throw new Error('展开后的 SQL 超过 1 MB');
    parts.push(source.sql.slice(cursor, edit.from), edit.text);
    for (let index = cursor; index < edit.from; index++) { origins.push(source.origins[index]); ends.push(source.ends[index]); }
    const origin = source.origins[edit.from] ?? source.end;
    const end = source.ends[edit.to - 1] ?? origin;
    for (let index = 0; index < edit.text.length; index++) { origins.push(origin); ends.push(end); }
    cursor = edit.to;
  }
  parts.push(source.sql.slice(cursor));
  for (let index = cursor; index < source.sql.length; index++) { origins.push(source.origins[index]); ends.push(source.ends[index]); }
  return { sql: parts.join(''), origins, ends, end: source.end };
}
export function sqlSourceEnd(source: MappedSql, position: number): number {
  return source.ends[Math.max(0, Math.min(position, source.sql.length)) - 1] ?? 0;
}
export function sqlSourcePosition(source: MappedSql, position: number): number {
  return source.origins[Math.max(0, Math.min(position, source.sql.length))] ?? source.end;
}
