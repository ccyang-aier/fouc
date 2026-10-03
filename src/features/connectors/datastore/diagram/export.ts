import { ER_HEADER_HEIGHT, ER_ROW_HEIGHT, erDiagramPath, pointAlongErRoute, type ErDiagramColumn, type ErDiagramLayout, type ErDiagramModel, type ErDiagramPosition } from '@fouc/shared/er-diagram';
export interface ErDiagramExportView { layout: ErDiagramLayout; columns: Record<string, readonly ErDiagramColumn[]>; routes: Record<string, ErDiagramPosition[]> }
export interface ErDiagramExportTheme { background: string; panel: string; ink: string; muted: string; line: string; accent: string }
const defaultTheme: ErDiagramExportTheme = { background: '#f6f7fa', panel: '#ffffff', ink: '#222736', muted: '#757c8c', line: '#d8deea', accent: '#747cf1' };
function xml(value: string): string { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '�').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
const shorten = (value: string, max: number) => [...value].length > max ? [...value].slice(0, max - 1).join('') + '…' : value;
/** DBX SVG export keeps exact schema-qualified identity and current positions; metadata is XML-escaped. */
export function exportErDiagramSvg(model: ErDiagramModel, view: ErDiagramExportView, theme: ErDiagramExportTheme = defaultTheme): string {
  const routePoints = Object.values(view.routes).flat(), boxes = view.layout.boxes;
  const minX = Math.min(0, ...routePoints.map((point) => point.x - 24)), minY = Math.min(0, ...routePoints.map((point) => point.y - 24));
  const width = Math.ceil(Math.max(view.layout.width, ...boxes.map((box) => box.x + box.width + 40), ...routePoints.map((point) => point.x + 24)) - minX), height = Math.ceil(Math.max(view.layout.height, ...boxes.map((box) => box.y + box.height + 40), ...routePoints.map((point) => point.y + 24)) - minY);
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}"><title>${xml(`${model.provider.toUpperCase()} ER 图`)}</title><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${xml(theme.background)}"/>`];
  svg.push('<g font-family="Segoe UI,Arial,sans-serif">');
  for (const edge of model.edges) {
    const route = view.routes[edge.id] ?? []; if (!route.length) continue;
    svg.push(`<path d="${erDiagramPath(route)}" fill="none" stroke="${xml(theme.accent)}" stroke-width="1.5"${model.nodes.find((node) => node.id === edge.target)?.external || edge.validated === false ? ' stroke-dasharray="6 4"' : ''}><title>${xml(edge.name)}</title></path>`);
    for (const [fraction, label] of [[.12, edge.sourceCardinality === 'many' ? 'N' : '1'], [.88, edge.targetCardinality === 'unknown' ? '?' : edge.targetCardinality === 'many' ? 'N' : edge.nullable ? '0..1' : '1']] as const) { const point = pointAlongErRoute(route, fraction); svg.push(`<rect x="${point.x - 13}" y="${point.y - 9}" width="26" height="18" rx="4" fill="${xml(theme.background)}"/><text x="${point.x}" y="${point.y + 4}" fill="${xml(theme.accent)}" text-anchor="middle" font-size="11">${label}</text>`); }
  }
  for (const node of model.nodes) {
    const box = boxes.find((candidate) => candidate.id === node.id); if (!box) continue;
    const columns = view.columns[node.id] ?? [];
    svg.push(`<g transform="translate(${box.x},${box.y})"><rect width="${box.width}" height="${box.height}" rx="9" fill="${xml(theme.panel)}" stroke="${xml(theme.line)}"${node.external ? ' stroke-dasharray="6 4"' : ''}/><rect x="0" y="0" width="4" height="${box.height}" rx="2" fill="${xml(node.external ? theme.muted : theme.accent)}"/><text x="15" y="19" fill="${xml(theme.muted)}" font-size="10">${xml(shorten(node.schema, 40))}${node.external ? ' · 未加载结构' : ''}</text><text x="15" y="40" fill="${xml(theme.ink)}" font-size="14" font-weight="600">${xml(shorten(node.table, 31))}<title>${xml(node.table)}</title></text>`);
    for (const [index, column] of columns.entries()) { const y = ER_HEADER_HEIGHT + index * ER_ROW_HEIGHT; svg.push(`<line x1="1" y1="${y}" x2="${box.width - 1}" y2="${y}" stroke="${xml(theme.line)}" opacity=".45"/><text x="13" y="${y + 16}" font-size="9" fill="${xml(column.primary ? '#c39449' : theme.accent)}">${column.primary ? 'PK' : column.foreign ? 'FK' : ''}</text><text x="38" y="${y + 16}" font-size="13" fill="${xml(theme.ink)}">${xml(shorten(column.name, 22))}<title>${xml(column.name)}</title></text><text x="${box.width - 12}" y="${y + 16}" text-anchor="end" font-size="10" fill="${xml(theme.muted)}">${xml(shorten(column.dataType ?? '?', 12))}</text>`); }
    svg.push(`<text x="15" y="${box.height - 9}" font-size="10" fill="${xml(theme.muted)}">${node.columns.length} 字段${columns.length < node.columns.length ? ` · 当前显示 ${columns.length}` : ''}</text></g>`);
  }
  svg.push('</g></svg>'); const result = svg.join(''); if (new TextEncoder().encode(result).length > 16 * 1024 * 1024) throw new Error('SVG 超过 16 MiB，请缩小显示范围'); return result;
}
export function exportErDiagramMermaid(model: ErDiagramModel): string {
  const ids = new Map(model.nodes.map((node, index) => [node.id, `table${index}`])), lines = ['flowchart LR'];
  for (const node of model.nodes) lines.push(`  ${ids.get(node.id)}["${xml(`${node.schema}.${node.table}`).replace(/[\r\n]/g, ' ')}${node.external ? ' · 未加载' : ''}"]`);
  for (const edge of model.edges) lines.push(`  ${ids.get(edge.source)} -->|"${xml(`${edge.name} · ${edge.sourceCardinality === 'many' ? 'N' : '1'}:${edge.targetCardinality === 'unknown' ? '?' : edge.targetCardinality === 'many' ? 'N' : '1'}`).replace(/[\r\n]/g, ' ')}"| ${ids.get(edge.target)}`);
  return lines.join('\n');
}
export function downloadErDiagram(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadErDiagramPng(name: string, svg: string): Promise<void> {
  const size = /^<svg[^>]*\bwidth="(\d+)" height="(\d+)"/.exec(svg), width = Number(size?.[1]), height = Number(size?.[2]);
  if (!size || width <= 0 || height <= 0 || width > 16384 || height > 16384 || width * height > 16000000) throw new Error('PNG 最多 1600 万像素，请使用 SVG 导出完整大图');
  const image = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    image.src = url; await image.decode(); if (image.width > 16384 || image.height > 16384 || image.width * image.height > 16000000) throw new Error('PNG 最多 1600 万像素，请使用 SVG 导出完整大图');
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器无法创建 PNG 画布'); context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG 生成失败')), 'image/png'));
    const png = URL.createObjectURL(blob), link = document.createElement('a'); link.href = png; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(png), 1000);
  } finally { URL.revokeObjectURL(url); }
}
