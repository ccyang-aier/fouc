'use client';
import { useMemo, useRef, useState } from 'react';
import { Graph, Table, Warning } from '@phosphor-icons/react';
import { useAppAlert } from '@/components/app-alert-provider';
import { diagramVisibleColumns, layoutErDiagram, routeErDiagramEdge, type ErDiagramModel, type ErDiagramNode, type ErDiagramPosition } from '@fouc/shared/er-diagram';
import { DiagramCanvas, type DiagramSelection } from './canvas';
import { DiagramInspector } from './inspector';
import { downloadErDiagram, downloadErDiagramPng, exportErDiagramMermaid, exportErDiagramSvg, type ErDiagramExportTheme, type ErDiagramExportView } from './export';
import { DiagramToolbar, type DiagramExportFormat } from './toolbar';
import { DiagramStatusBar } from './status-bar';
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
  const [busy, setBusy] = useState<'export' | 'refresh' | null>(null), [failure, setFailure] = useState('');
  const [objectsVisible, setObjectsVisible] = useState(false), [inspectorVisible, setInspectorVisible] = useState(true);
  const { notify } = useAppAlert();
  const dense = model.nodes.length * model.edges.length > 40000;
  const columns = useMemo(() => Object.fromEntries(model.nodes.map((node) => [node.id, diagramVisibleColumns(node, model, fieldLimit, selection.nodeId === node.id ? selection.column : undefined)])), [model, fieldLimit, selection.nodeId, selection.column]);
  const automatic = useMemo(() => layoutErDiagram(model, columns), [model, columns]);
  const view = useMemo<ErDiagramExportView>(() => {
    const boxes = automatic.boxes.map((box) => ({ ...box, ...positions[box.id] })), layout = { ...automatic, boxes, positions: Object.fromEntries(boxes.map((box) => [box.id, { x: box.x, y: box.y }])), width: Math.max(600, ...boxes.map((box) => box.x + box.width + 56)), height: Math.max(400, ...boxes.map((box) => box.y + box.height + 56)) };
    return { layout, columns, routes: Object.fromEntries(model.edges.map((edge) => [edge.id, routeErDiagramEdge(edge, layout, columns, !dense)])) };
  }, [automatic, columns, positions, model.edges, dense]);
  const term = search.trim().toLocaleLowerCase(), matches = useMemo(() => new Set(model.nodes.filter((node) => !term || `${node.schema}.${node.table}`.toLocaleLowerCase().includes(term) || node.columns.some((column) => column.name.toLocaleLowerCase().includes(term))).map((node) => node.id)), [model.nodes, term]);
  const tables = model.nodes.filter((node) => matches.has(node.id)), external = model.nodes.filter(node => node.external).length;
  function select(next: DiagramSelection, center = false) { setSelection(next); if (next.nodeId && center) setFocus({ nodeId: next.nodeId, version: ++focusSequence.current }); }
  async function copy(text: string) { setFailure(''); try { await navigator.clipboard.writeText(text); notify('success', '已复制'); } catch { setFailure('复制失败，请检查浏览器剪贴板权限'); } }
  async function refresh() { setBusy('refresh'); setFailure(''); try { const pending = onRefresh?.(); await pending; notify(pending ? 'success' : 'info', pending ? '结构刷新已完成' : '已请求刷新结构'); } catch (reason) { setFailure(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); } }
  async function exportGraph(exportFormat: DiagramExportFormat) {
    setBusy('export'); setFailure('');
    try {
      // Yield before serializing large graph exports so the busy state is visible.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const name = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100) || 'schema'}-er`;
      if (exportFormat === 'mermaid') downloadErDiagram(`${name}.mmd`, exportErDiagramMermaid(model), 'text/plain;charset=utf-8');
      else if (exportFormat === 'json') { const json = JSON.stringify({ model, positions: view.layout.positions, visibleColumns: Object.fromEntries(Object.entries(columns).map(([id, fields]) => [id, fields.map((field) => field.name)])) }, null, 2); if (new TextEncoder().encode(json).length > 16 * 1024 * 1024) throw new Error('JSON 超过 16 MiB，请缩小对象范围'); downloadErDiagram(`${name}.json`, json, 'application/json;charset=utf-8'); }
      else { const svg = exportErDiagramSvg(model, view, readTheme(element.current)); if (exportFormat === 'png') await downloadErDiagramPng(`${name}.png`, svg); else downloadErDiagram(`${name}.svg`, svg, 'image/svg+xml;charset=utf-8'); }
      notify('success', `已导出 ${exportFormat.toUpperCase()}`);
    } catch (reason) { setFailure(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); }
  }
  const working = loading || Boolean(busy);
  return <section ref={element} className={[styles.panel, className].join(' ')} aria-label="数据库关系图" aria-busy={working}>
    <DiagramToolbar title={title} provider={model.provider.toUpperCase()} objects={model.nodes.length} relationships={model.edges.length} external={external}
      search={search} onSearch={setSearch} fieldLimit={fieldLimit} onFieldLimit={value => { setFieldLimit(value); setPositions({}); }}
      objectsVisible={objectsVisible} onObjectsToggle={() => setObjectsVisible(value => !value)}
      inspectorVisible={inspectorVisible} onInspectorToggle={() => setInspectorVisible(value => !value)}
      busy={busy} loading={loading} disabled={working} onRefresh={onRefresh ? () => void refresh() : undefined}
      onLayout={() => { setPositions({}); notify('info', '已恢复自动布局'); }} onExport={format => void exportGraph(format)} onClose={onClose} />
    {(error || failure) && <p role="alert" className={styles.alert}><Warning size={16} />{failure || error}</p>}
    {loading && !model.nodes.length ? <div className={styles.loading} role="status"><div /><div /><div /><p>正在读取表结构与外键…</p></div>
      : !model.nodes.length ? <div className={styles.empty}><Graph size={28} /><h3>暂无对象</h3><p>选择包含表的 Schema，查看已声明的关系。</p></div>
      : <div className={styles.body} data-objects={objectsVisible} data-inspector={inspectorVisible}>
        <aside hidden={!objectsVisible} className={styles.objects} aria-label="关系图对象清单">
          <div className={styles.sectionLabel}>对象 <b>{tables.length}{term ? ' / ' + model.nodes.length : ''}</b></div>
          {tables.map(node => <button type="button" key={node.id} className="fouc-action" aria-pressed={selection.nodeId === node.id} title={node.schema + '.' + node.table}
            onClick={() => select({ nodeId: node.id, column: term && !(node.schema + '.' + node.table).toLocaleLowerCase().includes(term) ? node.columns.find(field => field.name.toLocaleLowerCase().includes(term))?.name : undefined }, true)}>
            <Table size={14} /><span><b>{node.table}</b>{(model.schemas.length > 1 || node.external || node.kind !== 'table') && <small>{node.schema}{node.external ? ' · 未加载' : node.kind === 'view' ? ' · 视图' : node.kind === 'materialized_view' ? ' · 物化视图' : ''}</small>}</span><em title="字段数量">{node.columns.length}</em>
          </button>)}
          {!tables.length && <p className={styles.hint}>没有匹配的对象。</p>}
        </aside>
        <DiagramCanvas model={model} view={view} selection={selection} matches={term ? matches : undefined} focus={focus}
          onSelect={next => { select(next); if (next.nodeId || next.edgeId) setInspectorVisible(true); }} onMove={(id, position) => setPositions(current => ({ ...current, [id]: position }))} />
        <DiagramInspector hidden={!inspectorVisible} model={model} selection={selection} onSelect={next => select(next, true)} onCopy={text => void copy(text)} onOpenTable={onOpenTable} onOpenQuery={onOpenQuery} />
      </div>}
    <DiagramStatusBar model={model} loading={loading} dense={dense} matches={term ? tables.length : undefined} onLocate={id => { select({ nodeId: id }, true); setInspectorVisible(true); }} />
  </section>;
}
function readTheme(host: HTMLElement | null): ErDiagramExportTheme | undefined {
  if (!host) return;
  const canvas = host.querySelector('[role="group"]')?.parentElement, card = host.querySelector('[data-er-node] > rect'), stripe = host.querySelector('[data-er-node] > rect:nth-of-type(2)'), schema = host.querySelector('[data-er-drag] > text');
  const style = getComputedStyle(host), background = canvas ? getComputedStyle(canvas).backgroundColor : style.backgroundColor;
  return { background, panel: card ? getComputedStyle(card).fill : style.backgroundColor, ink: style.color, muted: schema ? getComputedStyle(schema).fill : style.color, line: style.borderTopColor, accent: stripe ? getComputedStyle(stripe).fill : style.color };
}
