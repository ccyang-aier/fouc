import type { RelationalProvider } from './relational';
import type { DatabaseObjectKind } from './database';

export interface ErDiagramColumn {
  name: string; dataType: string | null; nullable: boolean | null; primary: boolean | null; unique: boolean | null;
  foreign: boolean; generated: boolean; default: string | null; comment: string | null;
}
export interface ErDiagramNode {
  id: string; schema: string; table: string; kind: DatabaseObjectKind; external: boolean;
  columns: ErDiagramColumn[]; comment: string | null;
}
export interface ErDiagramEdge {
  id: string; name: string; nameSource: 'catalog' | 'synthetic'; source: string; target: string;
  pairs: { sourceColumn: string; targetColumn: string }[];
  sourceCardinality: 'one' | 'many'; targetCardinality: 'one' | 'many' | 'unknown'; nullable: boolean;
  validated: boolean | null; deferrable: boolean | null; initiallyDeferred: boolean | null;
  onUpdate: string; onDelete: string; match: string; definition: string | null;
}
export interface ErDiagramIssue { nodeId?: string; edgeId?: string; message: string }
export interface ErDiagramModel { connectionId: string; provider: RelationalProvider; schemas: string[]; nodes: ErDiagramNode[]; edges: ErDiagramEdge[]; issues: ErDiagramIssue[] }
export interface ErDiagramPosition { x: number; y: number }
export interface ErDiagramBox extends ErDiagramPosition { id: string; width: number; height: number }
export interface ErDiagramLayout { positions: Record<string, ErDiagramPosition>; boxes: ErDiagramBox[]; width: number; height: number }
export interface ErDiagramLoadResult { model: ErDiagramModel; loadedTables: number; catalogTables: number; truncated: boolean }
export { buildErDiagram, erDiagramNodeId, diagramFieldRelations, diagramJoinSql } from './er-diagram-model';
export { layoutErDiagram, diagramVisibleColumns, erDiagramCardHeight, ER_CARD_WIDTH, ER_HEADER_HEIGHT, ER_ROW_HEIGHT } from './er-diagram-layout';
export { routeErDiagramEdge, erDiagramPath, pointAlongErRoute, fitErDiagramViewport, zoomErDiagramAt, clampErDiagramZoom, type ErDiagramViewport } from './er-diagram-geometry';
