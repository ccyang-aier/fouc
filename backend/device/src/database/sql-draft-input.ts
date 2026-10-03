import { SQL_DRAFT_MAX_BYTES, type SqlDraftSnapshot, type SqlDraftTab, type SqlResultView } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { sqlDocument, sqlNullable, sqlObject, sqlText } from './sql-library-input';

const outputViews = new Set<SqlResultView>(['table', 'text', 'json', 'chart', 'summary', 'messages']);
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new DatabaseInputError('SQL 标签状态无效');
  return value;
}
function positionNumber(value: unknown, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) throw new DatabaseInputError('SQL 编辑位置无效');
  return value;
}

/** Whitelist durable state: no query results, execution locks or arbitrary UI payloads. */
export function sqlDraftSnapshot(value: unknown): SqlDraftSnapshot {
  const input = sqlObject(value);
  if (!Array.isArray(input.tabs)) throw new DatabaseInputError('SQL 标签列表无效');
  const ids = new Set<string>();
  const tabs: SqlDraftTab[] = input.tabs.map((item) => {
    const tab = sqlObject(item), id = sqlText(tab.id, 'SQL 标签 ID', 128);
    if (ids.has(id)) throw new DatabaseInputError('SQL 标签 ID 不能重复');
    ids.add(id);
    const sql = sqlDocument(tab.sql), originalSql = sqlDocument(tab.originalSql), position = sqlObject(tab.editorPosition);
    const resultView = tab.resultView as SqlResultView;
    if (!outputViews.has(resultView)) throw new DatabaseInputError('SQL 结果视图无效');
    let savedFile: SqlDraftTab['savedFile'] = null;
    if (tab.savedFile !== null) {
      const file = sqlObject(tab.savedFile);
      savedFile = { id: sqlText(file.id, 'SQL 文件 ID', 128), version: sqlText(file.version, 'SQL 文件版本', 128), name: sqlText(file.name, 'SQL 文件名称', 200), folderId: sqlNullable(file.folderId, 'SQL 文件夹') };
    }
    return {
      id, title: sqlText(tab.title, 'SQL 标签名称', 200), customTitle: flag(tab.customTitle), pinned: flag(tab.pinned),
      database: sqlText(tab.database, '数据库', 1024, true), schema: sqlNullable(tab.schema, 'Schema'),
      sql, originalSql, savedFile, resultView,
      editorPosition: {
        anchor: Math.min(sql.length, positionNumber(position.anchor, true)), head: Math.min(sql.length, positionNumber(position.head, true)),
        scrollTop: positionNumber(position.scrollTop), scrollLeft: positionNumber(position.scrollLeft),
      },
    };
  });
  const activeTabId = input.activeTabId === null ? null : sqlText(input.activeTabId, '活动 SQL 标签', 128);
  if ((tabs.length === 0) !== (activeTabId === null) || (activeTabId !== null && !ids.has(activeTabId))) throw new DatabaseInputError('活动 SQL 标签必须属于当前列表');
  const snapshot = { tabs, activeTabId };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > SQL_DRAFT_MAX_BYTES) throw new DatabaseInputError('完整 SQL 草稿最多 64 MiB，请保存或关闭部分标签后重试');
  return snapshot;
}
