import { ArrowsOutSimple } from '@phosphor-icons/react/dist/csr/ArrowsOutSimple';
import { Minus } from '@phosphor-icons/react/dist/csr/Minus';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { edgeStrokeWidth, formatPlanRows, heatLevel, PLAN_CANVAS_NODE_H, PLAN_CANVAS_NODE_W, type PlanCanvasLayout } from './plan-canvas';
import { PLAN_CATEGORY_LABELS, planNodeMatches } from './plan-presentation';
import styles from './explain.module.css';

type Props = { layout: PlanCanvasLayout; selectedId: string | undefined; onSelect: (id: string) => void; search: string };
const clampZoom = (value: number) => Math.max(0.25, Math.min(1.6, value));

/** DBX's leaf-first plan geometry, elbow connectors and estimated-cost heat map. */
export function ExplainPlanDiagram({ layout, selectedId, onSelect, search }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const [zoomState, setZoom] = useState({ layout, value: 1 });
  const zoom = zoomState.layout === layout ? zoomState.value : 1;
  const fit = useCallback(() => {
    const element = viewport.current;
    if (!element || !layout.width || !layout.height) return;
    setZoom({ layout, value: clampZoom(Math.min(1.3, (element.clientWidth - 20) / layout.width, (element.clientHeight - 20) / layout.height)) });
    element.scrollTo({ left: 0, top: 0 });
  }, [layout]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);
  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button')) return;
    const element = event.currentTarget;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    element.setPointerCapture(event.pointerId);
  }
  function pan(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    event.currentTarget.scrollLeft = start.left - event.clientX + start.x;
    event.currentTarget.scrollTop = start.top - event.clientY + start.y;
  }
  function endPan(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className={styles.diagram}>
    <div className={styles.diagramTools} aria-label="计划图缩放">
      <button type="button" aria-label="缩小" disabled={zoom <= 0.25} onClick={() => setZoom({ layout, value: clampZoom(zoom - 0.1) })}><Minus size={14} /></button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="放大" disabled={zoom >= 1.6} onClick={() => setZoom({ layout, value: clampZoom(zoom + 0.1) })}><Plus size={14} /></button>
      <button type="button" aria-label="适应画布" title="适应画布" onClick={fit}><ArrowsOutSimple size={14} /></button>
    </div>
    <div ref={viewport} className={styles.diagramViewport} onPointerDown={startPan} onPointerMove={pan} onPointerUp={endPan} onPointerCancel={endPan} aria-label="执行计划流程图">
      <div className={styles.diagramStage} style={{ width: layout.width * zoom, height: layout.height * zoom }}>
        <div className={styles.diagramContent} style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
          <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
            {layout.edges.map((edge) => {
              const x = edge.from.x + PLAN_CANVAS_NODE_W, y = edge.from.y + PLAN_CANVAS_NODE_H / 2;
              const endY = edge.to.y + PLAN_CANVAS_NODE_H / 2, bend = (x + edge.to.x) / 2;
              return <g key={`${edge.from.node.id}-${edge.to.node.id}`}><path d={`M ${x} ${y} H ${bend} V ${endY} H ${edge.to.x}`} strokeWidth={edgeStrokeWidth(edge.rows)} />{edge.rows !== undefined && <text x={bend + 5} y={endY - 8}>{formatPlanRows(edge.rows)}</text>}</g>;
            })}
          </svg>
          {layout.nodes.map((placed) => <button key={placed.node.id} type="button" className={styles.graphNode} style={{ left: placed.x, top: placed.y, width: PLAN_CANVAS_NODE_W, height: PLAN_CANVAS_NODE_H }} data-plan-node={placed.node.id} data-category={placed.category} data-heat={heatLevel(placed.costShare)} data-selected={placed.node.id === selectedId} data-matched={!!search.trim() && planNodeMatches(placed.node, search)} data-dimmed={!!search.trim() && !planNodeMatches(placed.node, search)} aria-pressed={placed.node.id === selectedId} onClick={() => onSelect(placed.node.id)}>
            <div className={styles.graphNodeHeading}><span className={styles.category} data-category={placed.category}>{PLAN_CATEGORY_LABELS[placed.category]}</span><span className={styles.costShare}>{placed.costShare === undefined ? '—' : `${(placed.costShare * 100).toFixed(1)}%`}</span></div>
            <strong title={placed.node.title}>{placed.node.nodeType}</strong>
            <div className={styles.graphNodeFoot}><span title={placed.node.relation || placed.node.index}>{placed.node.relation || placed.node.index || '服务器操作'}</span><span>预计 {formatPlanRows(placed.rows)} 行</span></div>
          </button>)}
        </div>
      </div>
    </div>
    <div className={styles.legend}><span><i data-heat="cool" />较低</span><span><i data-heat="warm" />中等</span><span><i data-heat="hot" />较高</span><span>颜色表示相对预计成本 · 拖动画布平移</span></div>
  </div>;
}
