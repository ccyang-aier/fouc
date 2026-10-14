import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  foreignKey: ['外键 {p0}', 'Foreign key {p0}'],
  databaseErDiagramDragEmptySpaceToPanDragTable: [
    '数据库 ER 关系图，拖动空白平移，拖动表头移动表，Ctrl 加滚轮缩放',
    'Database ER diagram: drag empty space to pan, drag table headers to move tables, and Ctrl + wheel to zoom',
  ],
  zoomOutDiagram: ['缩小关系图', 'Zoom out diagram'],
  resetDiagramScale: ['关系图原始比例', 'Reset diagram scale'],
  zoomInDiagram: ['放大关系图', 'Zoom in diagram'],
  fitDiagram: ['适应关系图', 'Fit diagram'],
  dragToPanCtrlWheelToZoom: ['拖动平移 · Ctrl + 滚轮缩放', 'Drag to pan · Ctrl + wheel to zoom'],
});
