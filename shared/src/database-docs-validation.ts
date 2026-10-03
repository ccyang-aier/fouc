import { DATABASE_DOCS_MAX_ANNOTATION_BYTES, DATABASE_DOCS_MAX_NOTE_BYTES, DATABASE_DOCS_MAX_TABLES, databaseDocsTableKey, type DatabaseDocsAnnotations, type DatabaseDocsAnnotationsUpdate, type DatabaseDocsCollectInput } from './database-docs';

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('数据库文档参数必须是对象');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !keys.includes(key))) throw new Error('数据库文档参数包含未知字段');
  return input;
}
export function databaseDocsName(value: unknown, label = '名称', max = 1024): string {
  if (typeof value !== 'string' || !value || value.length > max || value.includes('\0')) throw new Error(`${label}无效`);
  return value;
}
function note(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.includes('\0') || new TextEncoder().encode(value).length > DATABASE_DOCS_MAX_NOTE_BYTES) throw new Error('Markdown 笔记最多 64 KiB，且不可包含 NUL');
  return value.trim() ? value : null;
}
export function validateDatabaseDocsAnnotations(value: unknown): DatabaseDocsAnnotations {
  const input = object(value, ['formatVersion', 'project', 'groups', 'tables']);
  if (input.formatVersion !== 1) throw new Error('数据库文档笔记格式无效');
  const project = object(input.project, ['name', 'note']);
  if (!Array.isArray(input.groups) || input.groups.length > 128 || !Array.isArray(input.tables) || input.tables.length > DATABASE_DOCS_MAX_TABLES) throw new Error('数据库文档分组 / 表笔记数量超限');
  const groupIds = new Set<string>();
  const groups = input.groups.map(value => {
    const group = object(value, ['id', 'name', 'hue', 'note']), id = databaseDocsName(group.id, '分组 ID', 128);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || groupIds.has(id)) throw new Error('分组 ID 无效或重复'); groupIds.add(id);
    if (typeof group.hue !== 'number' || !Number.isInteger(group.hue) || group.hue < 0 || group.hue > 359) throw new Error('分组色相必须在 0–359');
    return { id, name: databaseDocsName(group.name, '分组名称', 120), hue: group.hue, note: note(group.note) };
  });
  const tableIds = new Set<string>(); let columnCount = 0;
  const tables = input.tables.map(value => {
    const table = object(value, ['schema', 'table', 'note', 'groupId', 'columns']), schema = databaseDocsName(table.schema, 'Schema'), name = databaseDocsName(table.table, '表');
    const key = databaseDocsTableKey(schema, name); if (tableIds.has(key)) throw new Error('表笔记目标重复'); tableIds.add(key);
    const groupId = table.groupId === null ? null : databaseDocsName(table.groupId, '分组 ID', 128);
    if (groupId !== null && !groupIds.has(groupId)) throw new Error('表引用的分组不存在');
    if (!table.columns || typeof table.columns !== 'object' || Array.isArray(table.columns)) throw new Error('字段笔记无效');
    const columns = Object.create(null) as Record<string, string>;
    for (const [name, value] of Object.entries(table.columns)) { databaseDocsName(name, '字段'); if (++columnCount > 10_000) throw new Error('字段笔记最多 10000 条'); const text = note(value); if (text !== null) columns[name] = text; }
    return { schema, table: name, note: note(table.note), groupId, columns };
  });
  const annotations: DatabaseDocsAnnotations = { formatVersion: 1, project: { name: project.name === null ? null : databaseDocsName(project.name, '文档标题', 120), note: note(project.note) }, groups, tables };
  if (new TextEncoder().encode(JSON.stringify(annotations)).length > DATABASE_DOCS_MAX_ANNOTATION_BYTES) throw new Error('本地文档笔记最多 2 MiB');
  return annotations;
}
export function validateDatabaseDocsAnnotationsUpdate(value: unknown): DatabaseDocsAnnotationsUpdate {
  const input = object(value, ['version', 'annotations']);
  const version = input.version === null ? null : databaseDocsName(input.version, '笔记版本', 128);
  return { version, annotations: validateDatabaseDocsAnnotations(input.annotations) };
}
export function validateDatabaseDocsCollectInput(value: unknown): DatabaseDocsCollectInput {
  const input = object(value, ['schemas', 'tables', 'projectName']);
  if (!Array.isArray(input.schemas) || !input.schemas.length || input.schemas.length > 64) throw new Error('请选择 1–64 个 Schema');
  const schemas = [...new Set(input.schemas.map(value => databaseDocsName(value, 'Schema')))];
  if (input.tables !== undefined && (!Array.isArray(input.tables) || input.tables.length > DATABASE_DOCS_MAX_TABLES)) throw new Error('选择的表数量超限');
  const tables = input.tables === undefined ? undefined : (input.tables as unknown[]).map(value => { const table = object(value, ['schema','table']), schema = databaseDocsName(table.schema, 'Schema'); if (!schemas.includes(schema)) throw new Error('表不在选择的 Schema 范围内'); return { schema, table: databaseDocsName(table.table, '表') }; });
  return { schemas, tables, projectName: input.projectName === undefined ? undefined : databaseDocsName(input.projectName, '文档标题', 120) };
}
