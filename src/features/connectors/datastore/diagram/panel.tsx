'use client';
import { useMemo, useRef, useState } from 'react';
import { ArrowClockwise, DownloadSimple, Graph, MagnifyingGlass, Rows, Warning } from '@phosphor-icons/react';
import { diagramVisibleColumns, layoutErDiagram, routeErDiagramEdge, type ErDiagramModel, type ErDiagramNode, type ErDiagramPosition } from '@fouc/shared/er-diagram';
import { DiagramCanvas, type DiagramSelection } from './canvas';
import { DiagramInspector } from './inspector';
import { downloadErDiagram, downloadErDiagramPng, exportErDiagramMermaid, exportErDiagramSvg, type ErDiagramExportTheme, type ErDiagramExportView } from './export';
import styles from './diagram.module.css';
export interface SchemaDiagramPanelProps {
  model: ErDiagramModel; title?: string; className?: string; loading?: boolean; error?: string;
  onRefresh?: () => void | Promise<void>; onOpenTable?: (node: ErDiagramNode) => void; onOpenQuery?: (sql: string) => void; onClose?: () => void;
}
export function SchemaDiagramPanel(props: SchemaDiagramPanelProps) { return <DiagramPanel key={JSON.stringify([props.model.connectionId, props.model.provider, props.model.schemas])} {...props} />; }
function DiagramPanel({ model, title = '数据库关系图', className = '', loading = false, error, onRefresh, onOpenTable, onOpenQuery, onClose }: SchemaDiagramPanelProps) {
  const element = useRef<HTMLElement>(null), focusSequence = useRef(0);
  const [selection, setSelection] = useState<DiagramSelection>({}), [search, setSearch] = useState(''), [fieldLimit, setFieldLimit] = useState(12);
  const [positions, setPositions] = useState<Record<string, ErDiagramPosition>>({}), [focus, setFocus] = useState<{ nodeId: string; version: number }>();
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'mermaid' | 'json'>('svg'), [busy, setBusy] = useState<'export' | 'refresh' | null>(null), [notice, setNotice] = useState(''), [failure, setFailure] = useState('');
  const dense = model.nodes.length * model.edges.length > 40000;
  const columns = useMemo(() => Object.fromEntries(model.nodes.map((node) => [node.id, diagramVisibleColumns(node, model, fieldLimit, selection.nodeId === node.id ? selection.column : undefined)])), [model, fieldLimit, selection.nodeId, selection.column]);
  const automatic = useMemo(() => layoutErDiagram(model, columns), [model, columns]);
  const view = useMemo<ErDiagramExportView>(() => {
    const boxes = automatic.boxes.map((box) => ({ ...box, ...positions[box.id] })), layout = { ...automatic, boxes, positions: Object.fromEntries(boxes.map((box) => [box.id, { x: box.x, y: box.y }])), width: Math.max(600, ...boxes.map((box) => box.x + box.width + 56)), height: Math.max(400, ...boxes.map((box) => box.y + box.height + 56)) };
    return { layout, columns, routes: Object.fromEntries(model.edges.map((edge) => [edge.id, routeErDiagramEdge(edge, layout, columns, !dense)])) };
  }, [automatic, columns, positions, model.edges, dense]);
  const term = search.trim().toLocaleLowerCase(), matches = useMemo(() => new Set(model.nodes.filter((node) => !term || `${node.schema}.${node.table}`.toLocaleLowerCase().includes(term) || node.columns.some((column) => column.name.toLocaleLowerCase().includes(term))).map((node) => node.id)), [model.nodes, term]);
  const tables = model.nodes.filter((node) => matches.has(node.id)), loaded = model.nodes.filter((node) => !node.external).length, external = model.nodes.length - loaded;
  function select(next: DiagramSelection, center = false) { setSelection(next); if (next.nodeId && center) setFocus({ nodeId: next.nodeId, version: ++focusSequence.current }); }
  async function copy(text: string) { setFailure(''); try { await navigator.clipboard.writeText(text); setNotice('已复制'); } catch { setFailure('复制失败，请检查浏览器剪贴板权限'); } }
  async function refresh() { setBusy('refresh'); setFailure(''); try { const pending = onRefresh?.(); await pending; setNotice(pending ? '结构刷新已完成' : '已请求刷新结构'); } catch (reason) { setFailure(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); } }
  async function exportGraph() {
    setBusy('export'); setFailure(''); setNotice('');
    try {
      // Yield before serializing large graph exports so the busy state is visible.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const name = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100) || 'schema'}-er`;
      if (exportFormat === 'mermaid') downloadErDiagram(`${name}.mmd`, exportErDiagramMermaid(model), 'text/plain;charset=utf-8');
      else if (exportFormat === 'json') { const json = JSON.stringify({ model, positions: view.layout.positions, visibleColumns: Object.fromEntries(Object.entries(columns).map(([id, fields]) => [id, fields.map((field) => field.name)])) }, null, 2); if (new TextEncoder().encode(json).length > 16 * 1024 * 1024) throw new Error('JSON 超过 16 MiB，请缩小对象范围'); downloadErDiagram(`${name}.json`, json, 'application/json;charset=utf-8'); }
      else { const svg = exportErDiagramSvg(model, view, readTheme(element.current)); if (exportFormat === 'png') await downloadErDiagramPng(`${name}.png`, svg); else downloadErDiagram(`${name}.svg`, svg, 'image/svg+xml;charset=utf-8'); }
      setNotice(`已导出 ${exportFormat.toUpperCase()}${exportFormat === 'svg' || exportFormat === 'png' ? ' · 保留当前布局与显示字段' : ' · 包含当前真实模型'}`);
    } catch (reason) { setFailure(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); }
  }
  const working = loading || Boolean(busy);
  return <section ref={element} className={`${styles.panel} ${className}`} aria-label="数据库关系图" aria-busy={working}>
    <header className={styles.header}><div className={styles.title}><Graph size={23} /><div><h2>{title}</h2><p>{model.provider.toUpperCase()}<span>{model.schemas.join(' / ')}</span></p></div></div><div className={styles.headerActions}><span>{loaded} 个已加载对象 · {model.edges.length} 条外键{external ? ` · ${external} 个外部引用` : ''}</span>{onRefresh && <button type="button" disabled={working} onClick={() => void refresh()}><ArrowClockwise size={16} />{busy === 'refresh' || loading ? '读取中' : '刷新结构'}</button>}{onClose && <button type="button" disabled={Boolean(busy)} onClick={onClose}>关闭</button>}</div></header>
    <div className={styles.toolbar}><label className={styles.search}><MagnifyingGlass size={16} /><input aria-label="搜索关系图表或字段" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索表、Schema 或字段" /></label><label className={styles.fieldLimit}><Rows size={15} /><span>显示字段</span><select aria-label="关系图字段显示数量" value={fieldLimit} onChange={(event) => { setFieldLimit(Number(event.target.value)); setPositions({}); }}><option value={12}>紧凑 · 12</option><option value={24}>展开 · 24</option></select></label><button type="button" disabled={working || !model.nodes.length} onClick={() => { setPositions({}); setNotice('已恢复按真实关系自动布局'); }}>自动布局</button><div className={styles.exportActions}><select aria-label="关系图导出格式" value={exportFormat} disabled={working} onChange={(event) => setExportFormat(event.target.value as typeof exportFormat)}><option value="svg">SVG 矢量图</option><option value="png">PNG 图片</option><option value="mermaid">Mermaid</option><option value="json">JSON 元数据</option></select><button type="button" disabled={working || !model.nodes.length} onClick={() => void exportGraph()}><DownloadSimple size={16} />{busy === 'export' ? '生成中…' : '导出'}</button></div></div>
    {(error || failure) && <p role="alert" className={styles.alert}><Warning size={16} />{failure || error}</p>}
    {loading && !model.nodes.length ? <div className={styles.loading} role="status"><div /><div /><div /><p>正在读取真实表结构与外键…</p></div> : !model.nodes.length ? <div className={styles.empty}><Graph size={36} /><h3>当前没有已加载对象</h3><p>选择包含表的 Schema 并读取结构，即可查看实际外键关系。</p></div> : <div className={styles.body}><aside className={styles.objects} aria-label="关系图对象清单"><div className={styles.sectionLabel}>对象 <b>{tables.length}{term ? ` / ${model.nodes.length}` : ''}</b></div>{tables.map((node) => <button type="button" key={node.id} className={selection.nodeId === node.id ? styles.activeObject : ''} onClick={() => select({ nodeId: node.id, column: term && !`${node.schema}.${node.table}`.toLocaleLowerCase().includes(term) ? node.columns.find((field) => field.name.toLocaleLowerCase().includes(term))?.name : undefined }, true)}><span><b>{node.table}</b><small>{node.schema}{node.external ? ' · 未加载' : node.kind === 'view' ? ' · VIEW' : node.kind === 'materialized_view' ? ' · MVIEW' : ''}</small></span><em>{node.columns.length}</em></button>)}{!tables.length && <p className={styles.hint}>没有匹配对象，尝试搜索字段名称。</p>}</aside><DiagramCanvas model={model} view={view} selection={selection} matches={term ? matches : undefined} focus={focus} onSelect={(next) => select(next)} onMove={(id, position) => setPositions((current) => ({ ...current, [id]: position }))} /><DiagramInspector model={model} selection={selection} onSelect={(next) => select(next, true)} onCopy={(text) => void copy(text)} onOpenTable={onOpenTable} onOpenQuery={onOpenQuery} /></div>}
    <footer className={styles.status}><span role="status">{notice || (loading ? '读取结构中，现有图仍可查看' : dense ? '高密度关系图使用简化连线 · 完整外键保留在详情与导出中' : '关系来自原生 Catalog · 外部引用不会自动读取其他 Schema')}</span><span>{model.nodes.reduce((count, node) => count + node.columns.length, 0)} 字段 · PK / FK 优先显示</span></footer>
    {model.issues.length > 0 && <details className={styles.issues}><summary><Warning size={14} />元数据说明 · {model.issues.length}</summary><ul>{model.issues.slice(0, 100).map((issue, index) => <li key={index}>{issue.message}{issue.nodeId && <button type="button" onClick={() => select({ nodeId: issue.nodeId }, true)}>定位对象</button>}</li>)}{model.issues.length > 100 && <li>另有 {model.issues.length - 100} 项，完整说明包含在 JSON 导出中。</li>}</ul></details>}
  </section>;
}
function readTheme(host: HTMLElement | null): ErDiagramExportTheme | undefined {
  if (!host) return;
  const canvas = host.querySelector('[role="group"]')?.parentElement, card = host.querySelector('[data-er-node] > rect'), stripe = host.querySelector('[data-er-node] > rect:nth-of-type(2)'), schema = host.querySelector('[data-er-drag] > text');
  const style = getComputedStyle(host), background = canvas ? getComputedStyle(canvas).backgroundColor : style.backgroundColor;
  return { background, panel: card ? getComputedStyle(card).fill : style.backgroundColor, ink: style.color, muted: schema ? getComputedStyle(schema).fill : style.color, line: style.borderTopColor, accent: stripe ? getComputedStyle(stripe).fill : style.color };
}
