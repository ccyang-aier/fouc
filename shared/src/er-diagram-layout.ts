import type { ErDiagramColumn, ErDiagramLayout, ErDiagramModel, ErDiagramNode } from './er-diagram';
export const ER_CARD_WIDTH = 292, ER_HEADER_HEIGHT = 58, ER_ROW_HEIGHT = 24;
const GAP_X = 116, GAP_Y = 48, MARGIN = 56;
/** Relation and primary-key fields remain visible before ordinary columns are shortened. */
export function diagramVisibleColumns(node: ErDiagramNode, model: ErDiagramModel, limit = 12, focusColumn?: string): ErDiagramColumn[] {
  const important = new Set(node.columns.filter((column) => column.primary || column.foreign || column.name === focusColumn).map((column) => column.name));
  for (const edge of model.edges) if (edge.target === node.id) for (const pair of edge.pairs) important.add(pair.targetColumn);
  const chosen = new Set(node.columns.filter((column) => important.has(column.name)).slice(0, 32).map((column) => column.name));
  if (focusColumn) chosen.add(focusColumn);
  for (const column of node.columns) { if (chosen.size >= Math.max(limit, Math.min(32, important.size))) break; chosen.add(column.name); }
  return node.columns.filter((column) => chosen.has(column.name));
}
export function erDiagramCardHeight(columns: number): number { return ER_HEADER_HEIGHT + columns * ER_ROW_HEIGHT + 26; }
/** DBX connectivity ordering + cycle condensation; parent tables precede dependent tables. */
export function layoutErDiagram(model: ErDiagramModel, visible?: Record<string, readonly ErDiagramColumn[]>): ErDiagramLayout {
  const nodes = [...model.nodes].sort((a, b) => `${a.schema}.${a.table}`.localeCompare(`${b.schema}.${b.table}`)), ids = new Set(nodes.map((node) => node.id));
  const forward = new Map(nodes.map((node) => [node.id, new Set<string>()])), adjacent = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of model.edges) if (ids.has(edge.source) && ids.has(edge.target)) { forward.get(edge.target)!.add(edge.source); adjacent.get(edge.source)!.add(edge.target); adjacent.get(edge.target)!.add(edge.source); }
  const components = stronglyConnected(nodes.map((node) => node.id), forward), componentById = new Map(components.flatMap((group, index) => group.map((id) => [id, index] as const)));
  const ranks = new Map<number, number>(), incoming = new Map(components.map((_, index) => [index, new Set<number>()]));
  for (const [from, targets] of forward) for (const to of targets) { const a = componentById.get(from)!, b = componentById.get(to)!; if (a !== b) incoming.get(b)!.add(a); }
  const rank = (index: number): number => { if (ranks.has(index)) return ranks.get(index)!; const value = Math.max(0, ...[...incoming.get(index)!].map((parent) => rank(parent) + 1)); ranks.set(index, value); return value; };
  const positions: ErDiagramLayout['positions'] = {}, visited = new Set<string>(); let originY = MARGIN;
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const group: string[] = [], queue = [node.id];
    while (queue.length) { const id = queue.shift()!; if (visited.has(id)) continue; visited.add(id); group.push(id); for (const peer of adjacent.get(id)!) if (!visited.has(peer)) queue.push(peer); }
    const levels = new Map<number, ErDiagramNode[]>();
    for (const member of nodes.filter((candidate) => group.includes(candidate.id))) { const level = rank(componentById.get(member.id)!); levels.set(level, [...levels.get(level) ?? [], member]); }
    let bottom = originY;
    for (const [level, members] of [...levels].sort(([a], [b]) => a - b)) {
      let y = originY;
      for (const member of members) { positions[member.id] = { x: MARGIN + level * (ER_CARD_WIDTH + GAP_X), y }; y += erDiagramCardHeight((visible?.[member.id] ?? diagramVisibleColumns(member, model)).length) + GAP_Y; }
      bottom = Math.max(bottom, y - GAP_Y);
    }
    originY = bottom + 90;
  }
  const boxes = nodes.map((node) => ({ id: node.id, ...positions[node.id], width: ER_CARD_WIDTH, height: erDiagramCardHeight((visible?.[node.id] ?? diagramVisibleColumns(node, model)).length) }));
  return { positions, boxes, width: Math.max(600, ...boxes.map((box) => box.x + box.width + MARGIN)), height: Math.max(400, ...boxes.map((box) => box.y + box.height + MARGIN)) };
}
function stronglyConnected(ids: string[], graph: Map<string, Set<string>>): string[][] {
  const indices = new Map<string, number>(), low = new Map<string, number>(), active = new Set<string>(), stack: string[] = [], groups: string[][] = []; let next = 0;
  const visit = (id: string) => {
    indices.set(id, next); low.set(id, next++); stack.push(id); active.add(id);
    for (const peer of graph.get(id)!) { if (!indices.has(peer)) { visit(peer); low.set(id, Math.min(low.get(id)!, low.get(peer)!)); } else if (active.has(peer)) low.set(id, Math.min(low.get(id)!, indices.get(peer)!)); }
    if (low.get(id) === indices.get(id)) { const group: string[] = []; let peer: string; do { peer = stack.pop()!; active.delete(peer); group.push(peer); } while (peer !== id); groups.push(group); }
  };
  for (const id of ids) if (!indices.has(id)) visit(id); return groups;
}
