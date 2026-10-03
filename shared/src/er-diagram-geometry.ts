import type { ErDiagramBox, ErDiagramColumn, ErDiagramEdge, ErDiagramLayout, ErDiagramPosition } from './er-diagram';
import { ER_HEADER_HEIGHT, ER_ROW_HEIGHT } from './er-diagram-layout';
export interface ErDiagramViewport { x: number; y: number; zoom: number }
const STUB = 28;
function columnY(box: ErDiagramBox, columns: readonly ErDiagramColumn[], names: string[]): number {
  const rows = names.map((name) => columns.findIndex((column) => column.name === name)).filter((index) => index >= 0);
  return box.y + (rows.length ? ER_HEADER_HEIGHT + ER_ROW_HEIGHT * (rows.reduce((sum, index) => sum + index, 0) / rows.length + .5) : ER_HEADER_HEIGHT / 2);
}
/** DBX obstacle routing adapted without Vue Flow: test bounded orthogonal corridors then shortest clear path. */
export function routeErDiagramEdge(edge: ErDiagramEdge, layout: ErDiagramLayout, columns: Record<string, readonly ErDiagramColumn[]>, avoidObstacles = true): ErDiagramPosition[] {
  const source = layout.boxes.find((box) => box.id === edge.source), target = layout.boxes.find((box) => box.id === edge.target);
  if (!source || !target) return [];
  const sourceY = columnY(source, columns[source.id] ?? [], edge.pairs.map((pair) => pair.sourceColumn)), targetY = columnY(target, columns[target.id] ?? [], edge.pairs.map((pair) => pair.targetColumn));
  if (source.id === target.id) { const x = source.x + source.width; return [{ x, y: sourceY }, { x: x + 60, y: sourceY }, { x: x + 60, y: source.y - 26 }, { x: x + 34, y: source.y - 26 }, { x: x + 34, y: targetY }, { x, y: targetY }]; }
  const sameLane = source.x === target.x, direction = source.x < target.x ? 1 : -1;
  const s = { x: direction > 0 ? source.x + source.width : source.x, y: sourceY }, t = { x: sameLane || direction > 0 ? target.x : target.x + target.width, y: targetY };
  const so = { x: s.x + direction * STUB, y: s.y }, ti = { x: t.x + (sameLane ? -1 : -direction) * STUB, y: t.y };
  if (!avoidObstacles) return cleanPoints([s, so, { x: (so.x + ti.x) / 2, y: so.y }, { x: (so.x + ti.x) / 2, y: ti.y }, ti, t]);
  const others = layout.boxes.filter((box) => box.id !== source.id && box.id !== target.id).sort((a, b) => distanceToSegmentBox(a, s, t) - distanceToSegmentBox(b, s, t)).slice(0, 12);
  const obstacles = others.map((box) => ({ ...box, x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 }));
  const xs = [(so.x + ti.x) / 2, so.x, ti.x, Math.min(source.x, target.x) - STUB, Math.max(source.x + source.width, target.x + target.width) + STUB, ...obstacles.flatMap((box) => [box.x - STUB, box.x + box.width + STUB])];
  const ys = [Math.min(source.y, target.y) - STUB, Math.max(source.y + source.height, target.y + target.height) + STUB, ...obstacles.flatMap((box) => [box.y - STUB, box.y + box.height + STUB])];
  const candidates = [...xs.map((x) => [s, so, { x, y: so.y }, { x, y: ti.y }, ti, t]), ...ys.map((y) => [s, so, { x: so.x, y }, { x: ti.x, y }, ti, t])];
  const clear = candidates.map(cleanPoints).filter((points) => !hits(points, obstacles) && !skimsEndpoints(points, [source, target]));
  return clear.sort((a, b) => length(a) - length(b))[0] ?? cleanPoints([s, so, { x: (so.x + ti.x) / 2, y: so.y }, { x: (so.x + ti.x) / 2, y: ti.y }, ti, t]);
}
function distanceToSegmentBox(box: ErDiagramBox, a: ErDiagramPosition, b: ErDiagramPosition): number { return Math.hypot(box.x + box.width / 2 - (a.x + b.x) / 2, box.y + box.height / 2 - (a.y + b.y) / 2); }
function intersects(a: ErDiagramPosition, b: ErDiagramPosition, box: ErDiagramBox): boolean {
  if (Math.abs(a.x - b.x) < .01) return a.x > box.x + .01 && a.x < box.x + box.width - .01 && Math.max(a.y, b.y) > box.y + .01 && Math.min(a.y, b.y) < box.y + box.height - .01;
  if (Math.abs(a.y - b.y) < .01) return a.y > box.y + .01 && a.y < box.y + box.height - .01 && Math.max(a.x, b.x) > box.x + .01 && Math.min(a.x, b.x) < box.x + box.width - .01;
  return true;
}
function hits(points: ErDiagramPosition[], boxes: ErDiagramBox[]): boolean { return points.slice(1).some((point, index) => boxes.some((box) => intersects(points[index], point, box))); }
function skimsEndpoints(points: ErDiagramPosition[], boxes: ErDiagramBox[]): boolean { return hits(points.slice(1, -1), boxes); }
function length(points: ErDiagramPosition[]): number { return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0); }
function cleanPoints(points: ErDiagramPosition[]): ErDiagramPosition[] {
  const result: ErDiagramPosition[] = [];
  for (const point of points) { if (result.at(-1)?.x === point.x && result.at(-1)?.y === point.y) continue; const a = result.at(-2), b = result.at(-1); if (a && b && (a.x === b.x && b.x === point.x || a.y === b.y && b.y === point.y)) result.pop(); result.push(point); } return result;
}
export function erDiagramPath(points: readonly ErDiagramPosition[]): string { return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '); }
export function pointAlongErRoute(points: readonly ErDiagramPosition[], fraction: number): ErDiagramPosition {
  if (!points.length) return { x: 0, y: 0 }; let remaining = length([...points]) * Math.min(1, Math.max(0, fraction));
  for (let index = 1; index < points.length; index++) { const a = points[index - 1], b = points[index], distance = Math.hypot(b.x - a.x, b.y - a.y); if (remaining <= distance && distance) return { x: a.x + (b.x - a.x) * remaining / distance, y: a.y + (b.y - a.y) * remaining / distance }; remaining -= distance; } return { ...points.at(-1)! };
}
export function clampErDiagramZoom(value: number): number { return Math.max(.08, Math.min(2.5, Number.isFinite(value) ? value : 1)); }
export function fitErDiagramViewport(layout: Pick<ErDiagramLayout, 'width' | 'height'>, width: number, height: number): ErDiagramViewport { const zoom = clampErDiagramZoom(Math.min((width - 32) / Math.max(1, layout.width), (height - 32) / Math.max(1, layout.height), 1)); return { zoom, x: (width - layout.width * zoom) / 2, y: (height - layout.height * zoom) / 2 }; }
export function zoomErDiagramAt(view: ErDiagramViewport, nextZoom: number, point: ErDiagramPosition): ErDiagramViewport { const zoom = clampErDiagramZoom(nextZoom), factor = zoom / view.zoom; return { zoom, x: point.x - (point.x - view.x) * factor, y: point.y - (point.y - view.y) * factor }; }
