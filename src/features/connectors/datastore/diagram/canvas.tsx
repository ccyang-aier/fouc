'use client';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowsOut, Minus, Plus } from '@phosphor-icons/react';
import { erDiagramPath, fitErDiagramViewport, pointAlongErRoute, zoomErDiagramAt, type ErDiagramModel, type ErDiagramPosition, type ErDiagramViewport } from '@fouc/shared/er-diagram';
import type { ErDiagramExportView } from './export';
import { DiagramTableNode } from './node';
import styles from './diagram.module.css';
export interface DiagramSelection { nodeId?: string; column?: string; edgeId?: string }
interface CanvasProps {
  model: ErDiagramModel; view: ErDiagramExportView; selection: DiagramSelection; matches?: ReadonlySet<string>;
  focus?: { nodeId: string; version: number }; onSelect: (selection: DiagramSelection) => void; onMove: (nodeId: string, position: ErDiagramPosition) => void;
}
interface Gesture { pointer: number; start: ErDiagramPosition; view: ErDiagramViewport; nodeId?: string; origin?: ErDiagramPosition; moved: boolean }
export function DiagramCanvas({ model, view, selection, matches, focus, onSelect, onMove }: CanvasProps) {
  const host = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null), suppressClick = useRef(false), initialFit = useRef(false);
  const live = useRef({ view, onMove }), frame = useRef<number | null>(null), pending = useRef<{ id: string; position: ErDiagramPosition } | null>(null);
  const [viewport, setViewport] = useState<ErDiagramViewport>({ x: 0, y: 0, zoom: 1 }), [size, setSize] = useState({ width: 900, height: 520 });
  const previousSize = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => { live.current = { view, onMove }; }, [view, onMove]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width, height = entry.contentRect.height;
      setSize({ width, height });
      if (width <= 0 || height <= 0) return;
      const previous = previousSize.current;
      if (!initialFit.current) {
        initialFit.current = true;
        setViewport(fitErDiagramViewport(live.current.view.layout, width, height));
      } else if (previous && (previous.width !== width || previous.height !== height)) {
        // Retain the graph center when the host or viewport changes size.
        setViewport(current => ({ ...current, x: current.x + (width - previous.width) / 2, y: current.y + (height - previous.height) / 2 }));
      }
      previousSize.current = { width, height };
    });
    observer.observe(element);
    const wheel = (event: WheelEvent) => { event.preventDefault(); const bounds = element.getBoundingClientRect(), point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; setViewport((current) => event.ctrlKey || event.metaKey ? zoomErDiagramAt(current, current.zoom * Math.exp(-event.deltaY * .002), point) : { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);
  useEffect(() => {
    if (!focus) return;
    const id = requestAnimationFrame(() => { const box = live.current.view.layout.boxes.find((entry) => entry.id === focus.nodeId), element = host.current; if (box && element) setViewport((current) => ({ ...current, zoom: Math.max(.55, current.zoom), x: element.clientWidth / 2 - (box.x + box.width / 2) * Math.max(.55, current.zoom), y: element.clientHeight / 2 - (box.y + box.height / 2) * Math.max(.55, current.zoom) })); });
    return () => cancelAnimationFrame(id);
  }, [focus]);
  function zoom(factor: number) { setViewport((current) => zoomErDiagramAt(current, current.zoom * factor, { x: size.width / 2, y: size.height / 2 })); }
  function start(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as Element, node = target.closest('[data-er-node]'), id = node?.getAttribute('data-er-node') ?? undefined;
    if (event.button === 0 && target.closest('[data-er-edge]')) return;
    if (id && !target.closest('[data-er-drag]') && event.button !== 1) return;
    const box = id && event.button === 0 ? view.layout.boxes.find((entry) => entry.id === id) : undefined;
    gesture.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, view: viewport, nodeId: box?.id, origin: box, moved: false }; suppressClick.current = false;
    if (box) onSelect({ nodeId: box.id }); event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current; if (!current || current.pointer !== event.pointerId) return;
    const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y; current.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
    if (current.nodeId && current.origin) { pending.current = { id: current.nodeId, position: { x: Math.max(56, current.origin.x + dx / current.view.zoom), y: Math.max(56, current.origin.y + dy / current.view.zoom) } }; if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; const next = pending.current; pending.current = null; if (next) live.current.onMove(next.id, next.position); }); }
    else setViewport({ ...current.view, x: current.view.x + dx, y: current.view.y + dy });
  }
  function stop(event: PointerEvent<SVGSVGElement>) { const current = gesture.current; if (current?.pointer !== event.pointerId) return; suppressClick.current = current.moved; gesture.current = null; if (pending.current) { const next = pending.current; pending.current = null; onMove(next.id, next.position); } if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
  // Panning and zooming only update the outer transform; catalog rows and routes retain their React tree.
  const graph = useMemo(() => { const connected = new Set(selection.nodeId ? model.edges.filter((edge) => edge.source === selection.nodeId || edge.target === selection.nodeId).map((edge) => edge.id) : []); return <>
        {model.edges.map((edge) => { const route = view.routes[edge.id] ?? [], active = selection.edgeId === edge.id || connected.has(edge.id), target = model.nodes.find((node) => node.id === edge.target); if (!route.length) return null; return <g key={edge.id} className={`${styles.edge} ${active ? styles.activeEdge : ''} ${target?.external || edge.validated === false ? styles.unverifiedEdge : ''}`} data-er-edge={edge.id} role="button" tabIndex={0} aria-label={`外键 ${edge.name}`} onClick={(event) => { event.stopPropagation(); onSelect({ edgeId: edge.id }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect({ edgeId: edge.id }); } }}><title>{edge.name}: {edge.pairs.map((pair) => `${pair.sourceColumn} → ${pair.targetColumn}`).join(', ')} · ON DELETE {edge.onDelete}</title><path d={erDiagramPath(route)} className={styles.edgeHit} /><path d={erDiagramPath(route)} className={styles.edgeLine} />{[[.12, edge.sourceCardinality === 'many' ? 'N' : '1'], [.88, edge.targetCardinality === 'unknown' ? '?' : edge.targetCardinality === 'many' ? 'N' : edge.nullable ? '0..1' : '1']].map(([fraction, label], index) => { const point = pointAlongErRoute(route, Number(fraction)); return <g key={index} transform={`translate(${point.x},${point.y})`} className={styles.cardinality}><rect x={-15} y={-10} width={30} height={20} rx={4} /><text y={4} textAnchor="middle">{label}</text></g>; })}</g>; })}
        {model.nodes.map((node) => { const box = view.layout.boxes.find((entry) => entry.id === node.id); return box ? <DiagramTableNode key={node.id} node={node} box={box} columns={view.columns[node.id] ?? []} selected={selection.nodeId === node.id} selectedColumn={selection.nodeId === node.id ? selection.column : undefined} dimmed={Boolean(matches && !matches.has(node.id))} onSelect={(nodeId, column) => onSelect({ nodeId, column })} /> : null; })}
      </>; }, [model, view, selection, matches, onSelect]);
  return <div ref={host} className={styles.canvas}>
    <svg role="group" aria-label="数据库 ER 关系图，拖动空白平移，拖动表头移动表，Ctrl 加滚轮缩放" tabIndex={0} width="100%" height="100%" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onClickCapture={(event) => { if (suppressClick.current) { event.stopPropagation(); suppressClick.current = false; } }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); } else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); } else if (event.key === '0') { event.preventDefault(); setViewport(fitErDiagramViewport(view.layout, size.width, size.height)); } else if (event.key === 'Escape') onSelect({}); }}>
      <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>{graph}</g>
    </svg>
    <div className={styles.zoomControls}><button type="button" aria-label="缩小关系图" onClick={() => zoom(1 / 1.2)}><Minus size={15} /></button><button type="button" aria-label="关系图原始比例" onClick={() => setViewport((current) => zoomErDiagramAt(current, 1, { x: size.width / 2, y: size.height / 2 }))}>{Math.round(viewport.zoom * 100)}%</button><button type="button" aria-label="放大关系图" onClick={() => zoom(1.2)}><Plus size={15} /></button><i /><button type="button" aria-label="适应关系图" onClick={() => setViewport(fitErDiagramViewport(view.layout, size.width, size.height))}><ArrowsOut size={16} /></button></div>
    <span className={styles.canvasHint}>拖动平移 · Ctrl + 滚轮缩放</span>
  </div>;
}
