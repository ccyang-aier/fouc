'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CaretLeft, CaretRight, Copy, DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react';
import type { DatabaseCell } from '@fouc/shared';
import { rawGridCellText } from '../clipboard';
import {
  BINARY_DOWNLOAD_BYTES, BINARY_PREVIEW_BYTES, HEX_BYTES_PER_ROW, HEX_PAGE_ROWS,
  binaryByteLabel, binaryDownloadName, binaryHexRows, binaryUtf8Preview,
  decodeBinaryPrefix, decodeCompleteBinary, findBinaryBytes, nativeBinaryValue,
  parseBinaryHexSearch, type BinaryValue,
} from './model';
import { identifyBinaryImage, type BinaryImage } from './image';
import styles from './binary.module.css';

type BinaryView = 'hex' | 'utf8' | 'image' | 'raw';
interface Props {
  value: DatabaseCell;
  columnName: string;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onCopy: (text: string, label: string) => void;
}
interface ViewState {
  source: DatabaseCell;
  view: BinaryView;
  page: number;
  search: string;
  found: number | null;
  message: string;
}

export function BinaryCellView({ value, columnName, textRef, onCopy }: Props) {
  const model = useMemo(() => {
    try {
      const binary = nativeBinaryValue(value);
      if (!binary) throw new Error('该值不是原生二进制');
      const prefix = decodeBinaryPrefix(binary);
      return { binary, prefix, image: identifyBinaryImage(prefix), error: null };
    } catch (reason) {
      return { binary: null, prefix: null, image: null, error: reason instanceof Error ? reason.message : String(reason) };
    }
  }, [value]);
  const [snapshot, setState] = useState<ViewState>(() => ({ source: value, view: 'hex', page: 0, search: '', found: null, message: '' }));
  let state = snapshot;
  if (state.source !== value) {
    state = { source: value, view: 'hex', page: 0, search: '', found: null, message: '' };
    setState(state);
  }
  const binary = model.binary, prefix = model.prefix;
  const truncated = Boolean(binary && prefix && prefix.length < binary.bytes);
  const pages = prefix ? Math.max(1, Math.ceil(prefix.length / (HEX_BYTES_PER_ROW * HEX_PAGE_ROWS))) : 1;
  const page = Math.min(state.page, pages - 1);
  const rows = useMemo(() => prefix ? binaryHexRows(prefix, page * HEX_PAGE_ROWS) : [], [prefix, page]);
  const utf8 = useMemo(() => prefix ? binaryUtf8Preview(prefix, truncated) : null, [prefix, truncated]);
  const view = model.error ? 'raw' : state.view;

  function change(next: Partial<ViewState>): void { setState({ ...state, ...next }); }
  function search(): void {
    if (!prefix) return;
    try {
      const found = findBinaryBytes(prefix, parseBinaryHexSearch(state.search), state.found === null ? 0 : state.found + 1);
      change({ found, page: found === null ? page : Math.floor(found / (HEX_BYTES_PER_ROW * HEX_PAGE_ROWS)),
        message: found === null ? '当前预览范围没有匹配字节' : `匹配偏移 0x${found.toString(16).toUpperCase()}；再次搜索查看下一处` });
    } catch (reason) { change({ message: reason instanceof Error ? reason.message : String(reason) }); }
  }
  function download(): void {
    if (!binary) return;
    try {
      const bytes = decodeCompleteBinary(binary);
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/octet-stream' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = binaryDownloadName(columnName, model.image?.extension);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      change({ message: `已交给浏览器保存原始 ${binaryByteLabel(binary.bytes)} 字节` });
    } catch (reason) { change({ message: reason instanceof Error ? reason.message : String(reason) }); }
  }

  return <section className={styles.viewer} aria-label="二进制原始字节查看器">
    <div className={styles.tabs} role="tablist" aria-label="二进制查看方式">
      {([{ id: 'hex', label: 'HEX' }, { id: 'utf8', label: 'UTF-8' }, ...(model.image ? [{ id: 'image', label: '图像' }] : []), { id: 'raw', label: '原值' }] as const).map(tab =>
        <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} disabled={Boolean(model.error) && tab.id !== 'raw'} onClick={() => change({ view: tab.id as BinaryView, message: '' })}>{tab.label}</button>,
      )}
      <span>{binary ? binaryByteLabel(binary.bytes) : '无效字节'}</span>
    </div>
    {model.error && <p role="alert" className={styles.message}>{model.error}；原始值保持不变。</p>}
    {truncated && view !== 'raw' && <p className={styles.message}>预览 / 搜索仅前 {binaryByteLabel(BINARY_PREVIEW_BYTES)}，完整 {binaryByteLabel(binary!.bytes)}。</p>}
    {view === 'hex' && <>
      <form className={styles.search} onSubmit={event => { event.preventDefault(); search(); }}>
        <MagnifyingGlass size={13} /><input aria-label="搜索二进制十六进制字节" value={state.search} onChange={event => change({ search: event.target.value, found: null, message: '' })} placeholder="搜索字节，如 00 FF 41" maxLength={384}/>
        <button type="submit">查找</button>
      </form>
      <div className={styles.hex} role="tabpanel" aria-label="十六进制与 ASCII 对照" tabIndex={0}>
        <table><thead><tr><th>OFFSET</th><th>HEX</th><th>ASCII</th></tr></thead><tbody>
          {rows.map(row => <tr key={row.offset} data-match={state.found !== null && parseInt(row.offset, 16) <= state.found && state.found < parseInt(row.offset, 16) + HEX_BYTES_PER_ROW}>
            <th>{row.offset}</th><td>{row.hex}</td><td>{row.ascii}</td>
          </tr>)}
        </tbody></table>
        {!rows.length && <p>空二进制值，0 字节</p>}
      </div>
      <div className={styles.paging}>
        <button type="button" aria-label="上一页字节" disabled={!page} onClick={() => change({ page: page - 1 })}><CaretLeft size={13}/></button>
        <span>{page + 1} / {pages} 页 · 每页最多 {HEX_PAGE_ROWS * HEX_BYTES_PER_ROW} B</span>
        <button type="button" aria-label="下一页字节" disabled={page + 1 === pages} onClick={() => change({ page: page + 1 })}><CaretRight size={13}/></button>
        <button type="button" disabled={!rows.length} title="仅复制当前字节页" onClick={() => onCopy(rows.map(row => row.hex).join('\n'), '当前预览页 HEX')}><Copy size={13}/></button>
      </div>
    </>}
    {view === 'utf8' && (utf8 === null ? <p role="status" className={styles.empty}>该范围不是有效 UTF-8，使用 HEX 查看原始字节。</p> : <textarea ref={textRef} aria-label="二进制 UTF-8 预览" className={styles.text} value={utf8} readOnly spellCheck={false}/>)}
    {view === 'raw' && <textarea ref={textRef} aria-label="单元格原始值" className={styles.text} value={rawGridCellText(value, true)} readOnly spellCheck={false}/>}
    {view === 'image' && binary && model.image && <BinaryImagePreview value={binary} image={model.image}/>}
    {state.message && <p className={styles.message} role="status">{state.message}</p>}
    {binary && <div className={styles.download}>
      <span>{binary.bytes > BINARY_DOWNLOAD_BYTES ? '原值文件超过 16 MiB，使用全表导出' : '保存完整原始字节'}</span>
      <button type="button" disabled={binary.bytes > BINARY_DOWNLOAD_BYTES} onClick={download}><DownloadSimple size={13}/>保存文件</button>
    </div>}
  </section>;
}

function BinaryImagePreview({ value, image }: { value: BinaryValue; image: BinaryImage }) {
  const [status, setStatus] = useState<{ source: string; failure: string | null; loaded: boolean } | null>(null);
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (value.bytes > BINARY_DOWNLOAD_BYTES) return;
    const target = element.current;
    if (!target) return;
    const bytes = decodeCompleteBinary(value);
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: image.mimeType }));
    target.src = url;
    return () => {
      target.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [value, image.mimeType]);
  const current = status?.source === value.base64 ? status : null;
  return <div className={styles.image} role="tabpanel" aria-label="原生二进制图像预览">
    {value.bytes > BINARY_DOWNLOAD_BYTES ? <p>图像预览最多 16 MiB，使用原值或全表导出。</p> : <>
      {!current?.loaded && !current?.failure && <p role="status">正在解码原始图像…</p>}
      {current?.failure && <p role="alert">{current.failure}</p>}
      {/* Raster bytes are local native data, with bounded headers and no remote URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={element} hidden={!current?.loaded || Boolean(current.failure)} alt={`${image.width} × ${image.height} 原生二进制图像`} onError={() => setStatus({ source: value.base64, loaded: false, failure: '图像数据无法解码，原始字节仍可查看与保存' })} onLoad={() => {
        const mismatch = element.current && (element.current.naturalWidth !== image.width || element.current.naturalHeight !== image.height);
        setStatus({ source: value.base64, loaded: !mismatch, failure: mismatch ? '图像尺寸与原始头部不一致，已停止显示' : null });
      }}/>
    </>}
    <small>{image.mimeType} · {image.width} × {image.height}</small>
  </div>;
}
