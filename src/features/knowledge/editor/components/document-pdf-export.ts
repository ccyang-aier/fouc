import type { Editor } from '@tiptap/core';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { exportDocumentHtml } from './document-html-export';
import { downloadDocumentBlob } from './document-content-actions';

const errors: Record<string, string> = {
  PDF_BUSY: '导出服务繁忙，请稍后重试',
  PDF_UNAVAILABLE: 'PDF 渲染服务暂时不可用，请稍后重试',
  PAYLOAD_TOO_LARGE: '文档资源过大，暂时无法导出 PDF',
};

/** Native paged PDF, using exactly the same live presentation as the HTML snapshot. */
export async function exportDocumentPdf(editor: Editor, title: string) {
  const html = await exportDocumentHtml(editor, title);
  const { origin } = await getFoucApiOrigin();
  let response: Response;
  try {
    response = await fetch(`${origin}/api/knowledge/export/pdf`, {
      method: 'POST', headers: { 'Content-Type': 'text/html;charset=utf-8' }, body: html,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new Error(error instanceof Error && error.name === 'TimeoutError'
      ? 'PDF 导出耗时较长，请稍后重试' : '无法连接 PDF 导出服务，请检查连接后重试');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { code?: string } | null;
    throw new Error(errors[body?.code ?? ''] ?? 'PDF 导出失败，请稍后重试');
  }
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf') throw new Error('PDF 文件响应异常，请重试');
  const blob = await response.blob();
  if ((await blob.slice(0, 5).text()) !== '%PDF-') throw new Error('PDF 文件生成失败，请重试');
  downloadDocumentBlob(blob, title, 'pdf');
}
