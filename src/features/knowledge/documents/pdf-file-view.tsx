'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import styles from './file-preview.module.css';

export function PdfFileView({ blob, page, zoom, onPages }: { blob: Blob; page: number; zoom: number; onPages: (count: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    void (async () => {
      const engine = await import('pdfjs-dist');
      engine.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
      task = engine.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/', wasmUrl: '/vendor/pdfjs/wasm/' });
      task.onPassword = () => { setError('这份 PDF 有密码保护，请下载原文件解锁后重新上传。'); void task?.destroy(); };
      const document = await task.promise;
      if (cancelled) { await document.loadingTask.destroy(); return; }
      onPages(document.numPages); setPdf(document);
    })().catch(() => { if (!cancelled) setError('PDF 无法读取，请检查原文件是否损坏或受到密码保护。'); });
    return () => { cancelled = true; void task?.destroy(); };
    // Page counts are reported to the owning toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);
  useEffect(() => {
    if (!pdf || !canvas.current || !layer.current) return;
    let cancelled = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let textLayer: InstanceType<typeof import('pdfjs-dist')['TextLayer']> | undefined;
    const surface = canvas.current; const text = layer.current;
    void (async () => {
      const content = await pdf.getPage(Math.min(page, pdf.numPages));
      if (cancelled) return;
      const base = content.getViewport({ scale: 1 });
      const viewport = content.getViewport({ scale: Math.min(Math.max(240, width - 64) / base.width, 1.5) * zoom / 100 });
      const ratio = window.devicePixelRatio || 1;
      surface.width = Math.floor(viewport.width * ratio); surface.height = Math.floor(viewport.height * ratio);
      surface.style.width = `${viewport.width}px`; surface.style.height = `${viewport.height}px`;
      text.replaceChildren(); text.style.width = `${viewport.width}px`; text.style.height = `${viewport.height}px`;
      text.style.setProperty('--scale-factor', String(viewport.scale)); text.style.setProperty('--total-scale-factor', String(viewport.scale));
      render = content.render({ canvas: surface, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await render.promise;
      if (cancelled) return;
      const engine = await import('pdfjs-dist');
      textLayer = new engine.TextLayer({ textContentSource: await content.getTextContent(), container: text, viewport });
      await textLayer.render();
    })().catch(error => { if (!cancelled && error?.name !== 'RenderingCancelledException') setError('此页暂时无法渲染，请尝试其他页面或重新打开。'); });
    return () => { cancelled = true; render?.cancel(); textLayer?.cancel(); };
  }, [pdf, page, zoom, width]);
  return <div ref={host} className={styles.pdfViewport}>
    {error ? <div role="alert" className={styles.state}>{error}</div> : !pdf ? <div role="status" className={styles.state}>正在读取 PDF…</div> : <div className={styles.pdfPage}><canvas ref={canvas} aria-label={`PDF 第 ${page} 页`} /><div ref={layer} className={`textLayer ${styles.textLayer}`} /></div>}
  </div>;
}
