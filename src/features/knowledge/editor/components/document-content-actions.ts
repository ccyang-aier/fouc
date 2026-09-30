import type { Editor } from '@tiptap/core';

export type ContentFormat = 'text' | 'markdown' | 'html';
export function escapeDocumentHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export const documentExportStyles = `
body{max-width:830px;margin:48px auto;padding:0 24px;color:#202833;font:16px/1.8 system-ui,sans-serif;overflow-wrap:anywhere}
h1,h2,h3,h4{line-height:1.35}h1{font-size:32px}p{margin:0 0 18px}a{color:#0869cf}img,video{max-width:100%}
table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #d7dfed;padding:9px 12px;vertical-align:top}th{background:#f5f7fa;text-align:left}td p,th p{margin:0}
pre{white-space:pre-wrap;background:#f5f7fa;padding:16px;border-radius:8px}code{font-family:monospace}blockquote{border-left:3px solid #c6d2e2;margin-left:0;padding-left:18px}
[data-columns]{display:flex;gap:24px}[data-column]{min-width:0;flex:var(--column-width,1)}aside[data-emoji]{position:relative;padding:16px 16px 16px 46px;background:#f5f7fa;border-radius:8px;margin-bottom:18px}aside[data-emoji]::before{position:absolute;left:16px;content:attr(data-emoji)}
[data-task-list]{list-style:none;padding-left:0}[data-task-item]{position:relative;padding-left:26px}[data-task-item]::before{position:absolute;left:0;content:'☐';color:#718096}[data-task-item][data-checked=true]::before{content:'☑';color:#0869cf}
@media print{body{max-width:none;margin:0;padding:0}*{print-color-adjust:exact}img,tr,pre{break-inside:avoid}thead{display:table-header-group}}
@page{margin:18mm}
`;

/** Reads the live editor on demand; it never writes a second copy of the body. */
export async function documentContent(editor: Editor, title: string, format: ContentFormat): Promise<string> {
  const name = title.trim() || '无标题文档';
  if (format === 'text') return `${name}\n\n${editor.getText({ blockSeparator: '\n' })}`;
  if (format === 'markdown') {
    const schema = editor.schema;
    const body = editor.state.doc;
    const { createMarkdownPipeline } = await import('@fouc/shared/knowledge/markdown');
    const pipeline = createMarkdownPipeline({ schema });
    const heading = schema.nodes.heading.create({ level: 1 }, schema.text(name));
    return pipeline.serialize(schema.nodes.doc.create(null, [heading, ...Array.from({ length: body.childCount }, (_, index) => body.child(index))]));
  }
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeDocumentHtml(name)}</title><style>${documentExportStyles}</style></head><body><h1>${escapeDocumentHtml(name)}</h1>${editor.getHTML()}</body></html>`;
}

export function downloadDocument(content: string, title: string, format: 'markdown' | 'html') {
  const filename = (title.trim() || '无标题文档').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || '文档';
  const blob = new Blob([content], { type: format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.${format === 'html' ? 'html' : 'md'}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Isolated, script-free snapshot: the workspace chrome and editing controls are excluded. */
export function printDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = '文档打印';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:830px;height:1000px;border:0';
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    const timeout = setTimeout(() => { frame.remove(); reject(new Error('print-timeout')); }, 15000);
    frame.onload = async () => {
      try {
        await frame.contentDocument?.fonts.ready;
        const target = frame.contentWindow;
        if (!target) throw new Error('print-unavailable');
        clearTimeout(timeout);
        target.addEventListener('afterprint', () => frame.remove(), { once: true });
        target.focus();
        target.print();
        resolve();
      } catch (error) { clearTimeout(timeout); frame.remove(); reject(error); }
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
