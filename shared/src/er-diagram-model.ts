import type { RelationalTableStructure } from './relational-structure';
import type { ErDiagramColumn, ErDiagramEdge, ErDiagramModel, ErDiagramNode } from './er-diagram';

/** Unlike bare schema.table strings, this key preserves dots/quotes and connection isolation. */
export function erDiagramNodeId(connectionId: string, schema: string, table: string): string { return JSON.stringify([connectionId, schema, table]); }
function containsUniqueKey(structure: RelationalTableStructure, columns: string[]): boolean {
  const includes = (keys: string[]) => keys.length > 0 && keys.every((key) => columns.includes(key));
  if (structure.constraints.some((constraint) => ['primary', 'unique'].includes(constraint.kind) && includes(constraint.columns))) return true;
  if (includes(structure.columns.filter((column) => column.isPrimaryKey).map((column) => column.name))) return true;
  return structure.indexes.some((index) => index.unique && index.valid !== false && !index.predicate && index.parts.filter((part) => part.role === 'key').length > 0 && index.parts.filter((part) => part.role === 'key').every((part) => part.column && !part.expression && !part.prefixLength) && includes(index.parts.filter((part) => part.role === 'key').map((part) => part.column!)));
}
/** DBX ER metadata/cardinality adapted to composite native FKs; no same-name inferred relationships. */
export function buildErDiagram(structures: readonly RelationalTableStructure[]): ErDiagramModel {
  if (!structures.length) throw new Error('ER 图需要至少一份真实表结构');
  if (structures.length > 200 || structures.reduce((count, structure) => count + structure.columns.length, 0) > 20000) throw new Error('ER 图最多加载 200 个对象 / 20000 个字段，请缩小选择');
  const first = structures[0], model: ErDiagramModel = { connectionId: first.connectionId, provider: first.provider, schemas: [], nodes: [], edges: [], issues: [] };
  const catalog = new Map<string, RelationalTableStructure>(), nodes = new Map<string, ErDiagramNode>();
  for (const structure of structures) {
    if (structure.connectionId !== first.connectionId || structure.provider !== first.provider) throw new Error('ER 图不能混合不同连接或 Provider 的元数据');
    const id = erDiagramNodeId(first.connectionId, structure.schema, structure.table);
    if (catalog.has(id)) throw new Error('ER 图结构对象重复');
    catalog.set(id, structure);
    const columns: ErDiagramColumn[] = structure.columns.map((column) => ({ name: column.name, dataType: column.dataType, nullable: column.isNullable, primary: column.isPrimaryKey, unique: column.isUnique, foreign: structure.foreignKeys.some((key) => key.columns.includes(column.name)), generated: /^(?:generated|(?:stored|virtual) generated)$/i.test(column.extra ?? ''), default: column.columnDefault, comment: column.comment }));
    const node: ErDiagramNode = { id, schema: structure.schema, table: structure.table, kind: structure.kind, columns, comment: structure.properties.comment ?? null, external: false };
    nodes.set(id, node); model.nodes.push(node);
    for (const warning of structure.definition.warnings) model.issues.push({ nodeId: id, message: warning });
  }
  const edgeIds = new Set<string>();
  for (const [sourceId, structure] of catalog) {
    for (const foreign of structure.foreignKeys) {
      const targetSchema = foreign.referencedSchema || structure.schema, targetId = erDiagramNodeId(first.connectionId, targetSchema, foreign.referencedTable);
      const targetStructure = catalog.get(targetId);
      const edgeId = JSON.stringify([sourceId, foreign.name, foreign.columns, targetId, foreign.referencedColumns]);
      if (edgeIds.has(edgeId)) continue; edgeIds.add(edgeId);
      if (model.edges.length >= 4000) throw new Error('ER 图最多显示 4000 条真实外键，请缩小选择');
      if (foreign.columns.length !== foreign.referencedColumns.length || !foreign.columns.length) { model.issues.push({ nodeId: sourceId, message: `外键 ${foreign.name} 的复合列元数据不完整，未绘制` }); continue; }
      if (!nodes.has(targetId)) {
        if (nodes.size >= 400) throw new Error('ER 图最多包含 400 个已加载或外部引用节点，请缩小选择');
        const external: ErDiagramNode = { id: targetId, schema: targetSchema, table: foreign.referencedTable, kind: 'table', external: true, comment: null, columns: [] };
        nodes.set(targetId, external); model.nodes.push(external);
        model.issues.push({ nodeId: targetId, message: '外键引用对象未加载结构；这里只展示 catalog 已提供的引用字段' });
      }
      const target = nodes.get(targetId)!;
      if (target.external) for (const name of foreign.referencedColumns) if (!target.columns.some((column) => column.name === name)) target.columns.push({ name, dataType: null, nullable: null, primary: null, unique: null, foreign: false, generated: false, default: null, comment: null });
      const pairs = foreign.columns.map((name, index) => ({ sourceColumn: name, targetColumn: foreign.referencedColumns[index] }));
      const sourceMissing = pairs.some((pair) => !structure.columns.some((column) => column.name === pair.sourceColumn));
      const targetMissing = Boolean(targetStructure && pairs.some((pair) => !targetStructure.columns.some((column) => column.name === pair.targetColumn)));
      if (sourceMissing || targetMissing) model.issues.push({ nodeId: sourceId, edgeId, message: `外键 ${foreign.name} 与已读取字段不一致；端点按表头显示，请刷新元数据` });
      const targetUnique = Boolean(targetStructure && containsUniqueKey(targetStructure, foreign.referencedColumns));
      const edge: ErDiagramEdge = { id: edgeId, name: foreign.name, nameSource: foreign.nameSource, source: sourceId, target: targetId, pairs,
        sourceCardinality: containsUniqueKey(structure, foreign.columns) ? 'one' : 'many', targetCardinality: targetStructure ? targetUnique ? 'one' : first.provider === 'mysql' ? 'many' : 'unknown' : 'unknown',
        nullable: foreign.columns.some((name) => structure.columns.find((column) => column.name === name)?.isNullable !== false), validated: foreign.validated, deferrable: foreign.deferrable, initiallyDeferred: foreign.initiallyDeferred, onUpdate: foreign.onUpdate, onDelete: foreign.onDelete, match: foreign.match, definition: foreign.definition };
      model.edges.push(edge);
      if (foreign.validated === false) model.issues.push({ edgeId, nodeId: sourceId, message: `外键 ${foreign.name} 尚未验证，不能据此保证已有行的参照完整性` });
      if (!targetUnique && targetStructure) model.issues.push({ edgeId, nodeId: targetId, message: `引用字段没有可证明的完整唯一键；${first.provider === 'mysql' ? '可能匹配多个父行' : '基数未知'}` });
    }
  }
  model.schemas = [...new Set(model.nodes.map((node) => node.schema))].sort(); return model;
}
export function diagramFieldRelations(model: ErDiagramModel, nodeId: string, column: string): { edge: ErDiagramEdge; direction: 'incoming' | 'outgoing'; peer: ErDiagramNode | undefined; peerColumns: string[] }[] {
  return model.edges.flatMap((edge) => {
    const results: ReturnType<typeof diagramFieldRelations> = [];
    if (edge.source === nodeId && edge.pairs.some((pair) => pair.sourceColumn === column)) results.push({ edge, direction: 'outgoing', peer: model.nodes.find((node) => node.id === edge.target), peerColumns: edge.pairs.filter((pair) => pair.sourceColumn === column).map((pair) => pair.targetColumn) });
    if (edge.target === nodeId && edge.pairs.some((pair) => pair.targetColumn === column)) results.push({ edge, direction: 'incoming', peer: model.nodes.find((node) => node.id === edge.source), peerColumns: edge.pairs.filter((pair) => pair.targetColumn === column).map((pair) => pair.sourceColumn) });
    return results;
  });
}
export function diagramJoinSql(model: ErDiagramModel, edgeId: string): string {
  const edge = model.edges.find((candidate) => candidate.id === edgeId), source = model.nodes.find((node) => node.id === edge?.source), target = model.nodes.find((node) => node.id === edge?.target);
  if (!edge || !source || !target || !edge.pairs.length || edge.pairs.some((pair) => !pair.sourceColumn || !pair.targetColumn || pair.targetColumn === '(隐式主键)')) throw new Error('外键端点不完整，不能生成 JOIN SQL');
  const q = (name: string) => { const quote = model.provider === 'mysql' ? '`' : '"'; return quote + name.replaceAll(quote, quote + quote) + quote; };
  const table = (node: ErDiagramNode) => `${q(node.schema)}.${q(node.table)}`;
  return `SELECT ${q('source')}.*, ${q('target')}.*\nFROM ${table(source)} AS ${q('source')}\nLEFT JOIN ${table(target)} AS ${q('target')}\n  ON ${edge.pairs.map((pair) => `${q('source')}.${q(pair.sourceColumn)} = ${q('target')}.${q(pair.targetColumn)}`).join('\n AND ')};`;
}
