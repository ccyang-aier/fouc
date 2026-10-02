'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ArrowsOut, CaretLeft, CaretRight, DownloadSimple, FileText, MagnifyingGlassMinus, MagnifyingGlassPlus, SidebarSimple } from '@phosphor-icons/react';
import type { PdfComments, PdfViewMode } from './pdf-file-view';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { documentFileFormat, decodeDocumentText, type DocumentFile } from './file-format';
import { readDocumentFile } from './file-source';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TextFileView } from './text-file-view';
import styles from './file-preview.module.css';

const PdfFileView = dynamic(() => import('./pdf-file-view').then(module => module.PdfFileView), { ssr: false });
const OfficeFileView = dynamic(() => import('./office-file-view').then(module => module.OfficeFileView), { ssr: false });

type PreviewProps = { workspaceId: string; source: 'local' | 'workspace'; file?: DocumentFile; name: string; attach?: React.ReactNode; pdfComments?: PdfComments; commentTrigger?: React.ReactNode };
export function FileDocumentPreview(props: PreviewProps) {
  return <FilePreviewSession key={`${props.workspaceId}:${props.source}:${props.file?.source ?? props.name}`} {...props} />;
}
function FilePreviewSession({ workspaceId, source, file, name, attach, pdfComments, commentTrigger }: PreviewProps) {
  const format = documentFileFormat(file?.name ?? name);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [converted, setConverted] = useState<Blob | null>(null);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(Boolean(file));
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [mode, setMode] = useState<PdfViewMode>('continuous');
  const [thumbnails, setThumbnails] = useState(false);
  const host = useRef<HTMLElement>(null);
  const conversion = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!file) return;
    const controller = new AbortController(); let objectUrl = '';
    void readDocumentFile(workspaceId, source, file, controller.signal).then(async data => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl); setBlob(data);
      if (['text', 'json', 'csv', 'markdown'].includes(format ?? '')) { if (data.size > 10 * 1024 * 1024) throw new Error('文本结构预览支持 10 MB 以内的文件，请下载原文件查看。'); const content = await decodeDocumentText(data); if (!controller.signal.aborted) setText(content); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '原文件读取失败'); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => { controller.abort(); conversion.current?.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [workspaceId, source, file, format, retry]);
  async function convertDoc() {
    if (!blob) return;
    conversion.current?.abort(); const controller = new AbortController(); conversion.current = controller;
    setBusy(true); setError('');
    try {
      const { origin } = await getFoucApiOrigin();
      const response = await fetch(`${origin}/api/knowledge/preview/doc`, { method: 'POST', body: blob, headers: { 'Content-Type': 'application/msword' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(75_000)]) });
      if (!response.ok) throw new Error(response.status === 429 ? '转换服务繁忙，请稍后重试。' : response.status === 413 ? 'DOC 转换支持 32 MB 以内的文件。' : 'DOC 转换失败，请确认文档完整，或下载原文件查看。');
      const pdf = await response.blob(); if ((await pdf.slice(0, 5).text()) !== '%PDF-') throw new Error('预览响应格式异常。');
      if (!controller.signal.aborted) setConverted(pdf);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '文档转换失败'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const paged = ['pdf', 'pptx', 'docx'].includes(format ?? '') || Boolean(converted);
  const isPdf = format === 'pdf' || Boolean(converted);
  return <section ref={host} className={styles.viewer} aria-label="文件预览" onKeyDown={event => { if (!paged || (event.target as HTMLElement).matches('input,textarea')) return; if (event.key === 'ArrowRight') setPage(value => Math.min(pages, value + 1)); if (event.key === 'ArrowLeft') setPage(value => Math.max(1, value - 1)); }}>
    <header className={styles.toolbar}><span className={styles.format}>{format === 'text' ? 'TXT' : (format ?? '文件').toUpperCase()}</span><span className={styles.filename} title={file?.name ?? name}>{file?.name ?? name}</span>
      {isPdf && <><button aria-label="PDF 缩略图" title="缩略图" aria-pressed={thumbnails} onClick={() => setThumbnails(value => !value)}><SidebarSimple size={17} /></button><select className={styles.pdfMode} aria-label="PDF 阅读模式" value={mode} onChange={event => setMode(event.target.value as PdfViewMode)}><option value="continuous">连续滚动</option><option value="paged">逐页阅读</option></select></>}
      {paged && <div className={styles.paging}><button aria-label="上一页" disabled={page === 1} onClick={() => setPage(value => value - 1)}><CaretLeft size={16} /></button><input aria-label="预览页码" type="number" min={1} max={pages} value={page} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) setPage(Math.min(pages, Math.max(1, value))); }} /><span>/ {pages}</span><button aria-label="下一页" disabled={page >= pages} onClick={() => setPage(value => value + 1)}><CaretRight size={16} /></button></div>}
      {paged && <div className={styles.zoom}><button aria-label="缩小预览" disabled={zoom <= 50} onClick={() => setZoom(value => Math.max(50, value - 10))}><MagnifyingGlassMinus size={16} /></button><button title="恢复显示比例" onClick={() => setZoom(100)}>{zoom}%</button><button aria-label="放大预览" disabled={zoom >= (isPdf ? 300 : 200)} onClick={() => setZoom(value => Math.min(isPdf ? 300 : 200, value + 10))}><MagnifyingGlassPlus size={16} /></button></div>}
      {commentTrigger}
      <button aria-label="全屏预览" title="全屏预览" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else { const target = pdfComments ? host.current?.closest('[aria-label="页面编辑器"]') : host.current; void target?.requestFullscreen(); } }}><ArrowsOut size={17} /></button>
      {url && <a href={url} download={file?.name ?? name} aria-label="下载原文件" title="下载原文件"><DownloadSimple size={18} /></a>}
    </header>
    {!file ? <div className={styles.state}><FileText size={34} weight="duotone" /><strong>关联原文件后即可预览</strong><p>当前记录只有文档信息，尚未保存原文件。</p>{attach}</div> : error ? <div role="alert" className={styles.state}><strong>预览未能完成</strong><p>{error}</p><button onClick={() => { setBusy(true); setError(''); setConverted(null); setPage(1); setPages(1); setRetry(value => value + 1); }}>重新读取</button>{attach}</div> : busy ? <div role="status" className={styles.state}>正在读取并排版…</div> : blob && <div className={styles.content}>
      {isPdf ? <PdfFileView blob={converted ?? blob} page={page} zoom={zoom} onPages={setPages} onPageChange={setPage} onZoomChange={setZoom} mode={mode} thumbnails={thumbnails} onThumbnailsChange={setThumbnails} comments={format === 'pdf' ? pdfComments : undefined} />
        : format === 'pptx' || format === 'docx' ? <OfficeFileView blob={blob} format={format} page={page} zoom={zoom} onPages={setPages} />
        : format === 'markdown' ? <article className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></article> : format === 'csv' || format === 'json' || format === 'text' ? <TextFileView text={text} format={format} />
        : format === 'image' ? <div className={styles.image}><Image src={url} alt={file?.name ?? name} width={1600} height={1200} unoptimized /></div>
        : format === 'doc' ? <div className={styles.state}><FileText size={34} weight="duotone" /><strong>Word 文档</strong><p>{source === 'local' ? '生成预览会将这份 DOC 发送至 Fouc 服务进行临时转换。' : '生成分页阅读视图，保留原文档的排版。'}</p><button onClick={() => void convertDoc()}>生成预览</button></div>
        : <div className={styles.state}>此格式暂不支持预览，可下载原文件查看。</div>}
    </div>}
  </section>;
}
