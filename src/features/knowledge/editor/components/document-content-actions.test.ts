import { describe, expect, test } from 'bun:test';
import type { Editor } from '@tiptap/core';
import { knowledgeSchema as schema } from '@fouc/shared/knowledge/schema';
import { createMarkdownPipeline } from '@fouc/shared/knowledge/markdown';
import { documentContent } from './document-content-actions';
import { documentLink, readDocumentLink } from '../document-link';

describe('document content operations', () => {
  test('Markdown keeps headings, inline marks, tasks and table content and escapes the document title', async () => {
    const p = (text: string) => schema.nodes.paragraph.create(null, schema.text(text));
    const body = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.text('加粗文本', [schema.marks.bold.create()])),
      schema.nodes.taskList.create(null, schema.nodes.taskItem.create({ checked: true }, p('已完成'))),
      schema.nodes.table.create(null, [schema.nodes.tableRow.create(null, [schema.nodes.tableHeader.create(null, p('表头')), schema.nodes.tableHeader.create(null, p('标题'))]), schema.nodes.tableRow.create(null, [schema.nodes.tableCell.create(null, p('内容')), schema.nodes.tableCell.create(null, p('A | B'))])]),
    ]);
    const editor = { schema, state: { doc: body } } as Editor;
    const markdown = await documentContent(editor, '# 标题 [链接](javascript:alert(1))', 'markdown');
    const parsed = createMarkdownPipeline().parse(markdown);
    expect(parsed.child(0).type.name).toBe('heading');
    expect(parsed.child(0).textContent).toBe('# 标题 [链接](javascript:alert(1))');
    expect(parsed.child(0).firstChild!.marks).toEqual([]);
    expect(parsed.child(1).firstChild!.marks[0].type.name).toBe('bold');
    expect(parsed.child(2).firstChild!.attrs.checked).toBe(true);
    expect(parsed.child(3).child(1).child(1).textContent).toBe('A | B');
    expect(editor.state.doc).toBe(body);
  });
  test('HTML escapes title and includes a complete UTF-8 document without changing the body', async () => {
    const editor = { getHTML: () => '<p>正文</p>' } as Editor;
    const html = await documentContent(editor, '</h1><script>alert("x")</script>', 'html');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<h1>&lt;/h1&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</h1><p>正文</p>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('td,th{border:1px solid #d7dfed');
  });
  test('plain text reads the latest body and includes the title', async () => {
    let body = '首行\n次行';
    const editor = { getText: () => body } as Editor;
    expect(await documentContent(editor, ' ', 'text')).toBe('无标题文档\n\n首行\n次行');
    body = '最新正文';
    expect(await documentContent(editor, '标题', 'text')).toBe('标题\n\n最新正文');
  });
});

describe('document links carry explicit resource identity', () => {
  test('link round-trip distinguishes local/server and resets unrelated routes and parameters', () => {
    for (const source of ['local', 'workspace'] as const) {
      const target = { workspaceId: 'w & 1', knowledgeBaseId: 'kb1', pageId: 'p/1', source };
      const link = documentLink('http://localhost:3000/old?view=projects#stale', target);
      expect(readDocumentLink(link)).toEqual(target);
      expect(new URL(link).pathname).toBe('/');
      expect(new URL(link).hash).toBe('');
      expect(new URL(link).searchParams.get('view')).toBe('knowledge');
    }
  });
  test('incomplete and unknown source targets never select a document', () => {
    expect(readDocumentLink('http://localhost:3000/?document=p')).toBeNull();
    expect(readDocumentLink('http://localhost:3000/?document=p&workspace=w&knowledgeBase=k&source=unknown')).toBeNull();
  });
});
