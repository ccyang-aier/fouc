import { expect, test } from 'bun:test';
import { layoutErDiagram, type ErDiagramModel } from '@fouc/shared/er-diagram';
import { downloadErDiagramPng, exportErDiagramMermaid, exportErDiagramSvg } from './export';
test('schema graph export escapes catalog names and preserves exact identities without executable markup', () => {
  const model: ErDiagramModel = {
    connectionId: 'test',
    provider: 'postgres',
    schemas: ['schema'],
    nodes: [
      {
        id: 'exact',
        schema: 'schema"<&',
        table: 'x<script>"',
        kind: 'table',
        external: false,
        comment: null,
        columns: [
          {
            name: '"<img onload=evil>',
            dataType: 'TEXT',
            nullable: true,
            primary: false,
            unique: false,
            foreign: false,
            generated: false,
            default: null,
            comment: null,
          },
        ],
      },
    ],
    edges: [],
    issues: [],
  };
  const layout = layoutErDiagram(model),
    svg = exportErDiagramSvg(model, {
      layout,
      columns: { exact: model.nodes[0].columns },
      routes: {},
    });
  expect(svg).toContain('&lt;script&gt;');
  expect(svg).not.toContain('<script>');
  expect(svg).toContain('&quot;&lt;img');
  expect(svg).toContain('<svg xmlns=');
  expect(exportErDiagramMermaid(model)).toContain('table0["');
  expect(model.nodes[0].table).toBe('x<script>"');
});
test('large PNG exports are rejected before browser image allocation', async () => {
  await expect(
    downloadErDiagramPng('large.png', '<svg width="5000" height="5000"></svg>'),
  ).rejects.toThrow('1600 万像素');
});
