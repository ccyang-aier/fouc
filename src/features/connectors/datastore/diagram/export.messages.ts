import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  erDiagram: ['{p0} ER 图', '{p0} ER diagram'],
  structureNotLoaded: [' · 未加载结构', ' · Structure not loaded'],
  showing: [' · 当前显示 {p0}', ' · Showing {p0}'],
  textXYFontSizeFillColumnsTextG: [
    '<text x="15" y="{p0}" font-size="10" fill="{p1}">{p2} 字段{p3}</text></g>',
    '<text x="15" y="{p0}" font-size="10" fill="{p1}">{p2} columns{p3}</text></g>',
  ],
  svgExceedsMibReduceTheVisibleScope: [
    'SVG 超过 16 MiB，请缩小显示范围',
    'SVG exceeds 16 MiB. Reduce the visible scope',
  ],
  notLoaded: [' · 未加载', ' · Not loaded'],
  pngSupportsUpToMillionPixelsUseSvgToExport: [
    'PNG 最多 1600 万像素，请使用 SVG 导出完整大图',
    'PNG supports up to 16 million pixels. Use SVG to export the complete large diagram',
  ],
  theBrowserCannotCreateAPngCanvas: [
    '浏览器无法创建 PNG 画布',
    'The browser cannot create a PNG canvas',
  ],
  couldNotGeneratePng: ['PNG 生成失败', 'Could not generate PNG'],
});
